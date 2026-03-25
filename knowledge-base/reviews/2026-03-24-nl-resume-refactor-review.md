# Review：NL Resume Refactor 实施复盘

**日期：** 2026-03-24
**分支：** feature/03-23
**关联计划：** `knowledge-base/plans/2026-03-24-nl-resume-refactor.md`
**关联设计：** `knowledge-base/specs/2026-03-23-nl-resume-refactor-design.md`

---

## 实施状态

Tasks 1–9 全部完成，Task 10（端到端验证）已执行，发现并修复了多个 bug，最终通过。

| Task | 描述 | 提交 | 状态 |
|------|------|------|------|
| 1 | 后端 ResumePatchEvent / ResumeGeneratedEvent | `4da16c4` | ✅ |
| 2 | CVEditorAgentTool 发 resume_patch + toolcall 白名单 | `0719c06` | ✅ |
| 3 | GenerateResumeTool 新建并注册 | `ba91baa` | ✅ |
| 4–6 | resumePatch.ts / ResumeContext / agentStream 新事件 | `49883da` | ✅ |
| 7 | ResumeDiffCard / ResumeGeneratedCard 组件 | `a83ac12` | ✅ |
| 8 | SophiaChat 路由 resume_patch/generated 事件 | `d6357fa` | ✅ |
| 9 | Workspace Editor 接入 ResumeContext，删 resumeEditDiff.ts | `9bdb0c6` | ✅ |
| 10 | 端到端验证 | 多个 fix 提交 | ✅（含 bug fix） |

---

## E2E 验证期间发现的 Bug 及修复

### Bug 1：前端 resume_patch/generated 数据双重嵌套
- **现象：** `event.data.data.patch_id` 而非 `event.data.patch_id`
- **原因：** agentStream.ts 对 SSE 事件 data 层解析多包了一层
- **修复：** `d1f30f2` — fix(frontend): fix resume_patch/generated double-nested data extraction

### Bug 2：后端 agent 遗留孤立 tool message
- **现象：** 流式返回时出现无对应 assistant 的 tool result，导致 API 报错
- **修复：** `8248693` — fix(backend): remove orphan tool messages + add resume_patch emit debug log

### Bug 3：前端 resumeEditError state 丢失 + useToolEventRouter 不接受 resume_patch
- **现象：** SophiaChat 重构后丢失了错误状态，tool event router 未处理新类型
- **修复：** `e6a64f4` — fix(frontend): restore resumeEditError state; accept resume_patch in useToolEventRouter

### Bug 4：流式传输错误和崩溃
- **现象：** SSE 流在特定情况下崩溃
- **修复：** `b010e13` — fix(backend+frontend): fix streaming errors and crash bugs

### Bug 5：有序列表渲染 + Apply 后 PDF 不重渲染
- **现象：** Markdown 有序列表显示异常；用户 apply patch 后 PDF 预览未更新
- **修复：** `ad33abc` — fix(frontend): fix ordered list rendering and PDF re-render after apply

### Bug 6：backend html_to_latex 未先做 Markdown→HTML 转换
- **现象：** LaTeX 生成时 Markdown 原文泄露，渲染失败
- **修复：** `1206a8c` — fix(backend): convert Markdown to HTML in html_to_latex before rendering

---

## 当前未提交变更

### `backend/latex_sections.py`（已修改，未提交）
- **内容：** 在 `generate_section_experience` 中增加对 `details` 字段的渲染
- **背景：** Experience 条目使用 `details`（HTML/Markdown 字符串）而非 `achievements` 列表，但 LaTeX 生成路径未处理该字段，导致工作经历描述在 PDF 中消失
- **影响：** 低风险，仅增量处理，已有 achievements 逻辑不受影响

### `frontend/src/pages/AgentChat/SophiaChat.tsx`（已修改，未提交）
- **内容：** 会话加载失败时调用 `setCurrentSessionId(sessionId)`，防止 URL effect 无限重试
- **背景：** 加载失败时 `currentSessionId` 未更新，下一个 useEffect 周期又重试相同 sessionId，造成 UI 卡死
- **影响：** 低风险，仅补 guard，不改正常路径

---

## 架构观察

### 正确的设计决策
1. **set-by-path 精确路径写入**：避免了 deepMerge 引起的数组项覆盖问题（多 patch 互不干扰）
2. **PendingPatch 带 message_id**：patch card 绑定到消息，渲染位置准确
3. **ResumeContext 放 App.tsx 顶层**：Chat 和 Editor 共享状态，无需 prop drilling

### 遗留风险
1. **GenerateResumeTool 无流式输出**：LLM 全量等待，长内容时用户体验差（后续可改 stream）
2. **ResumeContext.setResume 在 `generate_resume` 场景下无 resume.id**：POST 创建新简历的逻辑依赖后端返回 `res.data.id`，如接口结构不同会静默失败
3. **latex_sections.py 的 details 和 achievements 双路径**：两者可能同时存在，当前代码两者都渲染，需确认数据来源是否互斥

---

## 下一步建议

1. **提交当前两个未提交修复**（见上方未提交变更）
2. **补充 Task 10 的端到端测试用例文档**，作为回归测试参考
3. **验证 latex_sections.py details + achievements 双路径**，确认不重复渲染
4. **考虑 GenerateResumeTool 流式化**（可作为独立 feature）
