# Workspace 统一编辑器改造总结（合并路由 + 7 套模板 + 清代码债务）

- **日期**：2026-07-08
- **分支**：`feature/template-market`
- **关联设计**：[[2026-07-08-workspace接入builder模板系统-design]]（specs，原方案；实施超出其范围）
- **决策链**：用户拍板「合并成一个 /workspace」→「按顺序做」→「补齐 RM 全部 7 套模板」→「审计清理残留」

---

## 一、做了什么（按提交顺序）

| 提交 | 内容 |
|---|---|
| `7ff59bd8` | **spike**：Builder `ResumeRenderer` + `FormattingControls` 接入 `/workspace/html` 预览链路（`toBuilderResumeData` 适配 + `globalSettings.builderSettings` 读写） |
| `ae4ac0a0` | 删死组件 `HTMLTemplateRenderer` + `ResumePreviewPanel`（后者零消费者且是前者唯一使用者） |
| `8a45cb73` | 删滚动编辑（`ScrollEditMode`）/ JSON 编辑（`JsonEditMode`）模式，点击编辑成唯一布局；Header 模式切换按钮组一并移除 |
| `5db9d99f` | **统一模板选择器**：SidePanel 新增「模板」卡（两种引擎常驻），选中即切 `templateType`——数据驱动、非路由驱动；`FormattingControls` 加 `hideTemplateSection` |
| `66c572b4` | **三入口合并为一个 `/workspace`**：`/workspace`（当前简历）/`/workspace/:id`/`/workspace/new`（强制新建）；老路由 `latex\|html` 带 ID 兼容重定向；删 `v2/latex/`、`v2/html/` 两个入口（约 870 行）；HTML 下载按 `templateType` 分流（html2pdf）；全部跳转调用点（Dashboard/CreateNew/CocoChat）更新 |
| `6b42bfd7` | **补齐 RM 双栏两套**：`ResumeTwoColumn`（swiss-two-column）+ `ResumeModernTwoColumn`（modern-two-column），RM 7 套 HTML 模板全量对齐；模板卡变 8 选项（Classic LaTeX + 7 HTML） |
| `e2bfa4fd` | **残留审计清理**：ExportButton 恢复 html 模板的 PDF 导出（原先隐藏导致合并后 html 下载不可达）；删 `WorkspaceLayout.onDownload` 孤儿 prop；修两处指向已删路由的过期注释 |

### 现在的产品形态

- **一条编辑器路由**：`/workspace`。模板是设置项不是路由：左侧「模板」卡 8 个选项——**Classic LaTeX**（服务端 XeLaTeX，精确排版矢量 PDF）+ RM 7 套 HTML（Single Column / Two Column / Modern / Modern 2-Col / LaTeX Style / Clean / Vivid，实时预览秒切）。
- **按模板类型自动分流**：预览（PDF viewer ⇄ ResumeRenderer 实时渲染）、排版面板（LaTeX 排版设置 ⇄ FormattingControls）、导出（后端 PDF+额度 ⇄ 前端 html2pdf 不占额度）。
- **老链接不断**：`/workspace/latex[/:id]`、`/workspace/html[/:id]` 永久重定向且保留 ID。
- 双 LaTeX 命名区分：`Classic LaTeX`（真 XeLaTeX）vs `LaTeX Style`（RM 的 HTML 版 LaTeX 风格）。

### 验证痕迹

- 每步 `npm run build` 通过；浏览器实测：老路由重定向、模板双向切换（经典⇄Modern⇄LaTeX Style⇄Two Column 均截图核对）、Two Column 双栏（主栏+教育/技能侧栏）渲染正确。
- 双栏两套由并行 subagent 照既有移植口径逐节移植，per-file `tsc --noEmit` 零错误；**Modern 2-Col 未浏览器逐项核对**（用户自测中）。

---

## 二、没做的（留档 TODO）

1. **HTML 导出仍是 html2pdf（截图式，ATS 不可读）**——设计文档定的目标方案是 `window.print + @page` 真文字导出（Builder 页已验证），未迁移到统一入口。
2. **dev-only 控制台警告**（"Cannot update ResumeProvider while rendering HTMLWorkspace"）——html 入口已删，可能随之消失，未复测；功能无影响、生产不出现。
3. **双栏两套的移植取舍未逐像素核对**：subagent 按既有口径处理了 RM `additional`（languages/certifications 我方无字段未移植）、skills/awards 改侧栏 bullets、Two Column 侧栏 Links 标题保留英文 `'Links'`——细节是否满意待用户实测反馈。
4. **`/builder` 页去留**：模板市场独立页与统一 Workspace 功能已重叠（模板+排版+打印导出都进了 /workspace），是否下线 /builder 或改为纯展示橱窗，待定。
5. **AI 助手/JD 匹配等弹窗在 html 模板下的适配**未专门验证（编辑数据同源，理论无碍）。
6. 旧简历数据里 `builderSettings.template` 若存的是已存在值不受影响；新增两套对旧数据无迁移需求。

---

## 三、经验记录

- **拆路由省不掉分叉复杂度，只多出入口重复**——`templateType` 分叉无论如何都要写，合并后三个入口(1326 行)塌成一个,是本次最大的还债。
- **删除前必须全库 grep 而不是只看 `pages/`**：`HTMLTemplateRenderer` 在 `components/ResumePreviewPanel` 还有一个引用（所幸那也是死的），第一次 grep 漏了目录。
- **合并入口后要审计"按类型隐藏"的旧 UI 逻辑**：ExportButton 对 html 隐藏 PDF 是旧世界的合理设计，合并后直接把新接的下载链路变成不可达——这类"分流残留"比 import 残留更隐蔽。
