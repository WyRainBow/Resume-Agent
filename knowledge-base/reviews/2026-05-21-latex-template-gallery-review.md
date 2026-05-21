# LaTeX 模板广场实施记录

## 日期

2026-05-21

## 范围

- 新增后端 LaTeX 模板注册表，内置 `classic` 与 `compact`。
- 新增模板列表和预览接口：`GET /api/resume-templates?type=latex` 与 `GET /api/resume-templates/{template_id}/preview`。
- PDF 普通渲染和流式渲染支持 `template_id`，缺省兼容 `resume.templateId` 与 `classic`。
- 新增前端 `/templates` 模板广场。
- 创建页的 LaTeX 入口改为进入模板广场。
- 工作台新增“更换模板”，只修改 `templateId/templateType`，不重置简历内容。
- 前端兼容历史 `default` 模板 ID，统一归一化为后端 `classic`。

## 实施说明

- 后端方案采用“每套模板一个 renderer”的方案 B。
- 当前 `compact` 作为第一版示例模板，复用现有 LaTeX 生成器并覆盖紧凑排版参数。
- 模板选择后的新建路径使用 `/workspace/latex?templateId=<id>`，由 `useResumeData()` 初始化为对应 `templateId`。
- 保存后的简历继续通过已有 `ResumeData.templateId` 持久化。

## 验证

- `.\\.venv\\Scripts\\python.exe -m pytest backend\\tests\\test_latex_template_registry.py backend\\tests\\test_pdf_template_selection.py backend\\tests\\test_pdf_stream_threadpool.py -v`
- `cd frontend && npm run build`
- `Invoke-RestMethod -Uri "http://127.0.0.1:9001/api/resume-templates?type=latex"`
- `Invoke-RestMethod -Uri "http://127.0.0.1:5174/api/resume-templates?type=latex"`
- `Invoke-WebRequest -Uri "http://127.0.0.1:5174/templates" -UseBasicParsing`

结果：后端 10 项测试通过；前端生产构建通过；当前分支后端 `9001` 和前端代理 `5174` 都能返回 `classic`、`compact` 模板；`/templates` 页面返回 200。Vite 仍提示既有大 chunk 警告，未影响构建结果。

## 剩余风险

- `compact` 第一版只是通过全局排版参数体现差异，还不是完全独立的版式结构。
- 后续如果新增双栏、图文或强视觉模板，应新增独立 section renderer，而不是继续扩展共享 `json_to_latex()`。
- 浏览器端已通过构建与 HTTP smoke；如需发布前验收，还应在真实浏览器中手工走完 `/templates` 到工作台切换、PDF 渲染、保存后重进的完整链路。
