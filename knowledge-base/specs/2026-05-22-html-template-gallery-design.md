# HTML 模板广场支持设计

## 日期

2026-05-22

## 背景

当前 `/templates` 已被调整为方向模板广场，但新建路径仍固定进入 `/workspace/latex`。系统实际有两条简历生成链路：

- LaTeX：后端渲染 PDF，模板由 `backend/resume_templates/latex` 注册。
- HTML：前端 `HTMLTemplateRenderer` 实时预览，浏览器端导出 PDF。

因此模板广场不能继续把方向模板和 LaTeX 排版模板绑定在一起。

## 决策

- 方向模板增加渲染引擎概念：`renderEngine: 'latex' | 'html'`。
- 方向模板增加引擎内模板 ID：`renderTemplateId`。
- 保留旧 `latexTemplateId` 兼容现有方向模板。
- 新建简历时统一写入：
  - `ResumeData.templateType = renderEngine`
  - `ResumeData.templateId = renderTemplateId`
  - `ResumeData.directionTemplateId = directionTemplate.id`
- `/templates` 根据方向模板引擎跳转：
  - LaTeX 模板进入 `/workspace/latex?directionTemplateId=<id>`
  - HTML 模板进入 `/workspace/html?directionTemplateId=<id>`
- HTML 模板第一版采用前端静态注册表，不新增后端 API。

## 数据库结论

不需要数据库迁移。现有 `resumes.data` 是 JSON 字段，已经保存完整 `ResumeData`，包含 `templateType`、`templateId` 和 `directionTemplateId`。本次仅新增 JSON 内字段取值和前端路由逻辑。

当前联调环境通过 `.env` 末尾 `USE_POSTGRESQL=true` 直接连接线上 PostgreSQL。该切换只影响运行时连接目标，不修改线上表结构。

## 数据流

1. 用户进入 `/templates`。
2. 页面按左右两栏分开展示 LaTeX 模板区和 HTML 模板区，用户在对应区域选择模板。
3. 点击方向模板。
4. 前端读取该模板的 `renderEngine`。
5. 跳转到对应工作区。
6. `useResumeData()` 在无 `resumeId` 的新建场景创建空白 `ResumeData`。
7. 工作区按 `templateType` 使用对应预览和导出链路。

## 扩展方式

新增 HTML 模板时：

1. 在 `frontend/src/pages/Workspace/v2/html/templates/registry.ts` 注册元数据。
2. 在 `HTMLTemplateRenderer` 中按 `templateId` 分发 renderer。
3. 在 `resumeDirectionTemplates.ts` 添加一个 `renderEngine: 'html'` 的方向模板，或复用已有方向模板映射到新 HTML 模板。
