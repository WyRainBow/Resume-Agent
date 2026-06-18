# 操作记录 · 悬浮 AI 助手对话窗口 + 划词改写收编

> 日期：2026-06-18 ｜ 分支：feature/06-18/03 ｜ 模式：全自动执行（/goal）
> 设计 specs/2026-06-18-floating-ai-chat-design.md ｜ 计划 plans/2026-06-18-floating-ai-chat-plan.md

## 完成的子任务与提交

| # | 子任务 | commit |
|---|---|---|
| 0 | 设计 + 计划入库 | `7d1b4a5` |
| 1 | 后端 `/resume/chat/stream` 轻量问答 SSE | `f1f48a6` |
| 2 | 右下角可拖拽悬浮气泡 + 对话窗口（替换 Dock） | `e99882b` |
| 3 | 划词改写收编（引用选中 + 一键写回） | `b5756da` |
| 4 | 下线旧 SelectionPolishBubble + 清 plumbing + 删 AiCopilotDock | `9234a65` |

均已 push 到 `origin/feature/06-18/03`。

## 关键改动
- 后端 `backend/routes/resume.py`：新增 `ChatMessage`/`ChatStreamRequest` 模型、`_build_resume_chat_prompt`、`POST /resume/chat/stream`（复用 `call_llm_stream` 的 SSE 写法，空 messages → 400）。
- 前端 `services/api.ts`：新增 `chatStream()`（SSE 客户端，complete 去重）。
- 新增 `shared/AiAssistantChat.tsx`：JadeAI 式可拖拽气泡 + 轻量多轮问答窗口（grounded 当前简历）、JD 优化快捷入口、划词"引用选中 + 改写预设 + 一键写回"。
- 新增 `shared/activeSelectionStore.ts`：全局选区通道 + `applyHtmlToSelection`（写回逻辑抢救自旧气泡的 `replaceRange`）。
- `shared/RichEditor/index.tsx`：`onSelectionUpdate` 推送非空选区到通道；移除 selectionLockPlugin、lockedSelection、lock/unlock 处理器、相关 refs 与 BubbleMenu 渲染块。
- 删除 `shared/SelectionPolishBubble.tsx`、`shared/AiCopilotDock.tsx`。
- 不变：工具栏 `PolishChatDialog`（AI 润色）、`GrammarCheckDialog`（语法体检）、`AIWriteDialog`（AI 帮写）。

## 验证
- `npm run build`：通过（exit 0）。
- 后端 curl：golden 流式 / 空 messages 400 / 空白 messages 400。
- 浏览器（5173→9007）：问答流式且引用简历内容；划词"专项一"经"加（核心模块）"指令改写并一键写回到精确选区；删除后编辑器正常挂载/可编辑、选区仍喂聊天、旧气泡消失、控制台 0 报错（仅未登录态 PDF 401，属既有行为）。

## 已知取舍 / 遗留
- 改写**纯标签类选区**时，模型返回纯文本，写回不保留原加粗（轻量版取舍；旧气泡有大量 bold 保留逻辑，本期未搬运）。
- JD 快捷入口仅确认渲染与接线（与既有可用按钮同源 `onJdOptimize`），未点开弹窗做浏览器实测。
- 轻量问答未做会话持久化（与 `build_rewrite_prompt` 同风格，单 prompt 拼历史），后续需要再加。
- 环境：标准后端口径仍是 9000；本轮因 ark 占用 9000，后端临时跑在 9007、前端 `VITE_DEV_PROXY_TARGET=9007`，零代码改动。
