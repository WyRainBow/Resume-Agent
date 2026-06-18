# 悬浮 AI 助手对话窗口 + 划词改写收编 实施计划

> 设计：knowledge-base/specs/2026-06-18-floating-ai-chat-design.md

全自动执行模式：每个子任务独立 commit + push，提交前自检（build / curl）。

## 子任务 1 · 后端 `/resume/chat/stream`
- 目标：轻量问答 SSE 接口。
- 改动：`backend/routes/resume.py` 加 `ChatStreamRequest` 模型 + `build_resume_chat_prompt` + 路由。
- 完成标准：流式返回 `data:` 分片；`messages` 空 → 400。
- 验证：curl golden（含简历上下文的提问）/ 边界（空 messages）。

## 子任务 2 · 悬浮气泡 + 对话窗口（替换 Dock）
- 目标：JadeAI 式可拖拽气泡 → 轻量多轮问答窗口。
- 改动：新增 `api.ts#chatStream`；新增 `AiAssistantChat.tsx`；`index.tsx` 用它替换 `AiCopilotDock`（保留 JD 优化快捷入口）。
- 完成标准：气泡显示/拖拽、窗口开合/拖拽、问答流式渲染。
- 验证：`npm run build` + 浏览器实测。

## 子任务 3 · 划词改写收进聊天
- 目标：选中正文 → 对话窗口引用 → 改写 → 一键写回原选区。
- 改动：新增 `activeSelectionStore.ts`（含 `applyHtmlToSelection` 写回）；`RichEditor` 加 `onSelectionUpdate` 推送选区；`AiAssistantChat` 订阅 + 引用 chip + 改写 + 应用。
- 完成标准：写回命中原选区；多字段切换正确。
- 验证：浏览器实测（自我评价 / 项目正文各试一次）。

## 子任务 4 · 下线旧划词气泡
- 目标：删除 `SelectionPolishBubble.tsx`，清理 RichEditor 中仅为其服务的 plumbing（selectionLockPlugin、lockedSelection、handleLock/Unlock、bubbleActiveRef、selectionSnapshotRef、lastCapturedSelectionRef、BubbleMenu 块）；删除 `AiCopilotDock.tsx`。
- 完成标准：无 unused import / 孤儿；编辑器输入/加粗/工具栏润色·语法·帮写正常。
- 验证：`npm run build` + 浏览器实测编辑器基本操作。

## 子任务 5 · 收尾
- 总验证：`npm run build` + 端到端走查（问答 + 划词应用 + JD 优化入口）。
- 记录：`knowledge-base/reviews/` 追加操作记录；本计划勾完。
- 输出执行总结（子任务 + commit + 遗留）。
