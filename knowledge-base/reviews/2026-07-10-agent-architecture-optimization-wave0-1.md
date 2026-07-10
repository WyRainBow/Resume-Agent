# Agent 架构优化 Wave 0 / 0.5 / 1.1 执行记录

> 日期：2026-07-10
> 方案来源：Codex 只读架构分析（session `8c147ab2-e4e5-485e-88d7-71f526b3c9eb`）→ Claude 逐条核验代码 → Codex 二轮 review 修正定稿
> 任务跟踪：Tutti issue `issue-91199c86db9ca2b722a8909da3925ad2`（5 任务）

## 定稿方案概要

| 波次 | 内容 | 状态 |
|---|---|---|
| Wave 0 | clear_data 补清 JD + TTL 按 last_accessed 回收 | ✅ commit `a3003809` |
| Wave 0.5 | AgentSessionManager façade 收口 `_active_sessions` | ✅ commit `a3082cc7` |
| Wave 1.1 | ToolResult.structured_data 显式通道（兼容迁移） | ✅ commit `a0ea6c1f` |
| Wave 1.2 | 统一事件 envelope + %%SUGGESTIONS%% 结构化迁移 | ⏳ 待做（触前端契约，需单独一轮 e2e） |
| Wave 2 | 拆 Manus + AgentStream 事件适配器化 | ⏳ 待做（需先 brainstorming + writing-plans） |
| Wave 3 | 工具分包 + to_params 缓存 | ⏳ 待做（parallel_safe 单独评估） |

## 修复的真 bug

1. **JD 泄漏**：`ResumeDataStore.clear_data()` 漏清 `_jd_by_session`，JD 泄漏到复用同 session_id 的下一个会话（换简历/岗位后仍按旧 JD 优化）。
2. **TTL 误杀**：会话回收判据用 `created_at` 而非活跃时间，活跃超 1h 的长对话被误回收（agent 记忆+简历态丢失）。现为 touch-then-sweep：创建/复用/清扫时 touch，判据 `last_accessed or created_at`（旧格式回退），当前会话不会在自己的 finally 里被回收。
3. **历史删除泄漏**：history.py 单删/批删/全删 + `clear_active_sessions_for_user` 只删 `_active_sessions` 条目、不清 ResumeDataStore（简历/JD 留存类级字典）。统一走 `session_manager.discard_session` 后修复。

## 新增架构接缝

- **`backend/agent/web/session_manager.py`**：内存会话操作唯一入口（get/register/touch/get_active_agent/discard/clear_for_user/evict_idle）。只包操作不迁移状态；ResumeDataStore/SharedState/ChatHistory 完整收拢留给 Wave 2。stream.py 保留 `get_active_agent` / `clear_active_sessions_for_user` 薄委托（approval 等既有 import 不断）。
- **`ToolResult.structured_data`**：工具结构化输出显式字段，`toolcall._store_structured_tool_result` 优先消费（含意图元信息补齐），system JSON 解析保留作 fallback。cv_editor / cv_reader / generate_resume 双写迁移期；show_resume 本无 system JSON 契约（toolcall 从 ResumeDataStore 构建），留给 Wave 2 用例化时收拢。

## 回归锁

- `backend/tests/test_agent_session_lifecycle.py`（11 条）：clear_data 完整性 / TTL 活跃回收 / façade 泄漏修复，red-green 验证（旧代码 5 失败）。
- `backend/tests/test_structured_passthrough.py`（10 条）：显式通道优先 / fallback 安全网 / __add__ 不丢字段，red-green 验证（旧代码 4 失败）。

## 顺带发现（未修，留给后续波次）

- history.py `delete_all_sessions` 里 `session_ids` 是既有死变量（收集后未使用）。
- Wave 1.2 前置事实：`SuggestionsEvent` 后端模型与前端 `suggestions` 类型已存在，迁移是"从文本标记切换"而非"从零引入"；`manus.py` / `prompt/manus.py` / `CocoChat.tsx` 多处仍依赖 `%%SUGGESTIONS%%`。
- Wave 2 拆 Manus 第一刀先把 `_pending_*` 等散落 flag 收进 `TurnExecutionState` 单轮状态对象，不要试图一次消灭所有 flag（Codex review 结论）。

## 追记：Wave 2a 进展（2026-07-10 晚）

分支 `feature/agent-arch-wave2a`（不合 main）：
- S1 `TurnExecutionState`（317956f7）/ S2 `PromptBuilder` golden 对拍（5cf4388c）/ S3 `ResumeUseCases` 900 行迁出（f44e9f6e）/ S4-pre 白盒断言行为化（45b701c4）——Codex 代码 review + 浏览器实测验收通过（P1 event-loop 与 P2 golden 覆盖缺口已修 06040b9a）
- 产品修复（用户实测反馈）：education add 空壳 bug（fdf65a08，专用 normalizer + edu_ id + 双层包裹容错）；无简历引导直接弹 show_resume 选择面板 + 生成请求立即落地（43c73b5f，prompt 二修，golden 重录）——三场景浏览器实测通过
- S4a `IntentRouter`（bf7b7b4d）：意图识别+让权守卫收口，决策表 10 条，S4-pre 行为测试零改动通过；四步浏览器实测（GREETING/弹面板/生成/patch 应用）通过。manus.py 2602→1568
- 剩余：S4b ToolInvocationBuilder、S4c 执行体收口 ResumeUseCases 公共接口（Codex P2-2）+ think() ≤150 行 + 删 property 委托；2b/2c 子波
- 环境备注：Codex 服务两度不可用（连接反复中断），S4a 与产品修复的浏览器验收由 Claude 亲自执行
