# 悬浮 AI 助手对话窗口 + 划词改写收编 设计

> 日期：2026-06-18 ｜ 分支：feature/06-18/03 ｜ 对标参考：reference/JadeAI

## 1. 背景与目标

当前工作台的 AI 入口分散，右下角 `AiCopilotDock` 只是一个**静态菜单**（一个 JD 优化按钮 + 一段文字指引），不能对话；真正能对话的 `SophiaChat` 是独立整页，不是浮窗；划词改写 `SelectionPolishBubble`（950 行）逻辑很重。

目标：参考 JadeAI 的 `ai-chat-bubble` + `ai-chat-panel`，在工作台右下角做一个**可拖拽的悬浮气泡 → 轻量问答对话窗口**，并把"划词改写"能力收进这个对话窗口（选中 → 改写 → 一键写回原选区），同时**下线旧的划词悬浮气泡**。

## 2. 范围

- ✅ 新增：悬浮气泡 + 对话窗口（轻量多轮问答，grounded 在当前简历上）。
- ✅ 新增：划词改写收编——选中正文文字后，对话窗口显示"引用选中"，可改写并一键写回被选中的那段原文。
- ✅ 保留：JD 优化入口（作为对话窗口里的快捷动作，打开既有 `JdOptimizeDialog`）。
- ✅ 替换：用新对话气泡替换 `AiCopilotDock`（右下角只留一个浮动入口）。
- ✅ 删除：`SelectionPolishBubble.tsx` 及 RichEditor 里仅为其服务的选区锁定 plumbing。
- ❌ 不动：富文本工具栏的「AI 润色」(`PolishChatDialog`)、「语法体检」(`GrammarCheckDialog`)、「AI 帮写」(`AIWriteDialog`)——它们是字段内能力。
- ❌ 不接入重型内置 Agent（SophiaChat 那套），本期只做轻量问答。

## 3. 架构

### 3.1 后端
新增 `POST /api/resume/chat/stream`（`backend/routes/resume.py`）：
- 请求体 `ChatStreamRequest`：`provider?`, `messages: [{role, content}]`, `resume_context?`(精简简历文本), `locale`。
- 复用 `call_llm_stream(provider, prompt)` 的 SSE 写法（`data: {content}` / `[DONE]` / `{error}`），与现有 rewrite-text/stream 完全一致。
- prompt 由 `build_resume_chat_prompt` 拼装：系统角色（简历顾问）+ 简历上下文 + 历史对话。
- 边界校验仅在系统边界：`messages` 为空 → 400。

### 3.2 划词写回通道（关键）
富文本编辑器实例分散在多个 `RichEditor`（每字段一个），而对话气泡是全局组件。新增模块级共享通道：

`frontend/src/pages/Workspace/v2/shared/activeSelectionStore.ts`
- 持有 `{ editor, from, to, text, html, path } | null` + `subscribe / getSnapshot / setActiveSelection`。
- `applyHtmlToSelection(sel, html)`：抢救自 `SelectionPolishBubble` 的写回逻辑——用 ProseMirror `DOMParser.parseSlice` + `state.tr.replaceRange(from, to, slice)` 写回选区。
- 对话窗口用 `useSyncExternalStore` 订阅当前选区；`RichEditor` 在 `onSelectionUpdate` 时把非空选区（≥2 字）推入 store。

### 3.3 前端对话组件
`frontend/src/pages/Workspace/v2/shared/AiAssistantChat.tsx`（替换 `AiCopilotDock` 的挂载）：
- JadeAI 式：右下角可拖拽气泡（点击开合）；对话窗口可由标题栏拖拽；移动端尺寸自适应。
- 轻量多轮问答：调用 `chatStream()`，流式渲染。
- 划词区：订阅到选区时顶部显示「引用选中：…」chip + 快捷改写；调用 `rewriteTextStream`，结果带「应用」按钮 → `applyHtmlToSelection` 写回。
- 快捷动作：「针对 JD 优化」→ 触发既有 `JdOptimizeDialog`（入口从 Dock 平移过来）。

`frontend/src/services/api.ts` 新增 `chatStream(messages, resumeContext, onChunk, onComplete, onError, signal)`，SSE 解析复用 `rewriteTextStream` 同款逻辑。

## 4. 影响范围（按 CLAUDE.md 清单）
- 主工作台：`frontend/src/pages/Workspace/v2/index.tsx`（替换 Dock 挂载、传 resumeData/JD 入口）。
- 富文本：`frontend/src/pages/Workspace/v2/shared/RichEditor/index.tsx`（加选区推送；删旧 bubble plumbing）。
- 前端 API：`frontend/src/services/api.ts`（加 `chatStream`）。
- 后端路由：`backend/routes/resume.py`（加 `/resume/chat/stream` + 模型 + prompt 拼装）。
- 删除：`frontend/src/pages/Workspace/v2/shared/SelectionPolishBubble.tsx`、`AiCopilotDock.tsx`。

## 5. 风险与取舍
- **写回精度**：仍按 HTML→ProseMirror slice→replaceRange，与旧逻辑同源，规避 setBold 选区漂移问题。
- **轻量优先**：多轮对话用单 prompt 拼历史，不引入会话持久化（与 build_rewrite_prompt 同风格），后续需要再加。
- **并发会话**：另一 resume 会话同分支，故每子任务即时 commit + push，成果落远端。
- **端口**：标准后端 9000；当前本地临时 9007（ark 占 9000），属环境差异，零代码改动。
