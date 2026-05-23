# HTML 模板广场实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让模板广场同时支持 LaTeX 和 HTML 简历新建、预览模板切换，并保持运行时直接连接线上 PostgreSQL。

**Architecture:** 方向模板负责岗位结构和渲染引擎选择；LaTeX 模板继续走后端 registry；HTML 模板先走前端 registry。简历持久化继续使用 `ResumeData` JSON，不新增数据库列。

**Tech Stack:** React, TypeScript, Vite, FastAPI, SQLAlchemy, PostgreSQL.

---

## Tasks

- [x] 新增契约测试 `backend/tests/test_html_template_gallery_contract.py`，覆盖 HTML 方向模板、广场路由、HTML 工作区初始化、HTML 模板切换。
- [x] 在 `.env` 末尾确认运行时使用 `USE_POSTGRESQL=true`，直接连接线上 PostgreSQL。
- [x] 扩展 `resumeDirectionTemplates.ts`，新增 `renderEngine`、`renderTemplateId`、HTML 方向模板和解析函数。
- [x] 扩展 `/templates` 页面，将 LaTeX 模板和 HTML 模板按左右两栏分开展示，并按引擎跳转到对应工作区。
- [x] 扩展 `useResumeData()`，支持 `/workspace/html?directionTemplateId=<id>` 新建流程。
- [x] 新增 HTML 模板注册表 `frontend/src/pages/Workspace/v2/html/templates/registry.ts`。
- [x] 让 `HTMLTemplateRenderer` 按 `templateId` 分发。
- [x] 将 `TemplateSwitcherModal` 改为按 `templateType` 加载 LaTeX 或 HTML 模板。
- [x] HTML 工作区接入顶部操作栏和模板切换弹窗。
- [x] HTML 导出按钮调用浏览器端 HTML-to-PDF 导出。
- [x] 确认模板类型只写入 `resumes.data` JSON，不需要线上 schema migration。

## Verification

- [x] `.\\.venv\\Scripts\\python.exe -m pytest backend\\tests\\test_html_template_gallery_contract.py -v`
- [x] `cd frontend && npm run build`
- [x] 脱敏确认后端运行时使用 PostgreSQL，线上 `users` 和 `resumes` 表存在。
- [x] `npx tsc --noEmit` 已运行；仓库存在多处历史类型错误，当前改动相关契约未再出现新增类型错误。
