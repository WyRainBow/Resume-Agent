# 简历方向模板广场设计

## 日期

2026-05-22

## 背景

原 `/templates` 页面展示的是后端 LaTeX 排版模板，例如 `classic`、`compact`。用户确认后，模板广场应展示面向新建简历的“方向模板”，例如计算机、文科、金融、科研等。方向模板负责简历结构、模块标题、默认提示和照片位置；后端 LaTeX 模板只作为内部 PDF 渲染实现。

## 决策

- 模板广场只展示方向模板，不直接展示 LaTeX 排版模板。
- 方向模板只作用于新建简历，不迁移、不覆盖已有简历。
- `ResumeData.templateId` 继续表示后端 LaTeX 渲染模板 ID。
- 新增 `ResumeData.directionTemplateId` 记录用户选择的方向模板。
- 方向模板通过 `latexTemplateId` 映射到内部 LaTeX 渲染模板。
- 新增 `globalSettings.photoPlacement`，支持 `left`、`right`、`none`。

## 首批方向模板

- 计算机 / 软件开发
- 产品 / 运营
- 设计 / 创意
- 金融 / 商科
- 文科 / 行政 / 传媒
- 科研 / 升学

## 数据流

1. `/templates` 从前端静态注册表读取方向模板。
2. 点击使用后跳转 `/workspace/latex?directionTemplateId=<id>`。
3. `useResumeData()` 清空当前本地草稿，并用方向模板创建一份新的空简历。
4. 新简历获得对应的模块标题、顺序、可见性、照片位置和内部 LaTeX 渲染模板。
5. 已保存简历通过原有 resume ID 加载，不受方向模板注册表变化影响。

## 扩展方式

新增方向模板时，只需要在 `frontend/src/data/resumeDirectionTemplates.ts` 增加一条配置。配置应包含：

- `id/name/description/category/tags/bestFor`
- `sections`：模块顺序、标题、提示和自定义模块
- `photoPlacement`
- `latexTemplateId`
- 可选 `globalSettings`

如果未来开放用户上传模板，应新增后端持久化和安全校验，不复用当前静态注册表。
