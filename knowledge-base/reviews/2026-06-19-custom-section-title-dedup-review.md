# 自定义模块标题重复修复（单块语义）

> 2026-06-19 · Bug 修复 · 影响范围：PDF/LaTeX 链路 + 本地预览 + 编辑面板

## 问题现象

用户把自定义模块命名为「竞赛与科研」后：

1. 「标题不会自动变」——模块名（侧边栏 / 编辑区顶部）与条目「标题」字段互不同步。
2. 渲染重复出现两个「竞赛与科研」——同一个文字既作为段落标题又作为条目子标题输出。

## 根因

自定义模块的两个字段天生独立、无任何同步逻辑：

- 模块名 = `MenuSection.title`（`EditPanel/index.tsx` 铅笔编辑、`convertToBackend` 写入 `sectionTitles`）。
- 条目标题 = `CustomItem.title`（`CustomPanel.tsx` 标题输入框）。

三条渲染链路都「先输出模块名、再输出条目标题」：
`HTMLTemplateRenderer/index.tsx`、`utils/generateHTML.ts`、后端 `latex_sections.py:generate_section_custom`。
用户把同一文字填进两处，于是每条链路都打印两遍。此外条目标题留空时，LaTeX 还会打印字面量「未命名条目」，HTML 留空标题行——即「单块内容」用法本就未被正确支持。

## 修复（单块语义，统一规则）

在三条渲染链路对自定义条目应用同一规则：

- 条目标题**为空**或**与模块名相同**时，视为冗余，不再作为子标题渲染。
- 仅当存在「非冗余标题 / 副标题 / 日期」时才输出子标题行，否则只渲染正文。
- 移除 LaTeX 的 `未命名条目` 兜底（空条目不再产生子标题）。

保留多条目能力：条目标题与模块名不同（如「实习经历」下的「业务中台」）时照常渲染，既有测试不受影响。

编辑面板把标题占位符改为「留空则用模块名作为标题」，消解「标题不会自动变」的困惑。

### 改动文件

- `backend/latex_sections.py` — `generate_section_custom` 去重 + 移除「未命名条目」兜底
- `frontend/src/pages/Workspace/v2/HTMLTemplateRenderer/index.tsx` — 本地预览去重
- `frontend/src/pages/Workspace/v2/utils/generateHTML.ts` — HTML 导出去重
- `frontend/src/pages/Workspace/v2/EditPanel/CustomPanel.tsx` — 标题占位符提示
- `backend/tests/test_latex_custom_sections.py` — 新增去重 / 空标题两条用例

## 验证

- 后端：TDD 红→绿；自定义模块 3 例通过，全部 LaTeX 用例（16 例）无回归。
- 前端：`npm run build` 通过；dev server 复现用户场景（模块名 = 条目标题 =「竞赛与科研」），本地预览 `.section-title` 出现一次、`.item-title` 为空、`.item-description` 正常，预览区「竞赛与科研」计数 = 1，控制台 0 错误。
