# AI 辅助编辑功能升级规划

> 状态：规划（未开发）｜日期：2026-06-18｜对标参考：`reference/JadeAI`
> 关联现状：`AIImportModal.tsx`、`SelectionPolishBubble.tsx`、`PolishChatDialog.tsx`
> 关联旧文档：`specs/2026-03-31-polish-chat-design.md`、`specs/2026-03-31-selection-polish-design.md`、`plans/2026-05-20-resume-scoring-plan.md`

## 执行进展（2026-06-18，全自动模式）

- ✅ **子任务1 完成**：修复并重启划词润色气泡。根因＝Tiptap v3 BubbleMenu 由 tippy 改 Floating UI，旧 `tippyOptions/onHidden` 失效；已迁移到 `options(placement/strategy/offset)+onHide`，打开 `ENABLE_SELECTION_POLISH_UI`，并把开发期调试日志改 no-op。build 通过 + 浏览器选词实测气泡正常浮出、console 无报错。提交：`dc24637`（plan 文档 `4f3876d`）。
- ⛔ **阻塞**：本地 9000 端口被无关进程 `./ark conf/run.local.ini` 占用，**我们的 FastAPI 后端未运行**，所有 `/api/*` 返回 404。不擅自 kill 用户的 `ark` 进程。→ 后续依赖后端的子任务（流式导入、JD 分析、语法体检）无法端到端验证，本轮暂缓；待 9000 释放并启动 `backend.main:app` 后再做（这些可用 pytest TestClient 做接口级验证，但前端联调仍需服务在 9000）。
- ⏭️ **桌面剩余项的取舍**：统一侧边 Copilot（P0-1）是对**现有可用润色功能**的重构，需后端流式联调验证才能保证不回归——在后端不可用期间不动它，避免改坏已上线功能。死代码 `AIPolishDialog.tsx` 按 CLAUDE.md「不相关死代码只指出不删除」保留。

## Context（为什么做）

Resume-Agent 已有三套 AI 辅助编辑能力，但彼此割裂、入口分散、移动端缺失，且能力停留在"单点改写/单次解析"，没有形成"理解简历 → 多轮优化 → 针对岗位改写"的闭环。本次升级对标 JadeAI 的流式交互、多角色对话、意图识别、移动端适配等成熟实践，把分散的 AI 入口整合为统一的「简历 AI Copilot」，并补齐移动端与岗位匹配闭环，目标是让"AI 改简历"从工具碎片升级为贯穿编辑全程的助手。

---

## 1. 现状分析与痛点挖掘

### 1.1 现有资产盘点

| 组件 | 路径 | 形态 | 后端 | 状态 |
|---|---|---|---|---|
| AI 导入解析 | `shared/AIImportModal.tsx`(978) + `hooks/useAIImport.ts`(613) | 居中 Modal，文件/文本/PDF | `/api/resume/parse`、`parse-section`、`upload-pdf`（**非流式 JSON**） | ✅ 启用 |
| 划词改写气泡 | `shared/SelectionPolishBubble.tsx`(951) | TipTap `BubbleMenu` 悬浮气泡 | `rewrite-text/intent` + `rewrite-text/stream`（**SSE**） | ⚠️ 被 `ENABLE_SELECTION_POLISH_UI=false` 关闭 |
| 工具栏润色 | `shared/PolishChatDialog.tsx`(371) | 居中 Modal，多轮对话 | `rewrite/stream`（**SSE**） | ✅ 启用 |
| 旧版润色 | `shared/AIPolishDialog.tsx`(292) | 居中 Modal，单轮 | `rewrite/stream` | 🗑️ 死代码，未挂载 |
| 全局对话 | `pages/AgentChat/SophiaChat.tsx` + `backend/agent`(Manus) | 独立页面 | `/api/agent/stream`（SSE，工具调用） | ✅ 启用但与编辑器割裂 |

### 1.2 核心痛点

**P-1 入口分散、心智割裂**：导入走 Modal、整段润色走另一个 Modal、划词走气泡、对话走独立页面。用户在"编辑简历"时面对 4 套不同的 AI 交互范式，没有统一的"AI 助手"概念。

**P-2 划词气泡交互打断感强（且已被关停）**：`SelectionPolishBubble` 用选区快照 + 锁定（`bubbleActiveRef`/`selectionSnapshotRef`）来对抗失焦丢选区，代码里大量 `logSelectionLockDebug` 痕迹说明稳定性曾出问题，最终用开关关掉。气泡浮层遮挡正文、出结果后又弹 chat 预览，层级跳动割裂。

**P-3 单次改写局限**：`rewriteResumeStream` 虽支持 `history` 多轮，但 `PolishChatDialog` 关闭即清空上下文（`open=false → setMessages([])`），无法跨字段、跨会话记忆"我整份简历想要什么风格"。改写只针对单个 `polishPath`，缺少"全局一致性"。

**P-4 导入非流式、反馈弱**：`/api/resume/parse` 是一次性 JSON，前端只能用计时器 + 脉冲进度条假装进度（解析常需 1-2 分钟），无逐字段流式落地，长等待体验差、易被当成卡死。

**P-5 移动端完全缺失**：三个组件全是居中 Modal/绝对定位气泡，无 `useIsMobile`、无断点、无底部 Sheet。`max-w-2xl` 在手机上接近全宽但内部布局未优化；划词气泡在触屏上几乎不可用（无长按选区交互）。

**P-6 缺少"针对 JD 优化"闭环**：已有简历评分（`scoreResume` / resume-scoring）但与编辑器、改写链路不打通——分析出"缺关键词"后不能一键落到对应字段，对标 JadeAI 的 `jd-analysis → handleOptimize → 应用` 闭环缺失。

**P-7 结构化能力弱**：改写接口返回纯文本流；意图识别 `detectRewriteTextIntent` 是亮点但仅用于划词，没有推广到"语法体检/JD 匹配/评分"等结构化场景（JadeAI 用 Zod schema 统一）。

---

## 2. 对标 JadeAI 的启发与理念借鉴

| JadeAI 实践 | 关键文件 | 迁移到"简历 AI 编辑"的理念 |
|---|---|---|
| **同构内容 + 差异化渲染** | `ai-chat-panel.tsx` / `ai-chat-bubble.tsx` 共用 `AIChatContent` | 一套 `<AiCopilotContent>` 同时驱动：桌面右侧栏、移动底部 Sheet、划词唤起的浮层。**只写一次对话体，容器负责形态。** |
| **视口状态全局化** | `use-media-query.ts` + Zustand `mobileActiveTab` | 用一个 `useIsMobile()` + 全局 UI 状态控制"编辑/预览"切换与助手形态，不在每个组件各判一次。 |
| **FAB + Sheet 移动方案** | `editor/[id]/page.tsx` 的 `md:hidden` FAB → Radix Sheet | 移动端：划词气泡 → 选中后底部 **Sheet** 升起；侧边助手 → 右下 FAB 唤起全屏/半屏 Sheet。 |
| **多角色 persona 库** | `lib/interview/interviewers.ts` + `interview-prompts.ts` | 定义"简历优化角色"：润色官（表达）、量化官（数据指标）、ATS 官（关键词）、精简官（篇幅）。每个角色独立 persona + systemPrompt 模板。 |
| **里程碑 marker token** | `[ROUND_COMPLETE]` + `use-interview-chat` 监听切换 | 改写流里用 `[APPLY_READY]` 等标记触发"可应用"状态，前端 hook 监听驱动 UI 状态机。 |
| **结构化输出 Zod schema** | `grammar-check-schema.ts` / `jd-analysis-schema.ts` + `extractJson` | 给"语法体检/JD 匹配/评分建议"定义 Input/Output schema，后端结构化返回 `{issues[], score, suggestions[{path,current,suggested}]}`，前端可"逐条一键应用"。 |
| **分析与落库解耦** | `jd-analysis-dialog handleOptimize → setPendingAiMessage → chat 应用` | 分析弹窗只产出"结构化建议"，落地复用统一的改写/写回通道，避免重复实现写库逻辑。 |
| **多轮 + 快捷标签** | 我方 `PolishChatDialog` 已有，JadeAI chat 同理 | 保留并强化：按字段类型给不同快捷标签，跨字段共享会话上下文。 |

---

## 3. 产品形态与核心功能规划（Product Spec）

### 3.1 目标产品形态：统一「简历 AI Copilot」

把现有 4 套割裂入口收敛为**一个 Copilot 内核 + 三种唤起形态**：

```
                    ┌─────────────────────────────┐
                    │   AiCopilot 内核（统一）       │
                    │  · 会话上下文（整份简历感知）   │
                    │  · 意图识别 + 角色路由          │
                    │  · 流式改写 / 结构化分析        │
                    │  · 建议→一键应用（写回通道统一） │
                    └─────────────────────────────┘
                       ▲           ▲            ▲
          ┌────────────┘           │            └────────────┐
   形态A：侧边助手          形态B：划词浮层/Sheet      形态C：导入向导
   （桌面右栏 / 移动 FAB+Sheet）  （选中文本→改写）        （首次/整份导入）
```

- **形态 A · 侧边 Copilot**：桌面端右侧常驻面板（可折叠），移动端右下 FAB → 底部 Sheet。承载多轮对话、快捷标签、"针对 JD 优化"、"全简历体检"。取代 `PolishChatDialog` 的孤立 Modal 与 `SophiaChat` 的独立页面。
- **形态 B · 划词改写**：桌面端复用并修稳 `SelectionPolishBubble`（解决失焦/锁选区）；移动端选中文本后从底部升起 **Polish Sheet**（避免触屏气泡定位难题）。两端共用同一改写内核与 intent 识别。
- **形态 C · 导入向导**：`AIImportModal` 升级为流式逐字段落地 + 可编辑预览；桌面 Modal、移动全屏 Sheet。

### 3.2 核心功能矩阵

#### P0（必做，体验闭环 + 移动可用）
- **P0-1 统一 Copilot 内核**：抽出 `<AiCopilotContent>`（对话 + 快捷标签 + 应用），桌面侧栏 / 移动 Sheet / 划词浮层三处复用。
- **P0-2 移动端适配地基**：`useIsMobile` hook + 全局 UI 状态（编辑/预览切换、Copilot 开关）；导入与划词在移动端改为**底部 Sheet**。
- **P0-3 划词改写修稳并重启**：解决选区锁定/失焦问题，移动端转 Sheet，把 `ENABLE_SELECTION_POLISH_UI` 安全打开。
- **P0-4 导入流式化**：`/api/resume/parse` 增加 SSE 流式变体，逐 section 落地 + 实时进度，替代假进度条。

#### P1（增强，差异化能力）
- **P1-1 针对 JD 一键优化闭环**：JD 输入 → 结构化分析（匹配/缺失关键词/分段建议）→ 逐条"应用到对应字段"（复用改写写回通道）。
- **P1-2 全简历语法/表达体检**：Zod 结构化 `{issues[], score}`，弹窗展示 before→after，"一键修复"复用 Copilot 应用通道。
- **P1-3 跨字段会话记忆**：Copilot 记住"整份简历风格偏好"（如"全程用动词开头、量化数据"），改写时注入上下文。
- **P1-4 简历优化多角色**：润色官 / 量化官 / ATS 官 / 精简官，persona + systemPrompt 模板化，用户可选"用哪种视角优化"。

#### P2（演进，专业度与生态）
- **P2-1 结构化输出统一框架**：所有分析类接口走 Input/Output schema，前端强类型消费。
- **P2-2 评分多维可视化**：雷达图 + 维度分 + 趋势对比（对标 interview-report）。
- **P2-3 改写版本历史/对比**：保留每次改写快照，支持回滚与 diff（强化现有 `DiffOverlay`）。
- **P2-4 Copilot 工具调用编排**：让侧边 Copilot 能调用"改某字段/加章节/换模板"等工具（复用 `backend/agent` 工具体系），向 JadeAI chat-tools 看齐。

---

## 4. 交互与 UI/UX 设计（Design Spec）

### 4.1 关键 User Flow

**Flow A · 侧边 Copilot 多轮优化**
1. 桌面点工具栏「AI 助手」/ 移动点右下 FAB → 形态 A 打开（桌面右栏 / 移动底部 Sheet）。
2. Copilot 默认问候 + 快捷入口：「优化这段」「针对 JD 优化」「全简历体检」。
3. 用户选中某字段或直接对话 → 流式改写 → 结果气泡带「查看对比 / 应用此版本 / 继续调整」。
4. 应用 → 写回对应 `path` → 画布与预览刷新；会话上下文保留，可继续追问。

**Flow B · 划词改写（桌面气泡 / 移动 Sheet）**
1. 选中 ≥2 字符文本。
2. 桌面：选区上方浮出气泡（输入指令 + 快捷标签）；移动：底部升起 Polish Sheet。
3. 输入指令 → `intent` 识别：纯格式类（加粗/取消/转列表）本地即时变换、改写类走 SSE 流式。
4. 预览 before→after → 「应用」用 ProseMirror `replaceRange` 精确替换选区 / 「取消」还原。

**Flow C · 流式导入向导**
1. 入口（顶栏「AI 智能上传」或各模块「AI 导入」）→ 桌面 Modal / 移动全屏 Sheet。
2. 选择文件/粘贴文本/上传 PDF → 提交。
3. **流式**：逐 section 边解析边出现在可编辑预览区（带骨架占位 + section 级完成标记）。
4. 用户在预览区微调 → 「确认填充」→ 全局替换或分模块追加（复用 `useAIImport` 的映射逻辑）。

**Flow D · 针对 JD 优化（P1）**
1. Copilot 内「针对 JD 优化」→ 粘贴 JD。
2. 后端结构化返回 `{overallScore, matched[], missing[], suggestions[{path,current,suggested}]}`。
3. UI 列出建议卡片（含 before→after）→ 用户勾选 → 「应用所选」→ 逐条经统一写回通道落地。

### 4.2 桌面 vs 移动差异化

| 能力 | 桌面 | 移动（< 768px） |
|---|---|---|
| 侧边 Copilot | 右侧常驻可折叠面板（宽 ~360px） | 右下 FAB → 底部 Sheet（半屏可拖到全屏） |
| 划词改写 | 选区上方悬浮气泡 | 选中后底部 **Polish Sheet**（不依赖选区坐标定位） |
| 导入向导 | 居中 Modal（`max-w-4xl`） | 全屏 Sheet（`h-[100dvh]`，分步竖向堆叠） |
| 编辑 / 预览 | 并排（编辑 4 : 预览 6） | 顶部 Tab 切换（复用全局 `mobileActiveTab` 思路） |
| 快捷标签 | 横向 wrap | 横向可滚动 chip 条 |

**移动端实现要点**（对标 JadeAI）：用 `useIsMobile()` 决定容器；Sheet 组件统一（Radix Dialog/Drawer 风格，注意项目现有 Radix Slot 依赖）；用 `100dvh` 规避移动端地址栏高度问题；触屏改写以"选中→底部 Sheet"替代气泡，规避选区锁定难题。

---

## 5. 技术架构与落地路径（Implementation Plan）

### 5.1 前端重构建议

- **状态管理**：项目当前用 Context（非 Zustand）。新增 `CopilotContext`（或轻量 store）集中管理：`isMobile`、`copilotOpen`、`copilotMode('chat'|'jd'|'review')`、`activeSessionContext`、`mobileTab`。避免把会话态散落在各组件 `useState`。
- **统一对话体**：抽 `shared/ai/AiCopilotContent.tsx`（消息流 + 输入 + 快捷标签 + 应用按钮），由 `AiSidePanel` / `AiSheet` / `SelectionPolishSheet` 三个容器包裹复用（对标 `AIChatContent`）。
- **流式渲染**：复用现有 `useTypewriter` + SSE 解析（`rewriteResumeStream`/`rewriteTextStream` 的 `data:` 分帧逻辑已成熟，抽成 `useSseStream` 通用 hook，导入流式也复用）。
- **Tiptap/ProseMirror 写回**：沿用 `SelectionPolishBubble` 的 `ProseMirrorDOMParser.parseSlice + tr.replaceRange(from,to)`（精确选区替换）与 `PolishChatDialog → onChange`（整字段替换）两条已验证通道，统一封装 `applyPolishResult(target, html)`。
- **划词稳定性**：把选区锁定逻辑（`selectionSnapshotRef`/`bubbleActiveRef`/`shouldShow`）从 `RichEditor/index.tsx` 抽成 `useSelectionLock` hook 并补测，移动端走 Sheet 旁路不依赖该锁。
- **移动适配**：新增 `useIsMobile()`（`matchMedia('(max-width:767px)')` + resize，参考 JadeAI 实现）；新增统一 `BottomSheet` 容器。

### 5.2 后端 API 配合（FastAPI，端口 9000）

- **流式导入**：在 `backend/routes/resume.py` 增 `/api/resume/parse/stream`（SSE），按 section 边解析边推 `data:{section, data}`；前端逐段落地。（沿用现有 LLM 解析逻辑 `parse_resume_text`，改造为分段产出。）
- **意图识别推广**：现有 `/rewrite-text/intent` 模式推广，为 JD/语法体检新增结构化接口：`/api/resume/jd-analysis`、`/api/resume/grammar-check`，返回经 Pydantic 校验的结构化 JSON `{score, issues[], suggestions[{path,current,suggested}]}`（对标 JadeAI Zod schema，Python 侧用 Pydantic）。
- **上下文记忆**：改写接口 `history` 参数已具备；新增"简历风格偏好"字段随会话传入 system 注入（对标 interview-prompts 模板化），偏好可存前端 `globalSettings`。
- **多角色 prompt 模板**：后端新增 `resume_roles.py`（润色/量化/ATS/精简 persona + systemPrompt 构建函数），改写/分析接口接收 `role` 参数。
- **复用 Agent 工具体系（P2）**：侧边 Copilot 的"改字段/加章节"走 `backend/agent` 既有工具 + `/api/agent/stream`，避免另起一套。

### 5.3 分阶段实施计划（Task-by-task）

#### 阶段 0 · 地基（移动 + 状态 + SSE 抽象）
- [ ] 新增 `hooks/useIsMobile.ts`（matchMedia + resize，SSR 安全）
- [ ] 新增 `shared/ui/BottomSheet.tsx`（移动底部抽屉，`100dvh` 处理）
- [ ] 抽 `hooks/useSseStream.ts`（统一 SSE 分帧 + onChunk/onComplete/onError + AbortController）
- [ ] 新增 `contexts/CopilotContext.tsx`（copilotOpen/mode/mobileTab/会话上下文）
- [ ] 工作台编辑/预览在移动端用 `mobileTab` 切换（对标 editor-mobile-tab-bar）

#### 阶段 1 · 统一 Copilot 内核（P0-1）
- [ ] 抽 `shared/ai/AiCopilotContent.tsx`（迁移 `PolishChatDialog` 的消息流/快捷标签/打字机/DiffOverlay/应用逻辑）
- [ ] 新增容器 `AiSidePanel`（桌面右栏）与 `AiSheet`（移动底部 Sheet），复用 `AiCopilotContent`
- [ ] 工具栏「AI 润色」改为唤起统一 Copilot（保留快捷标签按 `path` 区分）
- [ ] 封装 `applyPolishResult()`（整字段 / 选区两种写回统一入口）
- [ ] 回归：多轮对话、应用、对比浮层在桌面/移动均可用

#### 阶段 2 · 划词改写修稳并重启（P0-3）
- [ ] 抽 `hooks/useSelectionLock.ts`（从 `RichEditor` 剥离选区快照/锁定逻辑）+ 补充用例
- [ ] 桌面气泡复用 `AiCopilotContent` 的改写内核（intent + SSE）
- [ ] 移动端：选中文本 → `SelectionPolishSheet`（底部 Sheet，不依赖选区坐标）
- [ ] 验证选区写回（`replaceRange`）在加粗/取消/转列表/改写四类意图下正确
- [ ] 安全打开 `ENABLE_SELECTION_POLISH_UI`（桌面气泡 + 移动 Sheet 双形态）

#### 阶段 3 · 导入流式化（P0-4）
- [ ] 后端 `/api/resume/parse/stream`（SSE，按 section 产出）
- [ ] `AIImportModal` 升级：流式逐 section 落到可编辑预览（骨架 + 完成标记），替代假进度条
- [ ] 移动端导入改为全屏 Sheet
- [ ] 复用 `useAIImport` 映射逻辑做"确认填充"（全局替换 / 分模块追加）

#### 阶段 4 · JD 优化闭环 + 语法体检（P1-1 / P1-2）
- [ ] 后端 `/api/resume/jd-analysis`、`/api/resume/grammar-check`（Pydantic 结构化返回）
- [ ] Copilot 内「针对 JD 优化」「全简历体检」入口 + 建议卡片（before→after + 勾选应用）
- [ ] "应用所选"逐条经 `applyPolishResult()` 落到对应 `path`
- [ ] 与现有 `scoreResume`/resume-scoring 打通，避免重复实现

#### 阶段 5 · 多角色 + 记忆 + 可视化（P1-4 / P1-3 / P2-2）
- [ ] 后端 `resume_roles.py`（润色/量化/ATS/精简 persona + prompt 模板）
- [ ] 改写/分析接口接收 `role`，Copilot UI 提供角色切换
- [ ] 简历风格偏好注入会话上下文（存 `globalSettings`）
- [ ] 评分多维雷达图 + 趋势对比组件

#### 阶段 6 · 收尾
- [ ] 清理死代码 `AIPolishDialog.tsx`（确认无引用后删除）
- [ ] 桌面/移动端全链路 `npm run build` + 浏览器实测（导入/划词/侧边 Copilot/JD 优化）
- [ ] 关键后端接口 `pytest` 或 HTTP 三路测试（正常/空值/错误）
- [ ] 更新 `knowledge-base`（specs/reviews）与本计划勾选状态

---

## 验证方式（End-to-End）

1. **前端构建**：`cd frontend && npm run build` 通过。
2. **桌面实测**（5173 + 9000）：导入流式逐段落地 → 划词气泡四类意图 → 侧边 Copilot 多轮改写 + 应用 → JD 优化逐条应用 → 预览/PDF 刷新一致。
3. **移动实测**：浏览器设备模拟 < 768px：编辑/预览 Tab 切换、FAB+Sheet Copilot、选中文本底部 Polish Sheet、导入全屏 Sheet。
4. **后端**：新增 SSE/结构化接口三路测试（正常 / 空输入 / LLM 失败），确认结构化字段经 Pydantic 校验。
5. **回归**：确认关闭/打开 `ENABLE_SELECTION_POLISH_UI` 不破坏既有编辑；会话应用写回不丢其他字段（参考此前"加粗导致内容消失"类回归）。

---

## 关键决策点（已确认 2026-06-18）

- D1 ✅ **并存**：编辑场景内聚到新的侧边 Copilot；全局 `SophiaChat` 页面保留。**硬约束：本次升级全程不改动 Agent 页面（`pages/AgentChat/SophiaChat.tsx`）及其后端路由 `/api/agent/*`。**
- D2 ⏸️ **暂缓（2026-06-18 用户决定"暂时不做移动端"）**：移动端适配（含划词底部 Sheet、FAB+Sheet、编辑/预览 Tab、导入全屏 Sheet）整体延后。本轮所有方案按**桌面端优先**推进；移动端相关任务（P0-2 及各阶段 mobile 子项）标记为 deferred，后续再启。原结论保留备查：移动端划词完全用底部 Sheet 替代气泡。
- D3 ✅ **先通用**：MVP 先做单一"通用优化"，多角色（P1-4）作为后续增强。
- D4 ✅ **复用 Pydantic**：结构化分析后端复用 FastAPI 既有 Pydantic，不引入额外校验库。

> 实施约束补充：新增组件优先"新文件 + 在同一增量内接入首个消费方"，不预先堆叠无消费方的抽象（遵循 CLAUDE.md 简单优先 / 外科式修改）。
