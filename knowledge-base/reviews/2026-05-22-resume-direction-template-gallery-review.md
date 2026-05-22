# 简历方向模板广场实施记录

## 日期

2026-05-22

## 范围

- `/templates` 从后端 LaTeX 排版模板列表调整为前端静态方向模板广场。
- 首批方向模板包括：计算机 / 软件开发、产品 / 运营、设计 / 创意、金融 / 商科、文科 / 行政 / 传媒、科研 / 升学。
- 方向模板只在新建简历时生效，不覆盖已有保存简历。
- 新增 `ResumeData.directionTemplateId`，保留 `ResumeData.templateId` 作为内部 LaTeX 渲染模板 ID。
- 新增 `globalSettings.photoPlacement`，LaTeX 渲染支持照片左侧、右侧和无照片。

## 关键文件

- `frontend/src/data/resumeDirectionTemplates.ts`
- `frontend/src/pages/Templates/index.tsx`
- `frontend/src/pages/Workspace/v2/hooks/useResumeData.ts`
- `frontend/src/pages/Workspace/v2/types/index.ts`
- `backend/latex_generator.py`
- `backend/tests/test_latex_photo_offset.py`

## 验证

- `python -m pytest backend/tests/test_latex_photo_offset.py`
- `.\.venv\Scripts\python.exe -m pytest backend/tests/test_latex_photo_offset.py backend/tests/test_latex_template_registry.py backend/tests/test_pdf_template_selection.py backend/tests/test_pdf_stream_threadpool.py backend/tests/test_latex_custom_sections.py -v`
- `cd frontend && npm run build`
- `Invoke-WebRequest -Uri "http://127.0.0.1:5173/templates" -UseBasicParsing`
- `Invoke-WebRequest -Uri "http://127.0.0.1:5173/api/resume-templates?type=latex" -UseBasicParsing`

结果：前端构建通过；后端 14 项相关测试通过；本地 `9000/5173` 开发服务可访问，`/templates` 与前端代理接口均返回 200。直接调用系统 `python` 会落到 Anaconda 环境，FastAPI/Pydantic 版本不匹配，后端验证应使用仓库 `.venv`。

## 备注

方向模板是内容结构模板，LaTeX 排版模板是内部渲染实现。用户界面只暴露“简历模板”这一层概念。
