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
