# Resume-Matcher 预览工具栏 + 多功能 Tab 复刻可行性 —— 调研文档

- **日期**:2026-07-08
- **状态**:纯调研,**未写代码**
- **触发**:用户截图（简历工具页面，顶部 5 个 Tab + 预览工具栏 + 简历 PDF 预览），问"能复刻到 workspace 吗"
- **截图来源确认**:已在 `reference/projects/Resume-Matcher`（gitignored 参考项目克隆）里定位到原始实现，逐一核对如下

---

## 一、截图拆解为两个独立部分

截图其实是两块互不相干的 UI，来自 Resume-Matcher 的两个不同组件：

| 截图区域 | 对应源码 |
|---|---|
| 顶部 Tab 栏（简历/求职信/联络邮件/面试准备/JD 匹配） | `apps/frontend/components/builder/resume-builder.tsx` 第 58、63 行:`type TabId = 'resume' \| 'cover-letter' \| 'outreach' \| 'interview-prep' \| 'jd-match'` |
| 预览工具栏（缩放/边距开关/页数）+ PDF 预览画布 | `apps/frontend/components/preview/paginated-preview.tsx`（全文件，229 行） |

**长条搜索框**（截图中夹在"边距"按钮和"页数"之间、占大部分宽度的空白输入框）——在 `paginated-preview.tsx` 的工具栏代码（第 111-165 行）里**没有找到对应元素**,工具栏实际只有"缩放控件 + 边距开关"（左）和"页数"（右）两组,中间是 `justify-between` 的空白,没有 search input。全仓库搜索 `jd-comparison-view.tsx`、`highlighted-resume-view.tsx` 等关键词高亮相关组件也未找到匹配的搜索框实现。**这个元素的来源未确认**,可能是截图工具自身的地址栏/其它浏览器 UI 被框选进去了,建议用户确认一下这块具体是什么(如果是站内元素,麻烦追加一张更精确的截图或说明来源页面)。

---

## 二、逐项现状盘点（Workspace 当前代码库）

### 2.1 预览工具栏——`frontend/src/pages/Workspace/v2/PreviewPanel/index.tsx`

| 截图元素 | 现状 | 位置 |
|---|---|---|
| 缩放 −/+ 按钮 + 百分比 | **已有**,逻辑等价(50%-250%,可编辑输入框) | 第 247-303 行,`handleZoomOut`/`handleZoomIn` |
| 但位置 | 不一致:Resume-Matcher 在顶部工具栏,Workspace 在预览区**底部**居中悬浮条 | — |
| 边距开关(显示/隐藏页边距参考线) | **完全没有**。Workspace 的"边距"是 `SidePanel/index.tsx` 第 358-393 行的一个**下拉选择**(标准/紧凑/宽松预设),属于侧边栏配置项,不是预览区里的实时开关按钮 | — |
| 页数指示(图标 + "N 页") | **完全没有**,PDF 渲染后没有页数统计逻辑 | — |
| 顶部工具栏现有内容 | 渲染按钮 + 本地/远程渲染模式选择(LaTeX)或"实时预览"标签(HTML) | 第 113-181 行 |

### 2.2 顶部多功能 Tab——`frontend/src/pages/Workspace/v2/index.tsx`

**完全没有**类似结构。当前顶部是:装饰头(第 303-325 行)+ 功能性 `Header`(第 328-342 行,编辑模式 click/scroll/json 切换)+ 三栏 `EditPreviewLayout`。

五个 Tab 逐项对照:

| Tab | Workspace 现状 |
|---|---|
| 简历 | 有,就是当前主编辑区 |
| JD 匹配 | **部分有**——不是顶部 Tab,而是右下角 AI 助手触发的**弹窗**(`shared/JdMatchDialog.tsx`,`index.tsx` 第 387-397 行)。后端已有 JD 匹配打分能力(`backend/routes/resume.py`、`backend/services/scoring_service.py`) |
| 求职信(Cover Letter) | **完全没有**,前后端均无入口/API |
| 联络邮件(Outreach) | **完全没有**实现,但已有调研文档 `reference/docs/2026-07-08-resume-matcher-outreach-mail-调研.md`(结论:AI 生成外联文案,非真实发信) |
| 面试准备(Interview Prep) | **完全没有**,前后端均无入口/API |

---

## 三、复刻可行性评估

### 3.1 预览工具栏(缩放/边距/页数)—— 难度低,可独立做

- **缩放**:已有等价功能,只是位置在底部而非顶部,复刻本质是**样式 + 布局搬家**,不涉及新逻辑。
- **边距开关**:Resume-Matcher 的实现依赖它自己的**分页系统**(`use-pagination.ts`、`page-container.tsx`、`PAGE_DIMENSIONS`/`mmToPx` 常量)——这套东西是给 HTML 模板(浏览器端渲染、真实 CSS 像素分页)用的。Workspace 的 LaTeX 分支 PDF 是**服务端 XeLaTeX 编译出的 PDF 文件**,前端拿到的是一个 `<iframe>`/PDF viewer 展示的成品文件,**没有"页边距参考线"这个概念可以叠加**——除非切到 HTML 模板分支(见下面 §四 关联)。所以边距开关目前**只能对 HTML 模板分支有意义**,LaTeX 分支做不了。
- **页数**:LaTeX 分支理论上可以从后端渲染结果拿到总页数(如果 API 返回),或前端用 PDF.js 读取页数——工作量中等,和"分页系统"无关,是独立的小功能。

### 3.2 顶部多功能 Tab —— 难度高,分需求单独评估,不是一次性能"复刻"的东西

这 5 个 Tab 背后各自是完整功能模块,不是纯 UI 搬运:

| Tab | 落地成本 |
|---|---|
| JD 匹配 | 中——后端已有打分能力,主要是把现有弹窗改造成 Tab 页,UI 工作量为主 |
| 求职信 | 高——需要新的 AI 生成 API(prompt+模型调用)+ 编辑器 + 独立预览/导出链路,前后端都要从零写 |
| 联络邮件 | 高——同上,且已有调研文档提示这是"AI 文案生成"而非真发信,范围要先和用户对齐 |
| 面试准备 | 高——需要新的 AI 生成 API + 展示 UI,从零写 |

**不建议**当作一个"复刻 UI 皮肤"的任务处理——每个 Tab 都是独立的产品功能,需要单独走 `/superpowers:brainstorming` 做需求分析,不能像之前"neo-brutalism 换皮"那样只动 className。

---

## 四、与已有设计文档的关系

`knowledge-base/specs/2026-07-08-workspace接入builder模板系统-design.md` 已经规划了"把 Builder 的 5 套 HTML 模板接入 `/workspace/html`"——**如果**未来真的推进那份计划,`/workspace/html` 会有自己的浏览器端分页渲染,到时候"边距开关 + 页数"这两个工具栏功能可以顺带一起做(依赖同一套分页基础设施,复用 Resume-Matcher `paginated-preview.tsx` 的思路)。在此之前,LaTeX 分支单独做这两个功能意义不大。

---

## 五、结论与建议顺序

1. **可以先做、性价比最高**:预览工具栏"缩放"从底部挪到顶部(纯样式),风险低,立即可做。
2. **需要用户确认后再做**:预览工具栏"边距开关"和"页数"——建议等 Workspace 接入 Builder HTML 模板(见关联文档)时一起做,而不是现在单独在 LaTeX 分支上凑一个假的边距开关。
3. **不建议现在做**:顶部 5 个 Tab——除"JD 匹配"外都是全新产品功能,需要各自单独走需求分析流程,不是一次能"复刻"完的 UI 任务。
4. **待确认**:截图里那条长搜索框的来源,目前在参考代码里找不到对应实现。
