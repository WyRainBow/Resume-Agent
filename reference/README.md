# reference — 竞品调研与参考资料

> 约定（2026-07-07 起）：**所有竞品调研都归档到这里**。
> - `docs/` — 调研文档（进 Git，团队共享）
> - `projects/` — clone 下来的参考项目源码（**不进 Git**，见 `.gitignore` 的 `reference/projects/`；按下方清单自行 clone）

## docs/ 文档

| 文档 | 说明 |
|---|---|
| [2026-07-06-竞品AI交互调研-简历工具与vibecoding.md](docs/2026-07-06-竞品AI交互调研-简历工具与vibecoding.md) | 两路调研：开源简历项目 + AI 原生产品的交互模式 → Coco 四缺口与落地优先级（缺口 1/2 已在 v2.14.x 落地） |
| [2026-07-07-重点参考项目探索.md](docs/2026-07-07-重点参考项目探索.md) | 用户点名的 3 个重点项目源码探索：Resume-Matcher 模板体系、vibe-resume、shushu-internship-tool |
| [2026-07-08-neo-brutalism-design-research.md](docs/2026-07-08-neo-brutalism-design-research.md) | neo-brutalism / Swiss brutalist 视觉语言调研：定义与历史、构成要素、18+ 参考站点/开源库/资源、Tailwind 硬阴影实现要点与无障碍坑、与本项目 `SwissButton`/DashboardPage token 的对照（服务 `/builder`·`/my-resumes`·`/workspace` 视觉换新） |

## projects/ 本地参考项目

| 项目 | 来源 | 参考点 |
|---|---|---|
| `liuxiaopai-notes` | https://github.com/WyRainBow/liuxiaopai-notes | 刘小排产品思维笔记，本项目产品方法论来源（详见 knowledge-base 路线图「方法论」节） |
| `Resume-Matcher` | https://github.com/srbhr/Resume-Matcher | ⭐模板体系：7 个自研 React+CSS 模板（其 `latex` 模板与我们默认模板同为 billryan 系视觉基因）；多模板要学它的数据/样式分离 + registry，渲染留在我们的 LaTeX 层 |
| `vibe-resume` | https://github.com/LiuMengxuan04/vibe-resume | ⭐两件可抄：130 行 Chromium 动态测高单页 PDF 导出；「AI 编辑纪律 + 改后产物断言」SKILL 契约 |
| `shushu-internship-tool` | https://github.com/LiuMengxuan04/shushu-internship-tool | ⭐低频→高频产品结构参照：JD 一等实体→一 JD 一版本→投递 readiness 检查表；评分 breakdown+分项理由模式适用简历评分 |

## 调研过但未 clone 的竞品速查

**开源简历类**：Reactive Resume（字段旁行内 AI 微操作）· Resume Matcher（JD 逐条对照重写）· ResumeLM（主简历→岗位定制版 + ATS 仪表盘）· Resume Alchemy（毒舌 HR 人格 + 六维雷达）· PrismaAI（空洞经历深挖追问 + 用户记忆）。

**AI 原生交互类**：Cursor（Cmd+K 选中精修）· GitHub Copilot（Ask/Edit/Agent 分档）· v0.dev（版本回退 + Design Mode）· bolt.new（报错自愈 + Plan→Implement）· Lovable（四模式预览工具条）· **Replit Agent（checkpoints + 时间旅行——版本时间线立项头号参照）** · Claude Artifacts（原地刷新 + 版本回溯）· ChatGPT Canvas（选中定向编辑 + 档位菜单）· Perplexity（follow-up chips）。

各项目的具体落地建议见 docs/ 里的调研文档。

> 已明确不参考：OpenResume、JadeAI（用户 2026-07-07 决定，本地 clone 已删除，不再列入调研引用）。
