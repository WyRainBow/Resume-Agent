# HTML 模板广场实施记录

## 日期

2026-05-22

## 范围

- 模板广场支持 LaTeX / HTML 双引擎方向模板，并按 LaTeX 模板区、HTML 模板区左右分开展示。
- 新增 `software-engineering-html` 方向模板。
- 新增 HTML 模板注册表，首个模板为 `html-classic`。
- HTML 工作区支持更换 HTML 模板。
- HTML 工作区顶部增加保存、导入、导出和更换模板入口。
- `.env` 当前切换为直接连接线上 PostgreSQL。

## 数据库

不需要数据库迁移。原因：

- `ResumeData.templateType` 已支持 `latex | html`。
- `ResumeData.templateId` 已存在。
- `ResumeData.directionTemplateId` 已存在。
- 后端 `resumes.data` 使用 JSON 存完整简历数据。

当前联调环境通过 `.env` 末尾 `USE_POSTGRESQL=true` 直接连接线上 PostgreSQL。

## 验证

- 契约测试：4 passed。
- 前端构建：`npm run build` 通过。
- 数据库连接：脱敏确认使用 PostgreSQL，线上 `users` 和 `resumes` 表存在。
- 完整 `tsc --noEmit` 仍失败，失败项为仓库既有类型问题；本次改动引入的 `useResumeData` 类型推断问题已修复。

## 剩余风险

- HTML 当前只有一个真实 renderer，后续增加多套视觉模板时，需要继续在 `HTMLTemplateRenderer` 中分发。
- `npx tsc --noEmit` 仍受历史类型债影响，不能作为当前仓库的强制通过门禁。
- HTML 模板预览缩略图暂用现有 `/product-preview.png`，后续应补真实模板截图。
