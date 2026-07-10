# Agent 架构优化:LLM-first 一次性了断 —— 实施拆分

- **日期**:2026-07-11
- **分支**:`feature/agent-arch-wave2a`
- **依据**:`knowledge-base/reviews/2026-07-11-agent-architecture-audit-and-paradigm-research.md`(内部架构审计 + 2024-2025/2026 两轮外部范式调研)
- **背景**:审计发现 `AGENT_LLM_FIRST_ROUTING` 默认 `true`,`resume_use_cases.py` 大部分、`intent_router.py` 的 staged-edit 判定、`tool_invocation_builder.py` 的诊断/直调构造器、think() 里两大块分派代码,在默认配置下是不会执行的死代码/休眠代码。2026-07-10 用户已拍板"所有意图都走 LLM";本计划把这个产品决策在代码里执行到底。

**⚠️ 关键决策留痕**:任务 B/C 会删除规则路由的实现代码,这意味着**放弃 `AGENT_LLM_FIRST_ROUTING=false` 这条回退能力**——不是保留开关只改默认值,而是真正物理删除代码。这是 2026-07-10 产品决策的延伸落实,不是新决策;如果以后想临时回退到规则路由做兜底,需要重新实现,不能靠切开关恢复。

## 任务拆分与依赖

```
Task A1 ─┐
Task A2 ─┼─ 互相独立,可并行,低风险
         │
Task B ──┴─ 中风险,删除 LLM-first 默认不可达的规则/分派代码
         │
Task C ──── 依赖 B 完成并验证(与规则路由/staged-edit 深度纠缠),暂不派,B 验收后再排
```

### Task A1:清理零 callsite 死函数〔小,低风险,可并行〕

**范围**(审计已核实 0 callsite,不需要重新调查,直接删):
- `backend/agent/agent/manus.py:413-425` `_to_plain_text`
- `backend/agent/agent/manus.py:397-411` `_resolve_primary_experience_text_path`
- `backend/agent/agent/resume_use_cases.py:128-147` `_format_analysis_report`
- `backend/agent/agent/resume_use_cases.py:93-96` `_run_delegated_analysis`

**验收**:删除前 `grep -rn` 全 backend 复核确认真的 0 callsite(审计报告的结论要独立复核一遍,不要直接采信);pytest 全量对比 baseline 一致;`wc -l` 记录行数变化。

### Task A2:清理工具目录残留导出〔小,低风险,可并行〕

**范围**:`backend/agent/tool/__init__.py` 里导出但从未被 `_build_tool_collection`(manus.py:236-265)注册给 LLM 的通用工具符号(`Bash`/`BrowserUseTool`/`WebSearch`/`StrReplaceEditor`/`PlanningTool`/`Crawl4aiTool`/`CreateChatCompletion` 等)。

**范围边界(重要)**:只清理 `__init__.py` 的**导出**(死引用),**不删除**对应的工具源文件本体(`computer_use_tool.py`/`browser_use_tool.py`/`web_search.py` 等 ~2500 行)——这些文件是历史遗留而非本次改动产生的孤儿,按项目规则"发现不相关死代码指出但不删除",只处理确认属于死引用的导出语句。如果调查后发现有其它地方(比如测试文件)还在 import 这些符号,如实报告,不要为了"清干净"强行改测试。

**验收**:`grep -rn` 确认这些符号在 `backend/` 全仓(含测试)没有其它引用;pytest 全量对比 baseline;报告实际删了多少行、有没有发现范围外的引用点。

### Task B:LLM-first 一次性了断〔中,需先做完 A1/A2 或与其并行均可,是 C 的前置〕

**范围**(均为审计报告 §3.B 标注的"默认配置下休眠代码"):
- `backend/agent/agent/resume_use_cases.py`:诊断 payload 构造、qwq 流式生成、6 步优化路由(`route_optimize_section`)、整份优化(`_optimize_whole_resume`)等——只保留仍被 GREETING/optimize-confirm 两条活路径依赖的部分(如果有,需先核实清楚再删,不要整个文件無腦删)
- `backend/agent/agent/tool_invocation_builder.py`:除 `build_apply_optimization`(optimize-confirm 在用,保留)外的诊断/直调构造器(`build_diagnosis_phase1/2`、`build_direct_tool_call`)
- `backend/agent/agent/intent_router.py`:`decide_staged_edit` 判定(151-209 一带)
- `backend/agent/agent/manus.py`:think() 里 782-877(ANALYZE/OPTIMIZE/FULL 分派块)、916-917(直调工具 `_handle_direct_tool_call` 调用点)、以及 `_handle_direct_tool_call` 方法本体(926-972 一带)
- `_llm_first_routing_enabled()`(manus.py:104-111)本身——连同它守卫的 if 分支一起删,不再保留可切换的开关,think() 直接无条件走 LLM-first 路径

**必须先核实、不能想当然的点**:
1. GREETING 快路径、optimize-confirm 快路径这两条**目前还活着**的规则路径,依赖哪些被标记为"删除范围"的辅助函数/文本 helper(比如 `_sanitize_optimization_text` 等,manus.py:413-510 一带)——这些不能跟着删,要跟随它们所属的活路径保留
2. `staged-edit` 快路径(`decide_staged_edit`)当前是否真的从未被触发——审计报告说"llm_first→None,自守恒不可达",承接 agent 要独立复核这个判断,不要直接采信
3. 删除后 `IntentRouter`/`ResumeUseCases`/`ToolInvocationBuilder` 这三个类如果变得很薄(比如只剩一两个方法),评估是否还有必要保留独立文件,还是该考虑合并——**这个判断先做,报告出来,不要擅自决定合并/删除整个文件**,合并文件属于范围外决策,需要用户确认

**验收标准(注意和之前"行为等价重构"不同,这次是真删除功能路径)**:
- 删除前跑一次 `pytest backend/tests/ -q` 记录 baseline
- 找出所有专门测试"被删代码路径"的测试(比如测 `route_optimize_section`/`decide_staged_edit`/诊断 Phase1/Phase2 构造器 的单测),这些测试要跟着一起删除或改写为"验证 LLM-first 路径下这些函数确实不存在/不可达",不能留着测已经不存在的代码
- GREETING、optimize-confirm、纯 LLM ReAct 这三条活路径的现有测试必须继续全绿,不能有任何回归
- `test_intent_send_guard.py`(S4-pre 那批白盒测试迁移后的行为测试)要重新核实是否还有意义,如果测的正是被删的规则路径,如实报告
- 起服务做一次真实 SSE 链路验证(参考 S4c-3 的方式):至少覆盖 GREETING、加载简历、一次真实的简历优化对话(现在应该完全走 LLM 自主决定调用 cv_editor_agent/cv_analyzer_agent,而不是被规则拦截),确认行为符合预期(不是"和删除前逐行一致",而是"用户可感知的核心功能没坏")
- `wc -l manus.py` 记录变化,预期能砍掉相当大一块(审计估计 think() 能到 ~80 行)

### Task C:experience_entry.py 目标段落匹配退居 LLM 之后〔中偏大,依赖 B,暂不派〕

**先不要现在做**。等 Task B 完成并通过验收后,由主 session 重新评估这个任务的具体拆分方案(它和 Task B 删除的规则路径深度纠缠,B 做完后代码现状会变化,现在写具体范围意义不大)。

## 执行方式

Task A1、A2、B 三个交给独立 fable5 子 agent 并行执行(A1/A2 互不依赖 B,可以真并行;B 内部有顺序性但和 A1/A2 无冲突,文件不重叠)。每个 agent 独立 commit(不 push),完成后主 session 逐个 review。Task C 留到 B 验收通过后再排。

## 完成后收尾(不属于本次三个子任务范围,主 session 统一处理)

- 三个 commit 全部 review 通过后,统一考虑是否 push
- 更新本文档或另开一份 review 记录本次清理的最终数据(删除总行数、think()/manus.py 最终行数)
- 若 Task B 发现 `IntentRouter`/`ResumeUseCases`/`ToolInvocationBuilder` 有文件合并的必要,单独找用户确认再排后续任务
