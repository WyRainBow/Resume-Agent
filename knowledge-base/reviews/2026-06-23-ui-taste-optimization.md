# UI 优化操作记录（taste-skill + 刘小排）

> 日期：2026-06-23
> 分支：`feature/06-23/01`
> 相关提交：`40123bd`（JD 弹窗）、`3fa4f03`（ScoreCard）、`a4c31e6`（agent-chat）

## 背景

用户要求用 **taste-skill**（`.claude/skills/taste-skill`，anti-slop 前端设计技能）+ 刘小排设计思想，优化工作台与 AI 对话（agent）页，修复"不少问题"。

---

## 做了什么

### 1. JD 匹配：底部常驻大框 → 聚焦弹窗（`40123bd`）

- **原状**：工作台底部常驻一个"职位描述匹配评分"大空框（`index.tsx` 旧 341–363），体验割裂、永久占位、空框吓人；点 AI 助手只是滚动跳过去。
- **改为**：新增 `Workspace/v2/shared/JdMatchDialog.tsx` 聚焦弹窗 —— 粘 JD → 多维匹配评分（ScoreCard）→「一键优化简历」进入逐字段优化（JdOptimizeDialog）。与「翻译」「体检」弹窗同一套壳/头部。删除底部大框；AI 助手 JD 入口改为打开该弹窗。
- **两条评分链路是互补的**：`scoreResume`→ScoreCard 多维诊断（轻、快），`jdOptimize`→JdOptimizeDialog 可应用的逐条改写（重、~14s）。做成"粘 JD → 快速诊断分 → 一键深度优化"的渐进流程。

### 2. ScoreCard 深色模式（`3fa4f03`）

- **原状**：`components/ScoreCard.tsx` 纯浅色硬编码（`border-gray-200`/`bg-gray-100`/`text-gray-500`），放进深色 JD 弹窗里突兀。
- **改为**：补全 `dark:` 变体 + 对齐 neutral 风格 + 精简布局（去掉冗余标题）。仅在 `JdMatchDialog` 使用，安全。

### 3. agent-chat taste-skill 视觉优化（`a4c31e6`）

| 文件 | 改动 | taste 原则 |
|---|---|---|
| `ResumeGeneratedCard.tsx` | 补全 `dark:` 变体 + 按钮 `active:scale` 触觉 | Theme Lock + 4.5 触觉 |
| `Composer.tsx` | 4 个按钮加 `active:scale` 触觉反馈 | 4.5 触觉 |
| `SophiaChat.tsx` | 错误卡 + 加载文案补全 `dark:` | Theme Lock |
| `AgentPdfPreviewPanel.tsx` | 错误态：文字链接 → 带 dark 对比的触觉重试按钮 | 4.5 错误态 |

---

## taste-skill 应用的核心原则

- **Theme Lock（4.11）**：一个页面一种主题，不能浅色块插进深色页 → 补全所有 `dark:` 变体。
- **触觉反馈（4.5）**：交互按钮 `:active` 用 `scale-[0.98]/scale-95` 模拟物理按压。
- **错误态清晰（4.5）**：错误用带对比/图标的态 + 可点重试按钮，不是裸文字。

---

## 一个诚实的审计发现（重要）

派只读子 agent 调研出一份 Top12 问题清单，但**逐条核对真实代码后发现大量虚报**：

- `Composer`、`AgentPdfPreviewPanel`（本就有"点击重试" + spinner + progress）、`AssistantPaperCard`、空态（欢迎语 + 4 张带图标引导卡）——**本来就写得规范**，统一设计 token（`chat-border/surface/accent` + `dark:`）。
- "中文逗号→顿号"那条大多是**分句逗号**，改成顿号反而语法错；真正的并列（"优化、诊断"）本就是顿号。

**结论：只修真实缺口，没有为凑数去改没坏的好代码**——那恰恰违背 taste-skill 自身的 anti-slop 内核与项目"外科式修改、不重构没坏的东西"的规矩。

---

## 刻意没做的

- **`SophiaChat` 4360 行巨型组件拆分**：属于**架构重构**（非设计），且核对后确认**高风险**——光 PDF 预览状态就 **45 处引用**，`setResumePdfPreview` 被会话清理/补丁应用/清空对话等多处**直接调用**。这类运行时回归构建查不出，需逐 hook 拆 + `/agent/new` 实测。已单独成计划：`plans/2026-06-23-sophiachat-refactor-plan.md`。不在"设计优化轮"里仓促硬改核心页。

---

## 环境事故记录（教训）

本会话超长，累积重型进程（`.venv` 后端含 opencv/mineru 重依赖、多个 node dev server、CDP flood 开的多个 `/agent/new` 重型标签）把机器拖入**间歇性内存抖动**：

- 现象：trivial 命令（`echo`/单条 `curl`）能过，重操作（`Edit`/`Write`/`git`/`lsof`/`npm build`）反复超时，一度连提交都做不了。
- 根因：内存被吃满 → swap 抖动。`/agent/new` 每个标签加载 1.4MB SophiaChat + mermaid/cytoscape/katex 重 chunk，是主要黑洞之一。
- 教训：
  1. **CDP 测试复用单标签，绝不 flood**。
  2. 超长会话定期清理后台进程。
  3. 恢复手段：`pkill` 三端（尤其 `.venv` 后端 `uvicorn`）+ 关多余 Chrome 标签释放内存。

---

## 后续修复（2026-06-24）

### 4. JD 优化建议卡富文本渲染（`a67b238`）

- **现象**：「针对 JD 优化简历」弹窗里每条 before→after 建议，把富文本字段的 HTML（`<ul class="custom-list"><li><p><strong>…`）当纯文本直接显示，裸标签堆叠、格式混乱。
- **根因**：`shared/JdOptimizeDialog.tsx` 直接 `{it.original}` / `{s.suggested}` 渲染，而 skills / 经历等字段的值本就是 TipTap 输出的 HTML 串（应用时要写回字段，**数据必须保留 HTML**，不能在数据层 strip）。
- **改为**：新增 `RichFieldText` 渲染器，按 `looksLikeHtml`（复用 `utils/resumePatch`）分流：
  - HTML → `.diff-rich-content` 容器 + `dangerouslySetInnerHTML`（复用 `utils/linkifyText` 的 `linkifyHtmlContent`），正确渲染圆点列表与 `<strong>` 加粗；
  - 纯文本 → 保留换行直显。
  - 修改前弱化（`neutral-400`）、修改后强调（`neutral-800` 加粗），与对话区 diff 卡 `components/agent-chat/DiffRichContent.tsx` 同一视觉语言；去掉套在多行 HTML 列表上很乱的删除线。
- **复用而非新造**：检测（`looksLikeHtml`）、安全渲染（`.diff-rich-content` 全局样式）、URL 链接化（`linkifyHtmlContent`）全部复用既有设施，改动集中在 **1 个 helper + 4 处替换**。
- **验证**：`npm run build` 通过；真实走 workspace → AI 助手 →「JD 匹配优化」→ 粘贴架构师 JD → 一键优化，LLM 返回 9 条建议，建议卡富文本正确渲染、不再露标签。

### 其它 06-24 改动（同属本轮前端/agent 优化）

- `641f674`：把 `AgentChat/SophiaChat.tsx` 内联对话空态抽成 `components/agent-chat/ChatEmptyState.tsx`（纯展示、行为一致），瘦身巨型组件。
- `d4cccdd`：`frontend/package.json` 的 `dev` 脚本移除 `clean:vite`，`.vite` 缓存跨重启持久化，消除首进 `/agent/new` 的冷启动整页 reload 闪屏。

> 本地 agent 鉴权 401（前端缺 `VITE_API_VIA_AUTH_WEB=true` + 后端 `FASTAPI_INTERNAL_AUTH_SECRET` 末尾 `=` 丢失）属**环境配置**问题，修复落在 gitignored 的本地 env 文件、不入库，已记入部署 runbook 排障表，不在此 UI 记录展开。
