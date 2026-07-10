# Agent 架构现状审计 + 外部范式调研

- **日期**:2026-07-11
- **分支**:`feature/agent-arch-wave2a`
- **背景**:Wave 2a(S1-S4c)重构完成后,用户提出核心问题——当前简历优化 Agent(`backend/agent/agent/manus.py` 的 `Manus`)是否存在过多"功能堆砌"式的硬编码路由,是否偏离了"垂直领域 Agent 该有的自主性/灵魂"。派两个只读子 Agent 并行调研:一个审计内部代码架构现状与技术债,一个调研业界最新 Agent 设计范式。本文档整理两份原始报告,供后续立项决策使用。

---

## 一、结论摘要(先看这个)

**最重要的发现**:`_llm_first_routing_enabled()`(manus.py:104-111)默认返回 `true`,`.env`/`config.toml` 均无覆盖。这意味着:

> **intent_router 的规则分支、`resume_use_cases.py` 全部 1172 行、`tool_invocation_builder.py` 的诊断/直调构造器、think() 里 782-877 和 916-917 两大块——在默认配置下都是不会被执行的死代码/休眠代码。**

而 Wave 2a 的 S3、S4c-1/2/3 三轮重构,恰恰是在精雕细琢这批默认不会跑的影子代码——搬得再干净、行为等价核对得再仔细,服务的都是一套已经被 LLM-first 开关短路的实现。真正在跑的只有三条路:GREETING 快路径、optimize-confirm、纯 LLM ReAct。

**这不代表重构做错了**(代码质量确实变好、行为也没破坏),而是**投入产出方向需要调整**——继续在这批代码上抠细节性价比很低。产品方向已经选了 agentic(2026-07-10 用户拍板所有意图都走 LLM),代码还没有为这个选择买单,现在最大的技术债不是"不够智能",而是"两套实现并存、且在维护那套已经被架空的"。

**优先级 3 件事**(内部审计给出,均以删除/简化为主,不是新增架构):

1. **【中】就 LLM-first 做一次性了断**——删除默认不可达的规则/分派代码,think() 能从 243 行塌缩到 ~80 行,manus.py 能砍掉一半
2. **【小】清理确认的死代码 + 工具目录残留**——4 处零 callsite 死函数,以及 `tool/__init__.py` 里导出但从未注册的 Bash/BrowserUseTool/WebSearch 等 ~2500 行通用工具残留
3. **【中偏大】`experience_entry.py`(1023 行)的目标段落模糊匹配退居 LLM 之后**——这是规则引擎里最重、最容易"优化错段"的部分,该交给 LLM 用注入的简历上下文自己判断

---

## 二、内部架构审计报告(子 Agent 原文,只读代码审计,未改动任何文件)

### 0. 一句话结论

**这个 Agent 在 2026-07-10 已经通过 `AGENT_LLM_FIRST_ROUTING=true` 切成了"LLM 自主编排",但团队没有删掉旧的规则/分派机器,反而在 Wave 2a(S3/S4c)里把这批"默认不会被执行"的代码精心重构进了漂亮的模块。** 于是现在的代码库同时背着两套简历处理实现:一套是运行时真正在跑的(LLM ReAct loop + 一份写得很好的 system prompt),另一套是 ~2500 行、默认死掉、只在回滚开关下才复活的规则引擎。产品方向已经选了 agentic,代码还没有为这个选择买单。

### 1. 整体架构图(请求进来 → 回到前端)

```
前端 /api/agent/stream
   │
   ▼
Manus(ToolCallAgent)  ── manus.py:114
   │  每个 step:think() → act()
   │
   ├─ think()  manus.py:682-924  ← 单轮调度中枢
   │    1. _get_last_user_input + _sync_turn_read_only_flag        (690-691)
   │    2. pending_edit_tool_call 两阶段编辑消费                     (695-706)
   │    3. IntentRouter.decide_staged_edit  「改X为Y」快路径         (711-730)
   │    4. _check_load_resume_finish / _check_edit_completion_finish (734-740)
   │    5. IntentRouter.decide()  ← 意图判定+让权守卫               (745-766)
   │    6. optimize-confirm 快路径                                  (773-780)
   │    7. ANALYZE / OPTIMIZE_SECTION / FULL_OPTIMIZE 分派           (782-877)
   │         └─ ResumeUseCases.{route_optimize_section,
   │              start_diagnosis_stream, _optimize_whole_resume}
   │    8. GREETING 快路径(直接 LLM 不挂工具)                        (888-913)
   │    9. LOAD_RESUME/EDIT_CV 直调工具 _handle_direct_tool_call     (916-917)
   │   10. 其它 → super().think()  ← 纯 LLM ReAct(看工具列表自选)    (921-924)
   │
   ├─ act()  manus.py:1146  → super().act() 执行 tool_calls,更新会话态
   │
   ▼
Tools (7个)  cv_reader_agent / show_resume / cv_analyzer_agent /
             cv_editor_agent / generate_resume / send_resume_email(admin) / ask_human
   │  ToolResult.system 里塞结构化 JSON
   ▼
AgentStream → SSE(tool_result / resume_patch / resume_updated) → 前端 useToolEventRouter
```

意图判定的真相在 `conversation_state.py:370` `process_input()` —— 它是一台**8 个 fast-path 分支**的规则机:粘贴导入守卫、快速问候、快速加载简历、新增经历、简单编辑、enhanced_intent 工具匹配、`_detect_agent_intent` 关键词分派、最后才 fallback 到 LLM 分类。

**哪些是"LLM 自主决策",哪些是"硬编码 if/elif,LLM 没被问"**:
- 硬编码路由:think() 第 3/6/7/9 步 + `process_input` 全部 8 个分支 + `_detect_agent_intent`(conversation_state.py:616-658,纯关键词 `"优化" in normalized`、`"全面优化" in normalized`…)
- LLM 自主:第 8 步 GREETING(LLM 生成但不挂工具)+ 第 10 步 `super().think()`(真正的 ReAct)

### 2. "功能堆砌 vs 真正 agentic" 诊断

#### 2.1 致命结构问题:默认配置下,大半规则/分派逻辑是死代码

`_llm_first_routing_enabled()`(manus.py:104-111)默认返回 `true`(`.env`/`config.toml` 无覆盖,已核实)。它进入 `IntentRouter.decide`:

```
intent_router.py:99-114
if self._llm_first_enabled() and intent not in (UNKNOWN, GREETING):
    yield_reason = "LLM-first"
    intent = Intent.UNKNOWN；tool=None；tool_args={}
```

也就是说 **ANALYZE_RESUME / OPTIMIZE_SECTION / FULL_OPTIMIZE / EDIT_CV / LOAD_RESUME 一律被改写成 UNKNOWN、tool 清空**。连锁后果(全部在默认配置下 **不可达**):

| think() 代码块 | 行号 | 默认下是否执行 | 涉及的"重构成果" |
|---|---|---|---|
| staged-edit 快路径 | 711-730 | **否**(`decide_staged_edit` 自守 llm_first→None,intent_router.py:186) | `build_staged_edit` |
| ANALYZE/OPTIMIZE/FULL 分派 | 782-877 | **否**(`intent in [...]` 恒不成立) | `ResumeUseCases` 几乎全部:`route_optimize_section`(6步~180行)、`start_diagnosis_stream`(qwq流)、`_optimize_whole_resume`、`build_diagnosis_phase1/2` |
| 直调工具 | 916-917 | **否**(tool 已被清空为 None) | `_handle_direct_tool_call`、`build_direct_tool_call` |

**真正在跑的路径只有三条**:GREETING 快路径(888-913)、optimize-confirm(773-780,唯一不看 intent 所以还活着)、纯 LLM ReAct(921-924)。

换句话说:`resume_use_cases.py` 整个 1172 行文件、`tool_invocation_builder.py` 里除 `build_apply_optimization` 外的构造器、`IntentRouter.decide_staged_edit`,**在生产默认开关下都是影子代码**。而 Wave 2a 的 S3/S4c-2/S4c-3 三个 commit(`f44e9f6e`/`3fc97c5f`/`3eee515b`)恰恰是在精雕细琢这批影子代码——把它们从 think() 搬进"干净的模块",注释里反复强调"纯搬运、逐行一致"。**这是典型的"给注定要删的东西做重构",投入产出方向错了**。

#### 2.2 规则引擎的规模与"改一处怕牵连别处"

即便不算死代码,规则层本身已经膨胀成一台准 NLP 引擎:
- `conversation_state.py` process_input 8 分支 + `_detect_agent_intent` 关键词表(631: `SEMANTIC_EDIT_KEYWORDS`、643: `_optimize_synonyms`)
- `domain/intent/`:`edit_rules.py`(205) + `intent_classifier.py`(331) + `tool_registry.py`(258) + `rule_matcher.py`(114) + greeting/load_resume rules ≈ 1000 行
- `experience_entry.py`:**1023 行、约 50 个函数**,专门做"用户说的是哪一段经历"的模糊匹配(`resolve_optimize_target`、`_score_entry_against_text`、`detect_optimize_section_kind`…)
- manus.py 模块级 3 套正则守卫:发送邮件守卫(65-71)、复合请求守卫(79-91)、诊断关键词兜底(intent_router.py:91)

这些规则做的事,**system prompt 已经用自然语言教给 LLM 了**(prompt/manus.py:47-59 的工具表、61-93 的生成/JD/润色分流、26-30 的"无简历弹 show_resume")。规则层是在用 Python 正则复刻一份 LLM 已经会做的判断——这是最典型的"把本该属于 Agent 智能的部分,变成越堆越大的规则引擎"。

#### 2.3 S4-pre 白盒测试 = 过度耦合的实锤

commit `45b701c4` 专门把两个测试从"`inspect` 源码字符串断言"迁成行为测试:
- `test_llm_first_wired_into_think_source`(断言 think() 源码里出现某字符串)
- `test_guard_wired_into_think_source`(断言守卫在 think() 源码的某个**位置**)

**测试要靠 `inspect` 去 think() 源码里查字符串/查位置**,这本身就是 think() 已经复杂到"只能用源码结构来锚定行为"的信号——正常的、职责清晰的代码不需要这种测试。commit message 自己承认这是"为 S4 搬空 think() 解除源码位置耦合(Codex review 致命问题 1)"。这说明团队自己也察觉到了 think() 的脆弱性,只是选择了"绕过测试耦合"而不是"消灭复杂度根源"。

### 3. 业务债务清单(文件:行号)

**A. 明确死代码(0 callsite,已核实)——可直接删**
- `manus.py:413-425` `_to_plain_text` — 无人调用
- `manus.py:397-411` `_resolve_primary_experience_text_path` — 无人调用
- `resume_use_cases.py:128-147` `_format_analysis_report` — 无人调用
- `resume_use_cases.py:93-96` `_run_delegated_analysis` — 无人调用

**B. 默认配置下的休眠代码(只在 `AGENT_LLM_FIRST_ROUTING=false` 复活)**
- `resume_use_cases.py` 全文 1172 行(诊断 payload/qwq 流/6步优化路由/整份优化/LLM JSON 四函数容错)
- `tool_invocation_builder.py:69-252`(除 `build_apply_optimization`)
- `intent_router.py:151-209`(staged-edit 判定)
- `manus.py:782-877`(分派块)、`manus.py:926-972`(`_handle_direct_tool_call`)
- 决策点:**要么承诺 LLM-first 删掉,要么承诺规则回退保留**。现状"两套都留"是最贵的选项。

**C. 文本 helper——分类处理,别一刀切拆**
这批(manus.py:413-510)只有 `_handle_optimize_confirm`(manus.py:1071-1118,且该路径是 optimize-confirm 唯一还活着的规则路径)在用:
- `_sanitize_optimization_text`/`_extract_response_body`/`_dedupe_lines`/`_is_reasonable_optimization_text`/`_is_actionable_optimization_text` — 各 1 callsite,全来自 optimize-confirm。
- **判断**:这些不该"继续拆去别的模块",那只会制造过度抽象。它们该跟着 `_handle_optimize_confirm` 一起,**要么整体归入 ResumeUseCases(因为它们本质是"优化文本清洗"业务逻辑),要么随 optimize-confirm 路径一起被 LLM-first 淘汰**。单独抽一个 `TextSanitizer` 类是典型的"为单次使用引入抽象",不要做。

**D. 过度防御 / 行为等价包裹**
- `intent_router.py` 整个类的存在理由之一是"注入让权规则函数,S4c 收口后再平移进本模块"(注释 73-74、204-205)——**注入 + "以后再搬"是为了保行为等价而临时搭的脚手架**,实际让权函数至今仍留在 manus.py 模块级(65-101)。这是重构中途状态的凝固。
- `manus.py:216-234` `_apply_invocation` 用一个 `DispatchOutcome` 三态枚举(CONTINUE/FINISH/EMIT_ONLY)来统一 5 个构造器的落地——为了"逐行行为等价"引入的间接层,服务的是默认不可达的代码。

**E. 未清理的通用工具残留**
`tool/__init__.py` 仍导出 `Bash / BrowserUseTool / WebSearch / StrReplaceEditor / PlanningTool / Crawl4aiTool / CreateChatCompletion`,`tool/` 目录里也留着 `computer_use_tool.py`(487) / `browser_use_tool.py`(576) / `web_search.py`(483) 等 ~2500 行。`_build_tool_collection`(manus.py:236-265)已经**明确不注册**它们(注释 238-241 写得很清楚"产品收敛只做简历优化")。工具不会被挂给 LLM,属于安全的死重量,但对读代码的人是噪音,且 import 链还在。

### 4. 和"简历优化 Agent 该有的样子"的差距

理想垂直 Agent ≈ **几个清晰工具 + 一份好的 system prompt + LLM 自主编排/追问**。好消息是:**这个项目其实已经拥有理想状态的全部零件**——
- system prompt(prompt/manus.py:19-120)写得相当好:产品语境、无简历分流、只读规则、生成/JD/润色的分流、cv_editor 富文本格式,全都用自然语言讲清楚了。这份 prompt 单独就能驱动 LLM 完成"读/展示/诊断/优化/编辑/生成/发邮件"。
- 7 个工具粒度合理(见 §5)。

差距**不在能力,在于没有删掉平行实现**。当前 = 理想 Agent(已在默认跑)+ 一整套试图抢在 LLM 前面做判断的规则引擎(默认已被短路,但仍在维护、仍在被重构、仍在拖慢每一次改动的心智负担)。

**最该优先动刀的地方(按性价比)**:
1. 规则引擎的"认领权"已经被 LLM-first 拿走了,但代码没跟上 → 删/归档休眠代码。
2. `experience_entry.py`(1023 行) 的模糊目标匹配 —— 这是规则引擎里最重、最容易"优化第二段"匹配错段的部分,而"用户指的是哪一段"恰恰是 LLM 最擅长、最该交给它的判断。
3. think() 本身的分派骨架(782-917)—— 在 LLM-first 下它只是一堆恒假分支,瘦身空间巨大。

### 5. 工具集评估(`backend/agent/tool/`)

实际注册给 LLM 的(manus.py:242-265):

| 工具 | 描述质量 | 评价 |
|---|---|---|
| `cv_reader_agent` | 好(明确"仅用于文件加载/查结构",避免和 Hybrid context 重复) | ✓ |
| `show_resume` | 好,参数 section/output_mode/file_path 清晰 | ✓ |
| `cv_analyzer_agent` | 尚可 | ✓ |
| `cv_editor_agent` | **优秀**(cv_editor_agent_tool.py:46-92):path 常用路径举例、action 语义、富文本 HTML 约束、add 对象示例全都写进 description,LLM 基本能自主正确调用,不需要外部代码猜参数 | ✓✓ |
| `generate_resume` | 好,required=job_description | ✓ |
| `send_resume_email` | 好(admin 专属,manus.py:253-254 条件注册) | ✓ |
| `ask_human` / `terminate` | 标准 | ✓ |

**数量刚好**——7 个(admin 8 个)覆盖"读/展示/诊断/编辑/生成/发邮件"全场景,不多不少。**粒度也对**——尤其 `cv_editor_agent` 用一个工具 + `action` 枚举覆盖改/加/删,而不是拆成三个工具,这对 LLM 更友好。

**唯一的工具设计矛盾**:`cv_editor_agent` 的 description 已经足够 LLM 自主调用了(它把路径规则、富文本约束都讲清楚了),但 **`intent_router.py` + `edit_rules.py` + `experience_entry.py` 还在外面用正则替 LLM 猜 `path` 该传什么**(比如 `_resolve_company_path_by_value` manus.py:372-395、`parse_fast_simple_edit_text` edit_rules.py:144)。工具本身好用,是外部规则层不信任 LLM、非要抢着算参数——这正是 §2 那个结构问题在工具层的投影。

### 6. 优先级建议(如果只能优先做 3 件事)

**① 就 LLM-first 做一次性了断:删除或归档默认不可达的规则/分派代码。**〔工作量:中〕
把 `resume_use_cases.py`(1172)、`intent_router.py` 的 staged-edit 段、`tool_invocation_builder.py` 的诊断/直调构造器、think() 的 782-877 与 916-917、以及 `_llm_first_routing_enabled` 回滚开关,一并按"LLM-first 是唯一路径"清掉。
- **为什么优先**:这是当前一切复杂度和"改一处怕牵连别处"的根源。产品决策(2026-07-10 用户拍板全走 LLM)已经做了,代码欠这笔账已欠了一整轮重构。删掉后 think() 会从 243 行塌缩到 ~80 行,`manus.py` 能砍掉一半,S4-pre 那种白盒测试的存在理由也随之消失。
- **注意**:这不是"再抽一层",而是**减法**。先确认 optimize-confirm(773-780)和 GREETING 这两条还活着的规则路径的去留,其余整段移除。

**② 删掉 §3.A 的 4 处零 callsite 死函数 + 清理 tool/ 目录的通用工具残留。**〔工作量:小〕
- **为什么优先**:零风险、零依赖、立刻降噪。`_to_plain_text`/`_resolve_primary_experience_text_path`/`_format_analysis_report`/`_run_delegated_analysis` 是重构掉队的孤儿,`tool/__init__.py` 对 bash/browser/websearch 的导出与 `_build_tool_collection` 的"只做简历"注释直接冲突,会误导下一个接手的人。
- 顺带把 §3.C 的文本 helper 跟随 optimize-confirm 的最终去留一起处置(不要单独抽类)。

**③ 让 `experience_entry.py` 的"目标段落匹配"退居 LLM 之后,只保留 cv_editor_agent 的路径校验/富文本规范化这类确定性工作。**〔工作量:中偏大〕
- **为什么优先但排第三**:它是规则引擎里最重(1023 行)、最容易出"优化错段/劫持上一轮上下文"体验 bug 的部分,而"用户指哪段"正是 LLM 的强项。但它和 §1 深度纠缠,需要先做完 ① 才能安全动它,否则会破坏回退路径。做完后,"用户想优化哪一段"交给 LLM 用注入的简历 context 自己判断,Python 只负责 LLM 给出 path 后的合法性校验与 HTML 规范化(这些确定性工作该保留)。

**一句话给设计决策**:这个 Agent 不缺"更自主"的能力——它缺的是**把已经做出的 agentic 决策在代码里执行到底的勇气**。当前最大的技术债不是"不够智能",而是"两套实现并存、且在维护那套已经被架空的"。先做减法,再谈怎么让它"更有主见"。

---

## 三、外部范式调研报告(子 Agent 原文,WebSearch 实际检索,非训练知识凭空作答)

### 0. 调研背景锚点

用户口语提到"Loop Energy"、"Harness"、"Energy Ring"几个词,调研前先甄别真实业界术语,再展开;同时子 Agent 读过项目代码后确认了用户的担忧——manus.py 里确实存在大量正则/关键词路由(`_SEND_EMAIL_VERB_RE`、`_looks_like_compound_request`、`_looks_like_optimize_confirm`、staged-edit 规则、GREETING 快路径),但也发现代码里**已经有** `AGENT_LLM_FIRST_ROUTING` 开关和让权守卫机制,方向已经和业界主流一致。

### 1. 术语澄清:用户口语 → 业界真实概念

| 用户说法 | 业界真实概念 | 说明 |
|---|---|---|
| **Loop Energy** | **Agentic Loop / Loop Engineering(循环工程)** | 不是"能量",是 Agent 的核心执行循环。ReAct 的 perceive→reason→plan→act→observe 五段循环是起点;2025 业界开始把"设计好的循环"本身当成一等工程对象,提出"你应该设计驱动 Agent 的循环,而不是逐条给它写 prompt"。 |
| **Harness** | **Agent Harness(执行环境/脚手架)** | 真实且核心的术语。指包住 LLM 的那层软件:执行循环、工具集、上下文管理、记忆、权限边界、反馈通道。Anthropic 定义:模型周围的软件脚手架——循环、工具、上下文管理和护栏,把原始智能变成能工作的 Agent。 |
| **Energy Ring** | 没有对应的独立业界专有名词 | 最接近的是"agentic loop 的环状结构"或"context engineering"。不建议单独找,归入 Loop / Context Engineering。 |
| (隐含)"没有灵魂" | **Agent Persona / "Soul" / Opinionated Agent** | 2025 出现了 `SOUL.md`、"opinionated agent"(有主见的 Agent)这类实践,专门讨论怎么让 Agent 不做"relentless neutrality(无止境的中立)"的应声虫。 |

**纠偏提示**:Loop 和 Harness 是**两个不同抽象层**(Loop 是 harness 内部的执行节律,Harness 是整个外壳),"灵魂"是**第三个正交维度**(交互层/人设),三者不是并列关系。

### 2. 核心范式总结

#### 2.1 Anthropic「Building Effective Agents」:Workflow vs Agent 的分水岭

核心区分:
- **Workflow(工作流)**:系统中 LLM 和工具通过预定义代码路径编排——由代码决定控制流,LLM 只在固定卡槽里被调用。
- **Agent(智能体)**:系统中 LLM 动态指挥自己的流程和工具使用——LLM 自己决定下一步调什么工具、循环几轮、何时结束。

**判断谁在掌控控制流,是区分二者的唯一本质(不是"有没有用 LLM")。**

五种 workflow 模式,和"硬编码路由"直接相关的:
1. Prompt chaining(串行分解,中间加程序化 gate)
2. **Routing(分类输入 → 分发到专门 handler)——你们的 IntentRouter 正是这个模式**
3. Parallelization(sectioning 拆分 / voting 多次投票)
4. Orchestrator-workers(中枢 LLM 动态拆子任务再合并,子任务不预定义)
5. Evaluator-optimizer(生成器 + 评估器反馈环)

Routing 适合"输入类别清晰、边界稳定"的场景;Agent 适合"步数无法预测的开放式问题"。Anthropic 三条核心建议:
- Simplicity:建最适合需求的系统,不是最复杂的
- 只在必要时增加复杂度
- Tool design 比 prompt 更值得投入——提出 **ACI(Agent-Computer Interface)** 概念,把工具接口当 UI 精心设计(清晰文档、示例、边界说明、poka-yoke 防呆)

#### 2.2 Anthropic「Strip Down the Harness」/ 3 个 Harness 设计模式(和本项目最相关)

- **Pattern 1 — Lean on model intelligence**:用模型深度理解的通用工具,而不是把任务逻辑编码进 harness。
- **Pattern 2 — Strip down the harness(拆掉脚手架)**:
  - Let Claude orchestrate:别把每个工具结果都塞回上下文再让模型决策,给它自主权决定"哪些结果透传/过滤/管进下一步"
  - Let Claude manage context:progressive disclosure / skills 让模型按需取指令,而非预加载全部
  - Let Claude persist memory:compaction + memory 文件让模型自选保留什么
- **Pattern 3 — Set boundaries carefully**:harness 只该管 UX、成本控制、安全,**不该管核心任务逻辑**。
- 方法论:持续问自己"我能停掉哪些硬编码?",把成为瓶颈的"dead weight"去掉。

> 直接映射:manus.py 里那些 `_check_*_finish` 终止守卫、`should_auto_terminate` 的短语黑名单、staged-edit 的正则解析,大部分属于"harness 在替模型做任务决策",是这两条 Pattern 建议剥离的对象。

#### 2.3 单 Agent 循环范式谱系:ReAct → Reflexion → Plan-and-Execute → ReWOO

- **ReAct**:Thought→Action→Observation 紧循环,实时适应,适合工具使用/检索/交互式任务。默认起点,本项目当前就是 ReAct 风格(think/act)。
- **Reflexion**:加自我评估 + 记忆做 trial-and-error 学习。**⚠️ 坑**:2025 复现研究发现单 Agent Reflexion 会"反复重犯早期错误",因为同一个模型既生成答案又做自我批判,批判不客观。**启示:评估器最好和生成器分开**。
- **Plan-and-Execute**:先规划再由更便宜的 executor 执行,减少反复调用大模型。
- **ReWOO(Reasoning Without Observation)**:一次性把所有步骤规划好,用变量占位未知结果。原论文报告相比 ReAct 5× token 效率 + 4% 准确率提升(HotpotQA)。适合步骤可预先规划的场景,不适合需要根据中间结果动态调整的场景。

**选型判断**:简历优化是高交互、需要看用户简历内容动态决定改哪里的场景,ReAct(可能局部叠加 evaluator-optimizer)比 Plan/ReWOO 更贴切。

#### 2.4 Loop Engineering:把"循环设计"当成一等工程

生产级 loop 的关键组件:硬迭代上限 + token 预算、no-progress detection(状态不变就退出)、终止条件前置定义(不让模型自评)、工具重试的 circuit breaker、对不可逆动作(数据库写、部署、发邮件)保留人类确认。**正好对应"发邮件"该作为高风险工具由模型调用 + 一道确认 gate,而不是用正则抢意图**。

### 3. 核心问题:何时该硬编码路由,何时该放权给 LLM

业界共识:不是"全硬编码"或"全放权",而是**混合(hybrid),按可预测性 vs 自主性分层**。真正的分界是"可预测性 vs 自主性",而不是有没有用 LLM。

**倾向硬编码/确定性路由,当**:任务定义清晰、输入稳定;实时/低延迟要求(LLM 推理 1-30 秒,亚秒级场景硬编码);合规/可复现;高频+确定(同一种输入每次都该走同一条路)。

**倾向放权给 LLM 自主,当**:开放式、步数不可预测;研究型、多文档分析、复杂客服/对话;需要根据中间观察结果动态改变策略。

**代价对照**:单 Agent 约消耗标准 chat 的 ~4× token;多 Agent 编排约 ~15× token 成本。放权不是免费的。

**落地形态**:确定性外壳 + 自主内核——顶层用确定性 supervisor 保证路由可预测,专家 Agent 在各自被限定的域内获得自主权。"纯自主 Agent 在生产里并不占主流,混合架构才是站得住的。"

**具体到本项目的取舍表**:

| manus.py 现状 | 建议 | 依据 |
|---|---|---|
| IntentRouter 用正则抢 SEND_EMAIL / 复合请求 / optimize_confirm | **放权给 LLM**。正则不断打补丁(代码注释里已有"组合请求被拆丢"的已知问题)正说明规则在这里是负债 | 开放式场景 → 放权 |
| GREETING fast path(不挂工具、更快) | **可保留**。高频、确定、对延迟敏感,且仍是 LLM 生成(只是不挂工具) | 高频+确定+低延迟 → 确定性 |
| `_check_*_finish` 一堆终止守卫 | **收敛成统一的 loop 护栏**(no-progress detection + 迭代上限 + 终止条件前置) | Loop Engineering |
| `decide_staged_edit` 正则解析"把X改成Y" | **可保留但缩小**。精确字段替换确定、可复现、低延迟,适合规则;一旦掺入"顺便/然后"就该让权 | 确定操作→规则;组合→放权 |
| 发邮件用正则拦截 | **改成"高风险工具 + 确认 gate"**,由 LLM 决定调用、harness 只负责"不可逆动作需人类确认" | 人类确认边界 |

一句话判据:**规则只配拥有"防呆"和"安全/成本边界",不配拥有"理解用户意图"。理解意图是模型的活。**

### 4. 怎么让垂直简历 Agent"有灵魂"(可操作手法)

#### 4.1 用"价值观"替代"规则",给 Agent 观点(Opinionated Agent)

规则产生"服从",价值观产生"性格";守规则的 Agent 会在规则没覆盖的边缘失灵,内化了价值观的 Agent 能自然应对边缘。最常见的失灵是"无止境的中立"——什么都对冲、拒绝偏好任何一方、太怕犯错而变得没用。解药是明确授权它有观点。

**落到简历 Agent**:与其写"如果用户简历缺量化就提示补充",不如在 system prompt 里给它一套**简历审美价值观**(例如"我坚信简历要有可量化结果、动词开头、一页原则、拒绝空话形容词"),让它自己判断当前简历哪里违背了这些价值观并主动指出。

#### 4.2 人设放在"交互层",绝不渗进"决策/安全内核"

关键架构纪律:个性不该碰安全规则、权限或核心决策逻辑;个性的正确位置是交互层,作为一个约束确定性内核之上的展示层。即:**灵魂 = 表达层的皮**,套在受约束的确定性内核外面。

**落到简历 Agent**:人设(比如产品里那个叫"coco"的角色)负责语气、主动性、观点表达;但"能不能发邮件、能不能写库、只读轮次不许改简历"这些永远归确定性内核管。二者分层,互不污染。

#### 4.3 用一个持久化人设文件把"灵魂"固化(SOUL.md 模式)

业界做法:`SOUL.md` = 定义 Agent 身份、专长、沟通风格、工作方式、边界的 markdown,每次启动先读它、注入 system prompt,让 Agent"读自己进入存在"。

**落到简历 Agent**:PromptBuilder 可以把"coco 的简历顾问人设 + 简历价值观 + 边界"抽成一个稳定的人设核心块,保证跨会话人格一致,而不是散在各 fast-path 的 fallback 文案里。

#### 4.4 给更大的工具自主权 + 更强的评估反馈环(而不是更多 if)

让模型自己决定要不要追问、调哪个工具;质量由一个独立评估器兜底,而不是用 Python 规则堵。Anthropic 的 harness 实践里用了"generator + evaluator"(受 GAN 启发)的双 Agent 结构,让 evaluator 发展出把主观判断变成可打分的具体标准。

**落到简历 Agent**:`ANALYZE_RESUME` 现在是硬编码两阶段(先问岗位再诊断)。更"有灵魂"的做法是让 LLM 自己判断"信息够不够做定向诊断",够就直接给有观点的诊断,不够就自己决定追问什么。**⚠️ 复用 §2.3 的坑**:evaluator 要和 generator 分开,否则自评会重复自己的错误。

#### 4.5 垂直 Agent 的定位纪律:窄而深,别退化成通用助手

垂直 Agent 最佳实践第一条:先在一个窄工作流做深、证明价值,再扩。本项目已经做对一件事——`_build_tool_collection` 的注释已经砍掉了浏览器/代码执行/联网搜索等通用工具,理由是"会诱导模型幻想成 CLI/浏览器 Agent"。**窄工具集反而让模型的自主决策更聚焦、更像"专家"而非"什么都能干但都不精的助手"**。

同类产品参考(多 Agent 简历筛选框架,arXiv 2504.02870):把简历处理拆成 Extractor / Evaluator / Summarizer / Formatter 四个角色,Summarizer 用 CEO/CTO/HR 三个子 Agent 辩论给反馈——这是"让 Agent 有主见"的另一种具象。设计教训:**确定性抽取(结构化预处理)+ LLM 推理(评估)混合效果最好**,再次印证 §3 的 hybrid 结论:结构化的归结构化,判断的归 LLM。

### 5. 落地优先级建议

1. **保留** GREETING 快通道、字段精确替换、"不可逆动作需确认"、"只读轮次不许改"这类安全/成本/防呆边界
2. **剥离** 用正则理解意图的那一层(SEND_EMAIL/复合请求/optimize_confirm 抢注),延续 `AGENT_LLM_FIRST_ROUTING` 的方向
3. **收敛** 散落的 `_check_*_finish` 为统一 loop 护栏(迭代上限 + no-progress detection + 终止条件前置)
4. **抽出** 一个稳定的 SOUL/人设核心块(含简历审美价值观),由 PromptBuilder 每轮注入
5. **升级** 质量兜底:把正则黑名单换成独立 evaluator(generator/evaluator 分离)
6. **守住** 垂直边界:继续保持窄工具集,把"工具集边界"当人格的一部分

### 6. 来源列表(实际检索/阅读过)

主要一手来源:
- Anthropic《Building Effective Agents》: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic / Claude《Agent Harness Design: 3 Patterns for Harnessing Claude's Intelligence》: https://claude.com/blog/harnessing-claudes-intelligence
- Anthropic Engineering(harness 系列索引): https://www.anthropic.com/engineering
- 多 Agent 简历筛选框架论文: https://arxiv.org/html/2504.02870v1

范式与循环谱系:
- 《Agentic Loops: From ReAct to Loop Engineering (2026 Guide)》: https://datasciencedojo.com/blog/agentic-loops-explained-from-react-to-loop-engineering-2026-guide/
- 《ReAct vs Plan-and-Execute vs ReWOO vs Reflexion》: https://theaiengineer.substack.com/p/the-4-single-agent-patterns
- 《ReWOO vs ReAct: choosing the right agent architecture》: https://www.nutrient.io/blog/rewoo-vs-react-choosing-right-agent-architecture/

Workflow vs Agent 取舍:
- 《Deterministic Workflows vs Autonomous Agents vs Hybrid Models》(Medium): https://medium.com/@jmfloreszazo/deterministic-workflows-vs-autonomous-agents-vs-hybrid-models-when-to-use-each-approach-in-ai-c7327bea43a1
- 《AI Agents vs Workflows: When to Use Each》(Redis): https://redis.io/blog/agents-vs-workflows/
- 《Agentic Workflow vs Autonomous Agent》(MachineLearningMastery): https://machinelearningmastery.com/agentic-workflow-vs-autonomous-agent-whats-the-difference/

Harness engineering:
- 《Agent Harness Engineering — The Rise of the AI Control Plane》(Adnan Masood): https://medium.com/@adnanmasood/agent-harness-engineering-the-rise-of-the-ai-control-plane-938ead884b1d
- awesome-harness-engineering: https://github.com/ai-boost/awesome-harness-engineering

灵魂/人设:
- 《SOUL.md: How to Give AI Agents Consistent Personality Across Sessions》: https://metalumna.com/articles/soul-md-persistence-in-a-pattern-recognition-machine
- 《Designing AI Agent Personas》(Mindra): https://mindra.co/blog/designing-ai-agent-personas-system-prompts-enterprise
- 《Opinionated System Principles and Architecture for AI Agents》(Bijit Ghosh): https://medium.com/@bijit211987/opinionated-system-principles-and-architecture-for-ai-agents-f22e10e952a0

垂直 Agent:
- 《2025 Guide to Enterprise-Ready Vertical AI Agents》(wald.ai): https://wald.ai/blog/ai-agents-in-2025-why-vertical-ai-agents-are-keytypes-trends-and-insights
- 《Agentic Systems: A Guide to Transforming Industries with Vertical AI Agents》(arXiv 2501.00881): https://arxiv.org/html/2501.00881v1
- 《AI Agents in recruitment: the practical guide (2025)》: https://www.herohunt.ai/blog/ai-agents-in-recruitment-the-practical-guide/

**一句话总纲**:业界 2024-2025 的方向高度一致——把"理解用户意图、决定下一步"交回 LLM,规则只保留安全/成本/防呆的确定性边界;灵魂来自价值观化的人设(放在交互层)+ 更大的工具自主权 + 独立评估反馈环,而不是更多 if/elif。

---

## 四、2026 年最新范式补充调研(子 Agent 原文,截至 2026-07-11)

前两份报告引用的多是 2024-2025 年内容。本节是专门补充到 2026 年的第三轮调研,检索时刻意加时间限定词(2026/latest/H1 2026),优先抓厂商官方 engineering blog 一手来源,区分对待"真实增量"与"换年份重述的旧观点"。

### 1. 诚实结论先行

**2026 上半年没有出现颠覆 ReAct/循环式 Agent 的新范式。** 上一轮 2024-2025 的核心结论(ReAct 循环、简单优先、strip down harness、垂直窄任务、人在环)**在 2026 年仍然是当前最佳实践,方向没变**。变化是演进级的,集中在 Anthropic 2026-03-24《Harness design for long-running application development》和 2026-04-08《Scaling Managed Agents: Decoupling the brain from the hands》两篇官方新文,以及 Agent Skills 机制(2025-12 发布,2026 上半年成主流)。市面上大量"2026 agent trends"文章是换年份的旧酒,不构成新信息。

### 2. 四条真实增量

**① 术语上移**:"harness"没被取代,但重心从"harness engineering"上移到"context engineering"(2026 年被称为"取代 prompt engineering 的主学科")和"agent runtime"。理由:agent 的失败模式是"状态管理失败"而不是"提示词失败",工程重心从"写好一句 prompt"转向"管好每一步 context"。

**② Anthropic 对"简单优先"的部分修正 + 架构思想更新(最重要,一手,已精读原文)**

- 《Harness design for long-running application development》(2026-03-24):证明对于超出模型基线能力的长任务,策略性的多 agent 拆分(借鉴 GAN 思想的 generator/evaluator 对抗:Planner 扩详细 spec → Generator 迭代实现 → Evaluator 用 Playwright 硬阈值打分)能解决"纯 prompt 解决不了"的失败模式。关键新提法:
  - **"Context resets over compaction"**——与其原地摘要压缩历史,不如彻底重置 + 结构化交接
  - **"半确定性结构"**——agent 间先协商"什么算完成"的契约,但实现仍交给 LLM,是"欠约束 vs 过约束"权衡的最新答案:**用确定性结构锁定验收契约,把"怎么实现"留给模型**
  - **最诚实的教训**:模型升级到 Opus 4.6 后,主动删掉之前 load-bearing 的 harness 组件,成本降约 38%、质量不变——很多 harness 复杂度是在给"当时模型的短板"打补丁,模型一强就成了负债

- 《Scaling Managed Agents》(2026-04-08):核心论点——**"harness 编码的是'模型自己做不到什么'的假设,而这些假设会随模型变强迅速过期。"** 解法是把"大脑"(Claude+harness)和"手"(sandbox+执行工具)解耦,用 Session(append-only 事件日志)/Harness(agent loop)/Sandbox(执行环境)三层虚拟化抽象隔开,类比操作系统抽象硬件。给垂直 agent 的三条直接教训:①状态外置到推理循环之外;②面向未来更强的模型设计而非当前短板;③安全靠架构(凭证从跑 LLM 生成代码的 sandbox 隔离出去,用 proxy+vault,而非信任模型不乱来)。

**③ Agent Skills + progressive disclosure 成为标准模式**:核心洞见是把"何时触发"和"如何执行"分离——skill 的 metadata 是第一层(让模型知道何时该用),完整内容是第二层(判断相关才读进 context),解决"工具太多把 context 撑爆"的问题。之前调研的 SOUL.md 单文件人设模式,2026 年的对应升级就是拆成按需加载的 skill。

**④ Eval-Driven Development(EDD)从口号变门槛**:Anthropic 明确区分 agent harness(让系统能行动)vs evaluation harness(衡量它是否真的有效)是两套独立基建。可操作参考:从 ~100 条高质量 golden 起步、最多扩到 500;裁判模型能力关键(小模型会漏判)。多方口径称 2026 年仅约 23% 的 agent 能进生产,约 77% 卡在 demo-to-production gap,能上线的都做同一批事:选窄而高频的任务、风险步骤留人、权限收紧、scale 前先建 eval harness、从 shadow mode 逐步毕业到自主。(此比例为二手统计,精确值谨慎引用,方向可信)

### 3. Coding Agent 领域的最新收敛答案(二手为主,方向一致可交叉验证)

2026 年编程 agent 收敛到 Claude Code / Cursor / Codex Desktop / Replit Agent 3 / Devin 五个生产级选手。对"确定性代码路由 vs LLM 自主决策"这个权衡,最新主流思路:**投资在"确定性基础设施"(context 管理、工具路由、错误恢复、权限),而不是投资在"决策脚手架"(显式 planner、state graph)**。越强的模型,越受益于丰富的操作环境,越被约束它选择的框架拖累。这与 Anthropic 两篇官方文完全一致,是本轮最强的一致信号。

### 4. 对简历优化 Agent 的具体启示

1. think()/act() ReAct 循环核心不用推翻,2026 主流仍是"ReAct 式循环 + 强基建"
2. **确定性预算的分配原则**:别用确定性代码框住模型"怎么做",而是用来锁定①验收契约(什么算"简历优化完成/合格")②状态管理③权限/凭证隔离④错误恢复。"改写措辞/匹配 JD"交给 LLM,"格式校验/字段完整性/隐私脱敏/最终打分阈值"用确定性代码兜底——这条和 §一/§二 内部审计报告的结论完全对得上,是三份报告唯一交叉验证一致的具体建议
3. evaluator 角色**按需引入**——只在任务超出模型基线能力时才值得加,模型本身能做好就别硬加
4. harness 组件要定期"减负"——记住 38% 降本教训,每次底模升级后回来问"这块还需要吗"
5. 人设/领域知识改用 Agent Skills 式渐进披露,而非一次性塞进 system prompt
6. **垂直合规是这轮新增的信息**:2026 招聘方明确在查"AI 生成简历的逻辑矛盾/日期重叠/不可能的晋升"(一份 3000 简历分析:9/10 有逻辑矛盾,3/4 top 雇主简历含 AI 生成内容)。简历优化 Agent 应内置一致性校验 + 反"AI 味"检测,避免优化出一份一眼假、过 ATS 但过不了人的简历
7. 上线前先建 evaluation harness,按 EDD 攒 ~100 条 golden

### 5. 来源列表(标注发布日期)

一手/高可信(厂商官方):
- Anthropic,《Harness design for long-running application development》— **2026-03-24**(已精读):https://www.anthropic.com/engineering/harness-design-long-running-apps
- Anthropic,《Scaling Managed Agents: Decoupling the brain from the hands》— **2026-04-08**(已精读):https://www.anthropic.com/engineering/managed-agents
- Anthropic,《Equipping agents for the real world with Agent Skills》— Agent Skills 于 **2025-12** 发布:https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Anthropic,《Code execution with MCP》— 2025 末:https://www.anthropic.com/engineering/code-execution-with-mcp
- OpenAI,《A practical guide to building agents》— 2025-2026 持续更新
- Google Cloud,《A dev's guide to production-ready AI agents》+ 白皮书《Introduction to Agents》— 白皮书 2025-11

二手/中等可信(可交叉验证,精确数字谨慎引用):
- InfoQ,《Anthropic Designs Three-Agent Harness》— 2026-04
- Red Hat Developer,《Eval-driven development》— 2026-03-23
- JetBrains Blog,《Top Agentic Frameworks 2026》— 2026-06
- arXiv,《Dive into Claude Code: The Design Space of Today's and Future AI Agent Systems》— 2026
- 招聘合规:Fisher Phillips、HireHub、HR Dive 相关 2026 文章

---

## 五、下一步(待用户拍板,本文档不含实施)

三份报告指向同一个结论:方向已经选对(LLM-first),但代码没有为这个选择买单;2026 年最新业界实践进一步印证了内部审计报告的判断(确定性预算该花在契约/状态/权限/恢复上,而非"猜意图")。下一步是否要按内部审计 §6 的优先级 3 件事立项(先做减法、再谈灵魂),以及是否要吸收 2026 补充调研里的"一致性校验/反 AI 味检测"作为新需求,需要用户确认后走 `/writing-plans` 正式立项,本文档仅作调研记录,不代表已批准的实施计划。
