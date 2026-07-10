# Wave 2 · Agent 架构重构设计（拆 Manus / AgentStream 适配器化 / 会话态收拢）

> 日期：2026-07-10（v2，吸收 Codex 设计 review）
> 前置：Wave 0/0.5/1.1（main：`a3003809`/`a3082cc7`/`a0ea6c1f`）、Wave 1.2（`feature/agent-arch-wave12`：`a0e1c10c`）
> 方案链路：Codex 架构分析（session `8c147ab2`）→ Claude 核验 → Codex 二轮 review → 用户批准 → **Codex 设计 review（v2 修订依据，2 致命 + 7 建议全部吸收）**
> 用户拍板：**分三个子波按序做（2a→2b→2c）**；**纯结构重构，外部行为零变化**

## 0. 目标与非目标

**目标**：把收敛发生在 `Manus` / `AgentStream` 内部的产品化逻辑，重塑为接缝清晰的模块，使"加一个意图 / 加一个用例 / 改一处 prompt"只动一个文件。

**非目标（本波明确不做）**：
- 不改 SSE 事件契约（Wave 1.2 已统一 envelope，本波只搬运不重设计）
- 不动 prompt 内容与 `%%SUGGESTIONS%%` 标记协议
- 不改任何工具行为、API shape、鉴权
- 不动 CLTP 过渡资产（`cltp/session_state.py` 等）
- 不修重构中发现的行为怪癖（只记录，例：AI 生成 latex 型简历预览不支持）

**验收铁律**：现有**行为测试**零修改通过（协议快照测试尤其不许动断言）；E2E 用户路径（登录→对话→生成→patch→应用→建议按钮）行为一致。
**白盒测试例外**（Codex review 致命问题 1）：`test_intent_send_guard.py` 中直接 inspect `Manus.think` 源码字符串的断言（如检查 `_llm_first_routing_enabled` / `让权` 字符串位置）属于源码位置耦合测试——S4 前先把这类断言**迁移为行为/决策表等价测试**（迁移需 red-green 证明等价），迁移本身作为独立提交，不与搬运混在一个 diff。

## 1. 现状实锤（2026-07-10，`feature/agent-arch-wave12` 分支：manus.py=2602 行，agent_stream.py=1426 行）

### 1.1 Manus 九个职责块（行号）

| 块 | 行号 | 内容 |
|---|---|---|
| 构造/工具装配 | 165-232 | initialize_helper / _build_tool_collection / _init_shared_state / _inject_tool_context |
| 委托分析 | 241-343 | delegate_to_agent / _parallel_delegate_analyzers / execute_tool(override) / _format_analysis_report |
| 诊断 payload | 349-550 | _extract_resume_meta / _build_resume_diagnosis_payload |
| 优化服务 | 551-1110 | 优化建议格式化、patch 队列、LLM JSON 容错解析（_strip_llm_thinking_prefix 等 4 个）、_llm_optimize_section_patch / _llm_optimize_field_patch / _optimize_whole_resume（内部并发）、建议块拼装 |
| 输入解析辅助 | 1113-1326 | 末条用户输入、只读判定、替换请求解析、路径解析、文本清洗 |
| 动态 prompt | 1327-1548 | _generate_dynamic_prompts / _format_resume_for_context / _build_skill_addendum / _generate_next_step_prompt |
| think() 主路由 | 1587-2280 | ~700 行：意图识别、fast-path（Greeting/Load/Edit/优化确认）、qwq 诊断流、LLM-first 让权 |
| 直接工具调用 | 2281-2420 | _handle_direct_tool_call / _build_load_resume_hint_message |
| 收尾/确认 | 2421-2562 | 优化确认、简历加载态同步、act(override) |

### 1.2 五个散落 flag

`_pending_immediate_stream`（dict，qwq 流参数）/ `_pending_edit_tool_call`（dict）/ `_pending_resume_patches`（list，队列）/ `_finish_after_load_resume_tool`（bool）/ `_current_turn_read_only`（bool）。跨方法读写、生命周期不明（有的每轮 reset、有的跨轮残留），是新增意图时最容易牵连出错的部分。

### 1.3 AgentStream 的执行语义

`execute()` 手写 step 循环：直接读写 `agent.memory.messages`、解析 `Thought:/Response:` 文本、answer 指纹去重、final answer 补发、`%%SUGGESTIONS%%` 提取（Wave 1.2 已收口到 `_make_suggestions_event`）、tool card 结构化透传、history 落盘。执行规则散在 `ToolCallAgent.act()` / `Manus.think()` / `AgentStream.execute()` 三处。

### 1.4 会话态现状（Wave 0.5 后）

`session_manager` 已收口 `_active_sessions` 操作；但 `ResumeDataStore`（类级字典×4）与 `AgentSharedState`（独立 per-session 实例）生命周期仍各自为政，靠 `discard_session` 里的显式 `clear_data` 调用维持一致。

## 2. 目标结构

```text
backend/agent/agent/
├── manus.py                 # ≤600 行：BaseAgent 生命周期 + think()/act() 编排壳 + 工具装配
├── turn_state.py            # 2a-S1  TurnExecutionState：单轮执行状态（5 个 flag 收拢）
├── prompt_builder.py        # 2a-S2  PromptBuilder：动态 system/next-step prompt、简历 context、skill addendum
├── resume_use_cases.py      # 2a-S3  ResumeUseCases：diagnose / optimize_section / optimize_field /
│                            #        optimize_whole / analyze（含 LLM JSON 容错解析私有函数）
├── intent_router.py         # 2a-S4  IntentRouter：输入 (user_input, conversation_state, store 状态)
│                            #        → RouteDecision（fast_path / delegate_llm / direct_tool / clarify）
├── tool_invocation_builder.py # 2a-S4 直接构造 tool_call 的逻辑
├── stream_runtime.py        # 2b    run_stream(): AsyncIterator[StreamEvent]，执行语义唯一所有者
└── toolcall.py / base.py    # 不动（execute_tool override 迁 use_cases 调用点）

backend/agent/web/
├── session_manager.py       # 2c    完全体：拥有 ResumeDataStore/SharedState 生命周期
└── streaming/agent_stream.py # 2b 后 ≤400 行：心跳/取消/SSE 封装/事件适配
```

### 2.1 关键接口（签名级）

```python
# turn_state.py
@dataclass
class TurnExecutionState:
    pending_immediate_stream: Optional[dict] = None
    pending_edit_tool_call: Optional[dict] = None
    pending_resume_patches: list = field(default_factory=list)   # 注意：非严格单轮，跨轮残留语义保持现状（D3）
    finish_after_load_resume_tool: bool = False
    read_only: bool = False
    def reset_for_new_turn(self) -> None: ...   # 明确哪些字段跨轮保留（patches 队列除外，见 D3）

# intent_router.py —— async + typed variants（Codex review 致命问题 2 + 建议 1）
# 路由依赖 ConversationStateManager.process_input()（async，且会推进 turn_count 等上下文状态）。
# 接口契约：decide() 每轮恰好调用 process_input 一次；其状态副作用（turn_count 推进、
# 意图历史记录）归属 decide()，调用方不得重复调用。
@dataclass
class FastPathDecision:      # 直接产生回复文本（Greeting/优化确认/澄清文案等）
    reply: str
    finish: bool
@dataclass
class DirectToolDecision:    # 后端替 LLM 构造 tool_call
    tool: str
    tool_args: dict
    finish_after_tool: bool
    intent_source: str
@dataclass
class LlmFirstDecision:      # 让权给 LLM（可携带增强查询/让权原因）
    enhanced_query: Optional[str]
    yield_reason: str
RouteDecision = Union[FastPathDecision, DirectToolDecision, LlmFirstDecision]

class IntentRouter:
    async def decide(self, user_input: str, ctx: RoutingContext) -> RouteDecision: ...
# RoutingContext 显式字段：last_user_input / resume_loaded / read_only /
# last_ai_message / conversation_state(引用，因 process_input 需要) / is_admin

# prompt_builder.py —— 非纯无状态：依赖以 provider 注入（Codex review 建议 2）
class PromptBuilder:
    def __init__(self, skills_provider, resume_provider, workspace_root): ...
    # golden 对拍覆盖组合：有/无简历 × 有/无 current_resume_path × read_only ×
    # add-experience 意图 × office/skill 关键词命中

# resume_use_cases.py
class ResumeUseCases:
    def __init__(self, llm, session_id, shared_state, turn_state): ...
    async def diagnose(...) -> DiagnosisPayload
    async def optimize_section(...) / optimize_field(...) / optimize_whole(...)
    async def analyze(section) -> str   # 委托 analyzer 并格式化报告（在 delegation/analysis 分支，
                                        # 非 execute_tool；execute_tool override 只保留 read-only 拦截，原地不动）

# stream_runtime.py (2b) —— context 对象而非散参（Codex review 建议 4）
@dataclass
class StreamRunContext:
    agent: Manus
    session_id: str
    state_machine: AgentStateMachine
    chat_history_manager: Any
    cancel_event: Optional[asyncio.Event]
async def run_stream(ctx: StreamRunContext) -> AsyncIterator[StreamEvent]: ...
```

依赖方向：`manus.py` → (`intent_router` / `prompt_builder` / `resume_use_cases` / `turn_state`)；反向禁止。`stream_runtime` → `manus`；`agent_stream` → `stream_runtime`。

## 3. 迁移步骤与不变量

### 2a 四步（每步独立 commit + 全量测试）

| 步 | 动作 | 不变量锁 |
|---|---|---|
| S1 | 5 个 flag → `TurnExecutionState`，Manus 持 `self._turn`；旧属性以 property 委托保留一个提交周期（AgentStream 有 `drain_resume_patches` 调用点） | 新增 turn_state 单测：reset 语义、patch 队列 FIFO |
| S2 | prompt 块整体搬 `PromptBuilder`（无状态，输入显式传参） | prompt 产出逐字符一致（golden 对拍测试：同输入新旧函数输出相等，迁移完删旧函数） |
| S3 | 诊断+优化+分析 → `ResumeUseCases`（analyzer 委托在 delegation/analysis 分支；`execute_tool` override 的 read-only 拦截**原地不动**） | 现有 optimize/diagnosis 相关测试零改动过；JSON 容错解析函数带单测搬家 |
| S4-pre | `test_intent_send_guard.py` 中 inspect `Manus.think` 源码字符串的白盒断言 → 迁移为行为/决策表等价测试（red-green 证明等价，独立提交） | 迁移前后对同一组输入行为断言一致 |
| S4 | `think()` 判定逻辑 → `IntentRouter.decide()`（async，typed variants）；direct tool call 构造 → `ToolInvocationBuilder`；`think()` 变成 `decide → dispatch` 编排 | E2E 全路径 + S4-pre 迁移后的行为测试零改动过 |

### 2b 两步

| 步 | 动作 | 不变量锁 |
|---|---|---|
| B0 | 先补**事件序列快照测试**（Codex review 建议 3）：普通回答 / tool_call+tool_result / queued resume_patch / `pending_immediate_stream` 诊断流 / stop·session_switch / step-tail suggestions 六场景，mock agent 驱动 `AgentStream.execute()` 录制事件序列作为 golden | 快照建立在搬运之前 |
| B1 | `AgentStream.execute()` 主体整体搬 `stream_runtime.run_stream(ctx)`（先搬运不重写），AgentStream 变薄壳 | B0 快照零改动过 + 协议快照测试 + E2E 事件序列一致 |
| B2 | 去重/final answer/history 落盘归 runtime 内聚（消 `_should_skip_complete_answer` 类补丁的散布） | 同上 + suggestions 只发一次测试 |

### 2c 一步

`session_manager` 增加 per-session 聚合条目（agent/resume_data/shared_state/jd/meta 同生命周期）；`ResumeDataStore` 静态方法改为查询 session_manager 的委托层，**只删 session 级类字典**（`_data_by_session` / `_meta_by_session` / `_jd_by_session` / `_shared_state_by_session`）；**全局 `_data` 路径原样保留**（无 session_id 的读写语义与测试不动，仅加 deprecated 注释）。工具侧 import 与调用签名零变化。锁：lifecycle 测试 11 条零改动过 + 新增"会话销毁后无任何残留"断言。

## 4. Grill 压测 · 锁定决策

- **D1 为什么不先做 2b 再拆 Manus？** think() 的 fast-path 直接操纵流式状态（`_pending_immediate_stream` 被 AgentStream 消费），先收拢 flag（S1）才能给 2b 一个稳定接口。顺序 2a→2b 依赖成立。
- **D2 property 委托层会不会永久留下来？** 不会：S1 加委托是为了让 S1 diff 最小；S4 结束时 `think()` 已改用 `self._turn.*`，AgentStream 在 2b-B1 改用 runtime 接口，届时删除委托 property，2a 分支合并前必须清零。
- **D3 patch 队列是"单轮"还是"跨轮"状态？** 代码证据：`queue_resume_patch` 由优化用例写入、`drain_resume_patches` 由 AgentStream 在事件发射时清空——同一 run 内生产消费，但 stop/异常中断时残留会漂到下一轮（现状 bug 味，但**本波不改行为**：`reset_for_new_turn` 不清 patches，保持现状语义，记录到后续）。
- **D4 IntentRouter 输入为什么不直接给 memory？** 给 memory 就是把"编排壳"又做厚。RoutingContext 显式列出所需字段（last_user_input / resume_loaded / read_only / last_ai_message），router 可单测。
- **D5 纯搬运会不会把坏味道一起搬？** 会，故意的。本波唯一目标是接缝；搬过去的 JSON 容错解析、文本清洗在新家有独立单测后，Wave 3+ 再简化。一次做两件事（搬+改）是重构事故的第一来源。
- **D6 ~700 行 think() 拆完剩什么？** decide() 分发 + qwq 流参数装配（qwq streaming 本体在 use_cases）+ 兜底 super().think() 调用，目标 ≤150 行。
- **D7 测试不够锁怎么办？** S2 用 golden 对拍（新旧同输出）；S4 分两步：S4-pre 先把 `test_intent_send_guard` 的白盒源码断言迁移为行为/决策表等价测试（red-green 证明等价、独立提交），再搬代码（Codex review 指出"零改测试"与"搬空 think"在白盒测试上不可兼得，故显式区分行为测试与白盒测试）。2b 用 B0 事件序列快照先锁再搬。
- **D8 patch 队列在术语上不叫"单轮状态"**（Codex review）：`TurnExecutionState.pending_resume_patches` 是"轮内产生、发射时消费、异常残留跨轮"的队列，术语表已标注非严格单轮；命名保留在 TurnExecutionState 内是位置收拢，不是语义宣称。

## 5. 测试与验收

- 每步：`pytest backend/tests/`（相关 6 套 66 条 + 各步新增）全绿；`npm run build` 过
- 每子波收尾：Codex review 代码 → Codex 浏览器实测（5173+3000+9100，登录 cocoyu 账号走全链路）→ 推 `feature/agent-arch-wave2x` 分支，不合 main
- 事件时序锁：Wave 1.2 的 `test_stream_event_protocol.py` 11 条零修改是 2b 的硬门槛

## 6. 风险登记

| 风险 | 等级 | 缓解 |
|---|---|---|
| S4 fast-path 与 LLM-first 让权交织，搬运时语义漂移 | 高 | 先写决策表测试再搬；E2E 覆盖 Greeting/Load/Edit/优化确认四条 fast-path |
| 2b 事件时序变化（异步 yield 点移动） | 高 | 先搬运不重写（B1/B2 分离）；协议快照 + E2E 双锁 |
| qwq 流回调闭包持有 Manus 私有状态 | 中 | S1 先收拢进 turn_state，闭包改持 turn_state |
| ResumeDataStore 静态接口的隐式全局依赖（无 session_id 的全局 _data 路径） | 中 | 2c 保留全局路径委托，标记 deprecated，不删 |
| 分支长期偏离 main | 低 | 每子波独立分支，及时推送 |
