# 竞赛与科研 升级为默认模块

> 2026-06-19 · 新功能 · 影响范围：模块注册（前端 + Agent）

## 需求

把「竞赛与科研」做成默认模块，和教育经历等一样默认存在、可显隐/排序/编辑，同时保证通用「自定义模块」功能稳定。

## 方案（复用自定义模块管线，稳定优先）

不新建一套一等公民数据结构，而是用**保留 id `custom_research`** 注册为默认模块：

- 因为 id 以 `custom_` 开头，它**透明走通现有自定义模块全链路**，无需改动任何编辑 / 渲染 / 转换 / 后端代码：
  - 编辑路由：`EditPanel/index.tsx`、`ScrollEditMode.tsx` 的 `startsWith('custom')` → `CustomPanel`
  - 渲染：`HTMLTemplateRenderer`、`generateHTML` 的 `default:`（自定义）分支
  - 转后端：`convertToBackend` 的 `sectionTitles` / `sectionOrder` / `customData` 泛化处理
  - 后端：`latex_generator.py:422` 对 `custom_` 前缀 → `generate_section_custom`
- 通用「添加自定义模块」仍生成 `custom_<timestamp>`，与本模块互不影响 → 稳定。

数据存于 `customData['custom_research']`，形态与其它自定义条目一致（沿用上一处去重修复：条目标题为空或与模块名相同则不重复渲染）。

### 改动文件（仅"默认模块注册"位点）

- `types/index.ts` — `DEFAULT_MENU_SECTIONS` 追加（同时供 Agent `SophiaChat` 构造 menuSections）
- `constants.ts` — `initialResumeData.menuSections` 追加（localStorage 合并源）
- `data/defaultTemplate.ts` — `DEFAULT_RESUME_TEMPLATE.menuSections` 追加（新建 / 空白简历源）
- `SidePanel/LayoutItem.tsx` — `DEFAULT_SECTION_IDS` 加入 `custom_research`（仅可隐藏、不可删除）
- `tests/test_latex_custom_sections.py` — 新增"默认 custom_research 与用户自定义模块共存"回归用例

排位：追加在「自我评价」之后（order 8），**不重排任何既有模块**，避免存量简历合并时的 order 撞号；位置可拖拽调整。图标 🔬。

未改动：`data/initialResumeData.ts`、`components/ResumePreviewPanel.tsx` 经确认无任何引用（死代码）。

## 验证

- 后端：`test_latex_custom_sections.py` 4 例全过（含共存/稳定用例）。
- 前端：`npm run build` 通过。
- 浏览器（新建简历 `/workspace/latex`）：
  - menuSections 默认含 `custom_research`「竞赛与科研」(order 8, enabled)。
  - 侧边栏逐 `<li>` 校验：竞赛与科研与其它默认模块一致——仅 1 个按钮（隐藏），无删除按钮。
  - 点击「添加自定义模块」→ 新增 `custom_<ts>` 模块带删除按钮（2 个按钮），竞赛与科研仍无删除 → 通用自定义功能稳定。
  - 点击竞赛与科研 → 编辑区打开 CustomPanel（标题可铅笔编辑 + 添加条目），可编辑。
  - 无本次改动引入的控制台报错（仅既有 401 鉴权 / setState-in-render 告警）。
