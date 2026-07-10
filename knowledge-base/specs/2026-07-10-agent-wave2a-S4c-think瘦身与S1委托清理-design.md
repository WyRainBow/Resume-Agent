# Wave 2a · S4c —— think() 瘦身与 S1 property 委托清理 · 设计方案

- **日期**：2026-07-10
- **分支**：`feature/agent-arch-wave2a`
- **发起人**：主 session（守门人）→ 本文档由调研 agent 产出，**仅方案设计，不写代码、不 commit、不改任何文件（除本 spec 外）**
- **状态**：方案待批准（未实施）
- **关联**：
  - 原始计划 `knowledge-base/plans/2026-07-10-agent-wave2a-plan.md` Task 5 (S4) Step3/Step4 + 收尾章节
  - 总体设计 `knowledge-base/specs/2026-07-10-agent-wave2-refactor-design.md`
  - 已落地前置：S4a `bf7b7b4d`（IntentRouter）、S4b `7551c320`（ToolInvocationBuilder）
- **背景**：Task5 已完成 S4a（意图判定收口 `IntentRouter.decide()`）、S4b（5 处手工 ToolCall 构造收口 `ToolInvocationBuilder` + `_apply_invocation()`）。剩余 Step3（决策表绿 + 全量测试 + E2E 四条 fast-path）、Step4（清理 S1 property 委托）、以及收尾全波终检尚未做。本文即 Task5 收尾（S4c）的方案。

---

## 一、先纠一个原始数据偏差（已重新核实）

任务书称 “think() 目前约 823 行”。**实测不成立**：

- `think()` 起于 `manus.py:627`（`async def think`），止于 `manus.py:1228`（`return await super().think()`），下一个方法 `_handle_direct_tool_call` 起于 1230。
- 实际长度 = **1228 − 627 + 1 = 602 行**（含 method 内 4 个内嵌 async/def 闭包）。
- 823 应为把 think() 尾巴误算到 `_handle_optimize_confirm` 一带的旧数字。后文一律以 **602 行** 为基线。

manus.py 总行数 1490 已核实。全波终检目标 “wc -l manus.py ≤600” 仍成立（见 §6 提醒：≤600 是波级目标，非 S4c 单独能达成）。

---

## 二、think() 602 行构成分析（分段 + 分类）

分类口径：
- **(a) 薄 dispatch**——已是 `decide → 调用 builder/use_case → _apply_invocation` 形态，不需再动；
- **(b) 有搬迁空间**——判定/构造/编排逻辑仍留在 think()，可继续抽到 IntentRouter / ToolInvocationBuilder / ResumeUseCases；
- **(c) 胶水**——流程控制 / memory 扫描 / 日志 / 异常边界，搬不动，但可用「提私有 helper」压缩。

| # | 行号区间 | 行数 | 这块在干什么 | 分类 |
|---|---|---|---|---|
| 1 | 627–638 | ~12 | docstring + 前置 setup（`_get_last_user_input` / `_sync_turn_read_only_flag` / `_sync_resume_loaded_state`） | (a) |
| 2 | 640–651 | ~12 | `_pending_edit_tool_call` 两阶段编辑 dispatch（先反馈后执行工具） | (a) |
| 3 | 653–699 | ~47 | EDIT_CV 按值替换规则快路径：`_extract_replace_request` → `_resolve_company_path_by_value` → 构造 `_pending_edit_tool_call` + 手写 Thought/Response + `_last_intent_info` | **(b)** 判定属 IntentRouter，构造属 ToolBuilder |
| 4 | 701–712 | ~12 | LOAD_RESUME `_finish_after_load_resume_tool` 收敛：反扫 memory 找 show_resume/cv_reader_agent tool 消息后 FINISH | (c) 可提 `_check_load_resume_finish()` |
| 5 | 714–767 | ~54 | 防重复编辑收敛（3 小块）：①「已完成字段修改」标记 ②本轮 user 之后出现 cv_editor_agent tool 结果就 FINISH。含两段 memory 反扫 + role 兼容判断 | (c) 可提 `_check_edit_completion_finish()` |
| 6 | 769–795 | ~27 | `_ensure_conversation_state_llm` + `IntentRouter.decide()` 调用 + `compound_hint` 系统提示 | (a) 薄 dispatch（S4a 成果） |
| 7 | 796–805 | ~10 | enhanced_query 写回：反扫找最后 user 消息更新 content | (c) 可提 `_apply_enhanced_query()` |
| 8 | 807–816 | ~10 | 优化确认快路径：`_looks_like_optimize_confirm` → `_handle_optimize_confirm` | (a) |
| 9 | 818–834 | ~17 | ANALYZE/OPTIMIZE/FULL 分支入口 + 无简历 → `build_show_resume_hint` 引导 | (a)/(b) 入口薄，snapshot 取值是共享态 |
| 10 | 835–947 | ~113 | **ANALYZE_RESUME**：Phase1 询问岗位（`build_diagnosis_phase1` 薄）+ Phase2 `_parallel_delegate_analyzers`/`_build_resume_diagnosis_payload` + `build_diagnosis_phase2`（EMIT_ONLY）+ **qwq-plus 流式生成段（879–947，含 `_on_thinking`/`_on_content`/`_run_qwq` 闭包 + 写 `_pending_immediate_stream`）** | **(b)** 编排可搬；**qwq 流闭包 (c/b) 是 SSE 敏感区** |
| 11 | 949–1139 | ~191 | **OPTIMIZE_SECTION**：6 步路由（whole explicit/soft → section 精确命中 → skills/selfEvaluation 单字段 → section-kind 收窄 → 泛化澄清 → 单段优化+引导），内嵌 `_finish_optimize` 闭包，大量调 `_use_cases.*` | **(b)** 最大单块搬迁点 |
| 12 | 1141–1152 | ~12 | **FULL_OPTIMIZE**：`_optimize_whole_resume` → FINISH | (a) 薄 |
| 13 | 1153–1154 | ~2 | 上述 try 的 except：告警 + 回落 LLM 路径 | (c) 异常边界，须保留语义 |
| 14 | 1156–1167 | ~12 | `_last_intent_info` 落库 | (c) 可提 helper |
| 15 | 1169–1189 | ~21 | `_just_applied_optimization` 收敛：查 cv_editor_agent “Successfully updated” 后 FINISH | (c) 可提 `_check_just_applied_finish()` |
| 16 | 1191–1217 | ~27 | GREETING 快路径：LLM ask + fallback | (b)/(c) 可提 `_run_greeting_fast_path()` |
| 17 | 1219–1221 | ~3 | LOAD_RESUME direct tool dispatch | (a) 薄 |
| 18 | 1223–1228 | ~6 | 其他意图 → `_generate_dynamic_prompts` + `super().think()` | (a) 薄 |

### 核心结论（数量级）

- **(a) 已薄、不必动**：段 1/2/6/8/9入口/12/17/18 ≈ **80–90 行**（含 decide 调用块），这是编排壳该有的骨架。
- **(b) 值得继续搬进协作对象**：段 3（staged-edit ~47）+ 段 10 ANALYZE 编排（~113，其中 qwq 流 ~68 属敏感子块）+ 段 11 OPTIMIZE_SECTION（~191）≈ **350 行**——**这才是 think() 臃肿的主因，单靠 S4a/S4b 没覆盖到**（S4a 只搬意图判定、S4b 只搬 ToolCall 纯构造，业务分支编排全留在 think()）。
- **(c) 搬不动、但可用私有 helper 压缩**：段 4/5/7/13/14/15/16 ≈ **160 行**，其中纯流程控制的 memory 反扫收敛块（4+5+15 ≈ 87 行）压成 3 个 `_check_*_finish()` 后，think() 里只剩 ~10 行 dispatch。

**推算**：把 (b) 中 OPTIMIZE_SECTION（191）+ ANALYZE 编排（除 qwq 外约 45）+ staged-edit（47）搬出 ≈ −280 行；(c) 收敛块提 helper 再省 ≈ −70 行 → think() 落到 **~250 行**。若再把 qwq 流段（68）也搬走，可进一步到 **~180 行**；要压到严格 ≤150，还需把 GREETING 段和 enhanced_query/last_intent_info 也 helper 化。**能到 ≤150，但代价是动到 SSE 敏感的 qwq 段**——这正是分阶段决策的关键权衡（§4）。

---

## 三、property 委托清理方案（S1 遗留）

计划 Step4：内部使用点全改 `self._turn.*`，删除**除 `_pending_immediate_stream` 外**的委托（后者 AgentStream 直读，保留到 2b-B1）。

### 3.1 待删 4 组委托的内部使用点统计（已 grep 核实，全部在 manus.py，无跨文件）

| 委托名 | manus.py 内部使用点（行） | 处数 | 改写目标 |
|---|---|---|---|
| `_finish_after_load_resume_tool` | 271（`_apply_invocation`）、703、709 | **3** | `self._turn.finish_after_load_resume_tool` |
| `_pending_edit_tool_call` | 640、641、642、690 | **4** | `self._turn.pending_edit_tool_call` |
| `_pending_resume_patches` | **无**（仅 property 定义自身；`queue/drain` 已走 `self._turn.*`；AgentStream 走 `drain_resume_patches()` 方法而非属性） | **0** | 直接删 property，零改写 |
| `_current_turn_read_only` | 344、409、411、413、758 | **5** | `self._turn.read_only`（344/758 是 `getattr(self, "_current_turn_read_only", False)`，删 property 后 dataclass 字段恒存在，简化为 `self._turn.read_only`） |

- **改写总量 = 3 + 4 + 0 + 5 = 12 处**，全在 manus.py 单文件。
- **删除量**：4 组 getter/setter（`manus.py:175–189`、`199–213`）≈ **40 行**净删；`_pending_immediate_stream` 那组（191–197）**保留**。

### 3.2 风险评估

- **测试白盒依赖**：已 grep 全 `backend/`——除 `turn_state.py` docstring 注释与 manus.py 自身外，**无任何测试引用这 4 个委托名**；`test_intent_router.py` 不碰；`inspect.getsource` 白盒断言在 Task4(S4-pre) 已迁除（`grep getsource backend/tests` 为空）。故**不存在类似 `_llm_first_routing_enabled` 让权顺序断言那种白盒耦合**。
- **`getattr` 兜底移除**：344/758 的 `getattr(..., False)` 原为防 property 未初始化；删 property 后 `_turn` 由 `PrivateAttr(default_factory=TurnExecutionState)` 恒初始化、`read_only` 有默认 `False`，直读安全，顺手清掉 getattr 兜底（符合 CLAUDE.md §2.1「不留无意义防御分支」，且属自己改动产生的孤儿）。
- **AgentStream 契约不动**：`_pending_immediate_stream`（agent_stream.py:722–724 直读）委托保留，行为零变化。
- **结论**：这是**零行为风险、纯机械替换**的一步，是全 S4c 里最安全、可独立落袋的改动。

---

## 四、方案对比（一次性 vs 分阶段）

### 方案 A：一次性把 think() 打到 ≤150（单 commit）

property 清理 + OPTIMIZE_SECTION 抽取 + ANALYZE 编排抽取（含 qwq 流）+ 收敛块 helper 化 + GREETING helper 化，全部一把梭进一个 commit。

- 优点：一步到位达 Step2 “think()≤150” 目标。
- 缺点：diff 巨大难 review；qwq 闭包 + `self.state`/`_pending_immediate_stream` 耦合一起动，**行为等价性风险集中爆发**；一旦诊断流出问题难定位回滚点；必须搭 browser 实测才敢称完成。违背 CLAUDE.md §2.3「外科式修改」与 §2.2「简单优先」。

### 方案 B：分阶段（推荐，2–3 个 commit）

| 阶段 | 内容 | 风险 | 验证 | think() 增量 |
|---|---|---|---|---|
| **S4c-1** | property 委托清理（12 处 → `self._turn.*`，删 3 组 property）+ 无争议收敛块提私有 helper（`_check_load_resume_finish` / `_check_edit_completion_finish` / `_check_just_applied_finish` / `_apply_enhanced_query` / `_store_intent_info`） | **低**（纯内部、无 SSE 变化、无测试白盒依赖） | 全量 pytest + import 冒烟 | −40（删 property）+ 收敛块 ~−70 |
| **S4c-2** | OPTIMIZE_SECTION 6 步路由抽到 `ResumeUseCases.route_optimize_section(...)`，返回 typed 决策（reply/finish/patch_count），think() 只留 dispatch；staged-edit 判定并入 IntentRouter、构造并入 ToolBuilder | **中**（不碰 qwq/SSE，只涉优化文案与 patch 队列） | 全量 pytest + `test_resume_use_cases` 扩条 + E2E Edit/优化确认 | ~−230 |
| **S4c-3**（条件执行） | ANALYZE 诊断编排 + qwq 流段抽到 `ResumeUseCases.run_diagnosis(...)`，由 use_case 经已持有的 `turn_state` 写 `_pending_immediate_stream` | **高**（SSE 敏感：thinking_stream 时序、闭包捕获、`self.state` 归属） | pytest + **必做 browser 实测诊断流** | ~−70 |

- 优点：每步可独立验证/回滚；低风险 property 清理先落袋（独立价值）；qwq 敏感区隔离在最后一步，可单独定夺是否值得为 ≤150 冒 SSE 风险；review 聚焦。契合 CLAUDE.md 主线（外科式 + 简单优先 + 分步验证）。
- 缺点：3 个 commit，节奏略慢；若 S4c-3 不做，think() 停在 ~230 行，未达 Step2 严格 ≤150。

### 方案 C：只做低风险项，≤150 降级为技术债

只落 S4c-1 + S4c-2（think() ~230 行），**明确保留 qwq 流段在 think() 内**，把 “think()≤150” 记为技术债转交 2b（B1 搬 AgentStream 时 qwq/`_pending_immediate_stream` 本就要重排，届时一并处理更自然）。

- 优点：最小风险、最快交付、完全不碰 SSE、零 browser 实测负担。
- 缺点：未达 plan Step2 字面目标，需在文档/收尾明确登记技术债。

### 推荐：方案 B，且 S4c-3 视风险预算决定做不做（不做即退化为方案 C）

理由：
1. **CLAUDE.md 纪律优先**——「外科式修改」「简单优先」明确反对把敏感与非敏感改动揉进一个大 commit；方案 A 把 qwq 闭包和一堆纯内部搬迁绑死，风险不成比例。
2. **qwq 流段是 SSE 敏感区**——它写 `_pending_immediate_stream` 供 AgentStream 消费（spec D1/D2 明确该字段是 2a→2b 的接口），S4a/S4b 都是「纯内部、pytest 即可」的先例，唯独 qwq 段一旦动就跨进 SSE 可见行为，验证成本陡增。隔离成 S4c-3 让「要不要为 ≤150 付 browser 实测代价」成为一个可单独拍板的决策，而不是被裹挟。
3. **property 清理零风险且有独立价值**——先落 S4c-1，即便后续阶段推迟也已消除 S1 过渡债。
4. **≤150 是 Step2 目标，非波级硬终检**——波级硬终检是 manus.py≤600（见 §6），think() 停在 ~230 行不阻塞波级目标；ANALYZE/OPTIMIZE 编排搬进 use_cases 反而直接为 ≤600 贡献行数。

---

## 五、风险点（重构时最易破坏行为等价性处）

1. **跨分支共享局部变量**：`intent/tool/tool_args/intent_source/enhanced_query`（route 解构）、`resume_data_snapshot`（824 行 try 内计算，ANALYZE/OPTIMIZE/FULL 三分支共用）、`section`（822）。抽方法时必须显式传参，不能靠闭包隐式捕获，否则漏传即行为漂移。
2. **qwq 流闭包捕获**（S4c-3 专属）：`_on_thinking`/`_on_content`/`_run_qwq` 捕获 `thinking_q`/`content_q`/`_sentinel`/`diagnosis_payload`/`resume_meta`/`self.llm`/`DASHSCOPE_API_KEY`；`_pending_immediate_stream` 是与 AgentStream 的唯一 handoff。搬进 `ResumeUseCases.run_diagnosis` 时应让 use_case 经**已持有的 `turn_state`**（`initialize_helper` 已注入 `turn_state=self._turn`）直接 set，而非返回给 think() 再 set——但 `self.state = FINISHED` 归 Manus，须以 EMIT_ONLY 语义交回 `_apply_invocation` 处理，别在 use_case 里碰 Manus.state。
3. **try/except 边界（1153–1154）**：包住整个 ANALYZE/OPTIMIZE/FULL 大块，异常时告警并**回落到 LLM 路径**（继续往下走 `_last_intent_info` + `super().think()`）。抽方法后 except 的「fall-through 而非 return」语义必须逐字保留，否则异常时行为从「回落 LLM」变成「直接结束」。
4. **`_finish_optimize` 闭包（960）**：写 memory + `self.state=FINISHED` + `return False` 三合一，被 OPTIMIZE_SECTION 6 步复用。抽到 use_case 后不能再直接 set `self.state`；应改成返回 `(reply, finish=True)` 由 think()/`_apply_invocation` 落地——这是 S4c-2 的核心接口设计点。
5. **memory 反扫的 role 兼容**：多处 `role.value if hasattr(...) else str(role)` 兼容枚举/字符串。提 helper 时原样搬，别顺手「简化」成单一形态（CLAUDE.md §2.3 不重构没坏的东西）。
6. **优化确认快路径顺序**（807–816）：`_looks_like_optimize_confirm` 判定必须仍在 ANALYZE/OPTIMIZE 大块**之前**，否则「应用优化」会被 OPTIMIZE_SECTION 路由劫持。抽取时保持分支相对顺序。

---

## 六、验证计划（对应 CLAUDE.md 阶段三）

### 6.1 全量 pytest（每阶段收尾必跑）

计划 Global Constraints 锁定的 6 套 66 条 + 本波新增单测：

```
.venv/bin/python -m pytest \
  backend/tests/test_stream_event_protocol.py \
  backend/tests/test_agent_session_lifecycle.py \
  backend/tests/test_structured_passthrough.py \
  backend/tests/test_resume_events.py \
  backend/tests/test_send_resume_email_tool.py \
  backend/tests/test_intent_send_guard.py \
  backend/tests/test_intent_router.py \
  backend/tests/test_turn_state.py \
  backend/tests/test_prompt_builder.py \
  backend/tests/test_resume_use_cases.py
```

- **行为测试零修改通过**是硬约束（协议快照断言尤其不许动）。
- S4c-2 若给 `route_optimize_section` 定新接口，在 `test_resume_use_cases.py` 补决策条目（对新家断言，等价关系写注释）。

### 6.2 E2E 四条 fast-path（Step3 要求）——已核实具体是哪四条

来源：总体 spec `2026-07-10-agent-wave2-refactor-design.md:180`「E2E 覆盖 Greeting/Load/Edit/优化确认四条 fast-path」。即：

1. **Greeting**——「你好」→ 走 GREETING 快路径，不带工具直接 LLM 回复（think 段 16）。
2. **Load**——「加载/选择简历」→ LOAD_RESUME direct tool（`should_use_tool_directly`）+ `_finish_after_load_resume_tool` 收敛（段 4/17）。
3. **Edit**——按值替换 staged-edit（段 3）或 EDIT_CV direct tool，两阶段「先反馈后执行」不被重复触发（段 2/5）。
4. **优化确认**——「应用/写回上一轮优化」→ `_looks_like_optimize_confirm` → `_handle_optimize_confirm` → `build_apply_optimization`（段 8）。

每条断言：intent 落点、tool_calls、memory 收敛、最终 `state`/返回值与重构前一致。

### 6.3 是否需要起服务 browser 实测——按阶段判定

**判据**：改动是否触及 SSE / 前端可见行为。

- **S4c-1（property 清理 + 收敛 helper）**：纯内部结构调整，`_apply_invocation` 落地路径、SSE 事件、`_pending_immediate_stream` 契约全不变。**援引 S4a/S4b 先例（纯内部、pytest 即验证），不强制 browser 实测**，pytest 全绿 + import 冒烟即可。
- **S4c-2（OPTIMIZE/staged-edit 搬迁）**：只重排优化文案与 patch 队列生成的**宿主位置**，产出的 SSE 事件（resume_patch/建议按钮 `%%SUGGESTIONS%%`）内容不变——原则上 pytest 可覆盖，但因涉及「建议按钮/patch」这类前端强交互，**建议**跑一次 browser 冒烟（对话→优化某段→看建议卡与 patch 应用）以防文案/顺序漂移；非硬性。
- **S4c-3（qwq 诊断流搬迁）**：**触及 SSE 敏感区（thinking_stream 时序）**，**必须**起服务 browser 实测诊断全链路（对话→触发诊断→Phase1 询问→Phase2 流式报告 thinking/answer 落地）。这是该阶段做与不做的成本分水岭。

### 6.4 收尾（全波终检，非 S4c 单独负责，但需登记）

- `wc -l manus.py ≤600`：**S4c 贡献** = property 删除（~−40）+ OPTIMIZE/ANALYZE 编排搬进 `ResumeUseCases`（净移出 manus.py ~−260）。但 manus.py 现 1490，到 600 缺口 ~890 行——**S4c 不足以独达**，尚有 `_extract_replace_request`/`_resolve_*`/`_to_plain_text`/`_dedupe_lines`/`_sanitize_*`/`_is_*_optimization_text`（419–578 一带约 160 行文本处理 helper）等仍可迁 use_cases/文本 utils。**本文明确：≤600 是波级终检，S4c 只承担 think 瘦身与 property 清理那一部分贡献，剩余缺口留波级收尾或后续步骤处理，不由 S4c 强行凑数。**
- `cd frontend && npm run build`：S4c 纯后端改动，不涉前端，build 仅作回归确认。
- 推分支 `feature/agent-arch-wave2a`：交主 session 决定，S4c 各阶段独立 commit。

---

## 七、明确不做的事（CLAUDE.md 简单优先）

1. **不动 `_pending_immediate_stream` 委托**——保留到 2b-B1（spec D2），AgentStream 直读契约不碰。
2. **不重写业务逻辑**——OPTIMIZE_SECTION 6 步、ANALYZE 两阶段、诊断 prompt 全文属**纯搬运**，一字不改语义（Wave 2a 铁律「纯搬运不重写」）。
3. **不为 ≤150 硬凑**——若 S4c-3 的 SSE 风险/browser 实测成本不划算，接受 think() 停在 ~230 行并登记技术债转 2b，不为达标而把 qwq 段拆得支离破碎。
4. **不顺手清理相邻死代码**——如发现 role 兼容、getattr 之外的可疑冗余，**指出但不删**（§2.3）；仅清理自己搬迁产生的孤儿 import/闭包。
5. **不改测试断言语义**——行为测试零修改；新单测只对「新家」加等价断言，不动老快照。
6. **不引入新协作对象**——复用既有 `IntentRouter`/`ToolInvocationBuilder`/`ResumeUseCases`，不为 think 瘦身再造第五个类（§2.2 不为单场景引抽象）。
7. **不碰 manus.py ≤600 缺口里 S4c 范围外的 helper 搬迁**——那是波级收尾的事，S4c 不扩张 scope。

---

## 八、决策留痕

| 编号 | 决策 | 取值 | 理由 |
|---|---|---|---|
| S4c-D1 | think() 实际行数基线 | 602 行（非任务书的 823） | 实测 627–1228 |
| S4c-D2 | 实施节奏 | 分阶段（方案 B），S4c-3 视风险预算 | 隔离 SSE 敏感 qwq 段，符合外科式修改 |
| S4c-D3 | property 清理归属 | 独立首个 commit（S4c-1） | 零风险、有独立价值、先落袋 |
| S4c-D4 | `_pending_resume_patches` 委托 | 直接删（0 内部使用点） | grep 证实无任何引用 |
| S4c-D5 | qwq 流 handoff 写法 | use_case 经 `turn_state` 写 `_pending_immediate_stream`；`state=FINISHED` 经 EMIT_ONLY 交回 Manus | state 归属 Manus，副作用不下沉 |
| S4c-D6 | `_finish_optimize`/异常边界 | 抽方法后改「返回决策」，except fall-through 语义逐字保留 | 防「回落 LLM」退化为「直接结束」 |
| S4c-D7 | browser 实测门槛 | S4c-1/2 pytest 即可（援引 S4a/S4b 先例）；S4c-3 必做 | 仅 qwq 段触及 SSE 可见行为 |
| S4c-D8 | think()≤150 vs manus.py≤600 | ≤150 是 Step2 目标可让位技术债；≤600 是波级终检，S4c 只贡献不独达 | 两目标层级不同，避免为字面达标牺牲安全 |
