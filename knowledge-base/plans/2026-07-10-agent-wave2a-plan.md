# Wave 2a · 拆分 Manus 实施计划

> **For agentic workers:** 按任务顺序执行，每任务独立测试循环 + 独立 commit。步骤用 checkbox 跟踪。
> Spec：`knowledge-base/specs/2026-07-10-agent-wave2-refactor-design.md`（v2，Codex review 已吸收）

**Goal:** 把 manus.py（2602 行）按用例接缝拆成 turn_state / prompt_builder / resume_use_cases / intent_router / tool_invocation_builder 五模块，Manus 退化为编排壳（≤600 行），外部行为零变化。

**Architecture:** 纯搬运不重写；每步先锁测试再动代码；typed RouteDecision variants；async decide()；PromptBuilder 走 provider 注入。

**Tech Stack:** Python 3.11 / Pydantic v1（Manus 是 BaseModel，flag 是 PrivateAttr）/ pytest。

## Global Constraints

- 分支：`feature/agent-arch-wave2a`（从 `feature/agent-arch-wave12` 切出，不合 main）
- 行为测试零修改通过：6 套 66 条（protocol 11 / lifecycle 11 / structured 10 / resume_events 3 / email 18 / intent_send_guard 13）；**白盒源码断言例外走 Task 4 等价迁移**
- 每任务收尾必跑：`.venv/bin/python -m pytest backend/tests/test_stream_event_protocol.py backend/tests/test_agent_session_lifecycle.py backend/tests/test_structured_passthrough.py backend/tests/test_resume_events.py backend/tests/test_send_resume_email_tool.py backend/tests/test_intent_send_guard.py`
- 外部消费点保持可用：`agent_stream.py:702-705`（`drain_resume_patches()`）、`agent_stream.py:722-724`（直读/写 `agent._pending_immediate_stream`）——S1 用 property 委托兜住，**该 property 保留到 2b-B1**（D2）
- 依赖方向：manus → 新模块；反向禁止
- 发现行为怪癖只记录不修（spec 非目标）

---

### Task 1 (S1): TurnExecutionState 收拢 5 个 flag

**Files:**
- Create: `backend/agent/agent/turn_state.py`
- Modify: `backend/agent/agent/manus.py:157-162`（PrivateAttr 替换）+ flag 读写点（289/581-586/1157-1161/1600-1602/1650/1663-1669/1718/1985/2335）
- Test: `backend/tests/test_turn_state.py`（新建）

**Interfaces:**
- Produces: `TurnExecutionState`（字段：`pending_immediate_stream: Optional[dict]`、`pending_edit_tool_call: Optional[dict]`、`pending_resume_patches: List[dict]`、`finish_after_load_resume_tool: bool`、`read_only: bool`；方法：`queue_patch(patch: dict)`、`drain_patches() -> List[dict]`、`reset_for_new_turn()`）；Manus 持 `_turn: TurnExecutionState = PrivateAttr(default_factory=TurnExecutionState)`
- Consumes: 无

- [ ] **Step 1: 写 turn_state.py + 失败测试**

```python
# backend/agent/agent/turn_state.py
"""单轮执行状态（Wave 2a-S1）：收拢原 Manus 5 个散落 PrivateAttr flag。

注意 pending_resume_patches 非严格单轮（轮内产生、发射时 drain、异常残留
跨轮——语义保持现状，见 spec 锁定决策 D3/D8），reset_for_new_turn 不清它。
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class TurnExecutionState:
    pending_immediate_stream: Optional[Dict[str, Any]] = None
    pending_edit_tool_call: Optional[Dict[str, Any]] = None
    pending_resume_patches: List[Dict[str, Any]] = field(default_factory=list)
    finish_after_load_resume_tool: bool = False
    read_only: bool = False

    def queue_patch(self, patch: Dict[str, Any]) -> None:
        self.pending_resume_patches.append(patch)

    def drain_patches(self) -> List[Dict[str, Any]]:
        patches = list(self.pending_resume_patches)
        self.pending_resume_patches = []
        return patches

    def reset_for_new_turn(self) -> None:
        self.pending_immediate_stream = None
        self.pending_edit_tool_call = None
        self.finish_after_load_resume_tool = False
        self.read_only = False
        # patches 不清：保持现状跨轮残留语义（D3）
```

测试（test_turn_state.py）：`test_drain_patches_fifo_and_empties` / `test_reset_keeps_patches` / `test_reset_clears_flags`。

- [ ] **Step 2: 跑新测试确认通过**（dataclass 纯逻辑，直接绿）
- [ ] **Step 3: Manus 接入**——删 157-162 五个 PrivateAttr，加 `_turn` PrivateAttr；5 个旧名以 property getter/setter 委托 `self._turn.*`（Pydantic v1 模型上普通 property 可用，需先跑冒烟验证）；`queue_resume_patch`/`drain_resume_patches` 方法体改为委托 `self._turn`
- [ ] **Step 4: 全量测试 + import 冒烟**（`python -c "import backend.main"` + 6 套 66 条 + test_turn_state）
- [ ] **Step 5: Commit** `refactor(agent): Wave 2a-S1 TurnExecutionState 收拢 5 个散落 flag`

### Task 2 (S2): PromptBuilder

**Files:**
- Create: `backend/agent/agent/prompt_builder.py`
- Modify: `backend/agent/agent/manus.py:1327-1548`（_generate_dynamic_prompts / _format_resume_for_context / _build_skill_addendum / _read_skill_excerpt / _generate_next_step_prompt）
- Test: `backend/tests/test_prompt_builder.py`（新建，golden 对拍）

**Interfaces:**
- Produces: `PromptBuilder(skills_root: Path, resume_provider: Callable[[], Optional[dict]])`，方法与原同名（`format_resume_for_context()` / `build_skill_addendum(user_input)` / `generate_next_step_prompt(intent)` 等）
- Consumes: Task 1 的 `_turn.read_only`（如 prompt 分支需要）

- [ ] **Step 1: 迁移前捕获 golden**——写脚本对组合矩阵（有/无简历 × read_only × add-experience × office/skill 关键词）调用旧方法录制输出为 fixture（**执行时先核实哪些方法含 LLM 调用**：`_generate_dynamic_prompts` 若调 LLM，则只迁纯拼装部分，LLM 调用留在 Manus 编排层——计划内置此分叉）
- [ ] **Step 2: 写 golden 测试（红）**——PromptBuilder 尚不存在
- [ ] **Step 3: 搬运方法到 PromptBuilder**，Manus 改为构造 builder 并调用；删旧私有方法
- [ ] **Step 4: golden 全绿 + 全量测试**
- [ ] **Step 5: Commit** `refactor(agent): Wave 2a-S2 PromptBuilder（golden 对拍锁定）`

### Task 3 (S3): ResumeUseCases

**Files:**
- Create: `backend/agent/agent/resume_use_cases.py`
- Modify: `backend/agent/agent/manus.py`——迁出：诊断（349-550：_extract_resume_meta/_build_resume_diagnosis_payload）、优化全家桶（551-1110：patch 队列改走 _turn、4 个 JSON 容错解析、_llm_optimize_section_patch/_llm_optimize_field_patch/_optimize_whole_resume/_queue_optimization_patches/建议块拼装）、委托分析（241-283+301-343：delegate_to_agent/_parallel_delegate_analyzers/_resolve_analyzers_by_section/_format_analysis_report）。**`execute_tool` override（284-300）read-only 拦截原地不动**
- Test: `backend/tests/test_resume_use_cases.py`（新建：4 个 JSON 解析函数单测搬家 + 队列入 _turn 断言）

**Interfaces:**
- Produces: `ResumeUseCases(llm, session_id, shared_state, turn_state, agents_registry)`，方法：`diagnose(...)` / `optimize_section(...)` / `optimize_field(...)` / `optimize_whole(...)` / `analyze(section)`
- Consumes: Task 1 `TurnExecutionState.queue_patch`

- [ ] **Step 1: 写 JSON 解析函数单测（对旧静态方法，绿）**——先锁行为
- [ ] **Step 2: 搬运 + Manus 瘦身**（think() 内调用点改 `self._use_cases.*`；qwq 流闭包改持 use_cases + turn_state）
- [ ] **Step 3: 单测改指向新家（等价断言不变）+ 全量测试**
- [ ] **Step 4: Commit** `refactor(agent): Wave 2a-S3 ResumeUseCases（诊断/优化/分析迁出）`

### Task 4 (S4-pre): 白盒测试等价迁移

**Files:**
- Modify: `backend/tests/test_intent_send_guard.py:149-165` 附近（两处 `inspect.getsource(Manus.think)` 字符串断言）

**Interfaces:** 无新接口；产出行为等价测试

- [ ] **Step 1: 读懂两条白盒断言保护的行为**（`_llm_first_routing_enabled` 让权顺序 / `让权` 日志语义）
- [ ] **Step 2: 写行为等价测试**（构造输入断言路由结果/让权行为，不 inspect 源码）；red-green：新旧测试对当前代码同绿，注释记录等价关系
- [ ] **Step 3: 删旧白盒断言，全量测试**
- [ ] **Step 4: Commit** `test(agent): Wave 2a-S4pre 白盒源码断言迁移为行为等价测试`

### Task 5 (S4): IntentRouter + ToolInvocationBuilder，think() 编排化

**Files:**
- Create: `backend/agent/agent/intent_router.py`、`backend/agent/agent/tool_invocation_builder.py`
- Modify: `backend/agent/agent/manus.py:1587-2280`（think 主体）+ 2281-2420（_handle_direct_tool_call）
- Test: `backend/tests/test_intent_router.py`（决策表）

**Interfaces:**
- Produces: `FastPathDecision(reply, finish)` / `DirectToolDecision(tool, tool_args, finish_after_tool, intent_source)` / `LlmFirstDecision(enhanced_query, yield_reason)`；`IntentRouter.decide(user_input, ctx) -> RouteDecision`（**async**；契约：每轮恰好调用 `conversation_state.process_input()` 一次，turn_count 推进归 decide）
- Consumes: Task 1 `_turn`、Task 3 `_use_cases`

- [ ] **Step 1: 决策表测试先行（红）**——从现有 think() 行为反推 fixture：Greeting、Load、Edit、优化确认、只读查询、复合请求、无简历引导等每类 ≥1 条
- [ ] **Step 2: 搬运判定逻辑到 decide()**；direct tool call 构造到 ToolInvocationBuilder；think() 改 `decision = await router.decide(...)` + dispatch（目标 ≤150 行）
- [ ] **Step 3: 决策表绿 + 全量测试 + E2E 四条 fast-path**
- [ ] **Step 4: 清理 S1 遗留**——Manus 内部使用点全部改 `self._turn.*`，删除**除 `_pending_immediate_stream` 外**的 property 委托（该项保留到 2b-B1，注释标注）
- [ ] **Step 5: Commit** `refactor(agent): Wave 2a-S4 IntentRouter/ToolInvocationBuilder，think() 编排化`

### 收尾（每任务后重复 + 全波终检）

- [ ] wc -l manus.py ≤600（终检）
- [ ] `cd frontend && npm run build`
- [ ] 起 9100+3000+5173，Codex review 代码 + 浏览器实测全链路（对话/生成/patch/应用/建议按钮/发邮件让权）
- [ ] 推分支 `feature/agent-arch-wave2a`，issue task run 回填
