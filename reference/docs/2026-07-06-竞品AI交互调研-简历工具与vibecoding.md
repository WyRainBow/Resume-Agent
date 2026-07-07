# 竞品 AI 交互调研：开源简历工具 + vibe coding 产品 → Coco 落地启发

> 日期：2026-07-06
> 缘起：用户希望 Coco 更「主动、协作」（主动问用户想做什么优化、优化后追问是否满意、指出薄弱点）。上网调研两类产品的交互设计，提炼可落地到 Coco 的点。
> 方法：两路并行 web 调研（真实检索 GitHub/产品页），B 路同时对照本仓库现有组件核实「已有 vs 缺口」。
> 关联：[[2026-07-06-AI交互loading反馈优化-刘小排视角]] · [[2026-07-04-产品打磨路线图]]

---

## 一、结论先行

**我们不缺「功能」，缺的是「主动的时机」和「精修的粒度」。** 现有链路（并排预览、流式反馈、应用前 diff 卡、下一步 chip、失败重试）在 Cursor/v0/Lovable/Canvas 里被反复验证是对的，方向没错。差距集中在四个缺口，见第三节。

---

## 二、Coco 现状（代码核实，别重造）

| 交互模式 | 现有实现 | 判定 |
|---|---|---|
| 并排实时预览 + 应用后高亮 | `AgentPdfPreviewPanel` + `justUpdated` 脉冲 | ✅ 已有（可增强「定位到被改段」） |
| 流式思考/输出 | `ThinkingIndicator`/`ThoughtProcess`/`StreamingLane` | ✅ 已有 |
| 进度反馈 | `ParseImportTimerBadge`、整份优化 N/M | ✅ 已有 |
| 应用前 diff + Apply/Reject + 全部应用 | `ResumeDiffCard` + `ApplyAllPatchesBar` | ✅ 已有（很完整） |
| 主动引导 / 下一步 chip | `GuidanceChoicesCard`/`IntentChips`/导入卡/诊断卡 | ✅ 已有（缺「编辑后」时机） |
| 失败不静默 + 一键重试 | 导入失败 `RotateCcw` | ✅ 已有（可扩到诊断项一键修） |

---

## 三、四个真缺口（按性价比排）

### 缺口 1 🟡 编辑后不追问，留了空场 —— 最贴合「让 Coco 主动」
追问 chip 机制我们有，但只挂在开场/导入/诊断；**每次优化应用完之后是沉默的**。Perplexity（follow-up chips）、ChatGPT Canvas 都在「做完一步」立刻把下一步递到用户面前。
- 落地：每次应用后固定追问「满意吗 + 下一处建议」（≤3 chip，首个主 CTA），并点名当前最该修的 1–2 个弱点（弱动词/无量化/表述模糊），每处配「一键让我改」。

### 缺口 2 🟡 缺「针对这一段」的一键微调（少打字）
只有宏观 chip（优化整份/某段），没有 Canvas 那种 **档位化一键操作**：更简洁/更量化/换强动词/篇幅滑块/语气。用户想微调得自己组织语言打字。
- 落地：对某段给档位化 chip 菜单（篇幅、语气、体现数据、对齐 JD），一点即重写回 diff 卡。

### 缺口 3 🔴 选中某块 → 只改那块（局部精修）——结构性短板
预览是渲染后的 **PDF blob 不可点选**，只能文字点名（git log 记录过「section 点名被上下文劫持」）。Lovable「Select elements」、ChatGPT Canvas 选中编辑、Cursor Cmd+K、v0 Design Mode 的核心范式。
- 落地：在**结构化简历面板**（非 PDF 图）给条目级 hover「优化这段」→ 把该段路径+原文 attach 进 Composer → AI 只改这段回 diff 卡（复用现有 patch 链路）。附带允许双击直接改字（免 AI、省 token）。同时治「上下文劫持」病根：显式选中就只改选中。

### 缺口 4 🔴 没有「撤销这次 / 回到上一版」
应用前能审，应用后（尤其「全部应用」整份优化）不满意只能手改。简历就一份 JSON，快照回滚成本极低、ROI 高。Replit checkpoints & App History、v0 versions、Artifacts 版本回溯是范式。
- 落地：每次应用/整份优化打一个带描述的简历快照，chat/预览顶栏给「↩︎ 撤销这次 / 回到上一版（可先预览旧版 PDF）」。

---

## 四、Top 建议顺序

1. **缺口 1+2 合并做：优化后主动追问满意度 + 一键微调菜单**（本条最贴用户目标、改动最小、复用现成链路、两路调研独立都排进 Top 3）。
2. **缺口 3：选段精修**（结构性升级，独立中等工程，下一站）。
3. **缺口 4：版本时间线 / 撤销**（安全感与掌控，独立中等工程）。

其余小缺口：Plan→一键 Implement（整份优化前先出可勾选计划卡）、模式分档（给建议 vs 直接改）、可选「严格 HR」点评人格（放大改的动机，需温和/严格切换避免劝退）。

---

## 五、逐产品要点索引（备查）

**开源简历工具：** Reactive Resume（字段旁行内 AI 微操作）· Resume Matcher（JD 逐条对照重写、AI 是协作编辑用户先审后用）· ResumeLM（主简历 vs 岗位定制版 + ATS 仪表盘）· Resume Alchemy（毒舌 HR 人格 + 流式润色 + 六维雷达 + 单句三模式）· PrismaAI（空洞经历 human-in-the-loop 深挖追问 + 用户记忆）。（OpenResume、JadeAI 已于 2026-07-07 按用户决定移出参考。）

**vibe coding / AI 原生：** Cursor（Cmd+K 选中就地改 + 红绿 diff Accept/Reject）· Copilot Chat（Ask/Edit/Agent 分档 + 行内召唤 + 低风险自动应用）· v0（Design Mode 选元素微调 + 版本回退）· bolt.new（报错自愈闭环 + Plan→Implement 按钮）· Lovable（四模式工具条：选元素/就地改字/涂画/便签）· Replit Agent（checkpoint + App History 时间旅行 + 旧版可预览）· Claude Artifacts（产物原地刷新 + 版本回溯）· ChatGPT Canvas（选中定向编辑气泡 + 快捷菜单档位化 + 定向改 vs 整篇重写）· Perplexity（follow-up chips 一键入 composer，≤3 个克制）。
