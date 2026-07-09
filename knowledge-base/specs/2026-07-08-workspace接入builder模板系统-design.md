# Workspace 接入 Builder 5 套模板系统 —— 设计方案

- **日期**:2026-07-08
- **状态**:方案已定,**未写代码**(仅勘查 + 讨论确认,用户要求先落文档)
- **背景**:`/workspace` 已复刻 Builder 的 neo-brutalism 装饰头 + 模块列表字体;下一步讨论"要不要把 Builder 的 5 套模板真正接进 Workspace",涉及引擎选型与落地方案。
- **关联**:`2026-07-07-resume-matcher模板调研与模板市场方案.md`(RM 模板体系调研)、`2026-07-07-模板市场builder实施计划.md`(Builder 页面实施)

---

## 一、引擎选型:为什么是"乙"(window.print),不是"丙"(后端 Chromium)

Workspace 现状是**两条并存的 PDF 引擎**:

| 路由 | 模板 | PDF 引擎 |
|---|---|---|
| `/workspace/latex` | LaTeX 模板 | 后端 XeLaTeX(`convertToBackend` → `/api/pdf/render/stream` → `json_to_latex` → XeLaTeX) |
| `/workspace/html` | 1 套 HTML 模板(`HTMLTemplateRenderer`) | 浏览器端 `html2pdf.js`(html2canvas 截图 + jsPDF 拼页) |

三条可选路径对比(甲=沿用 html2pdf,乙=改用 window.print,丙=后端 Chromium 渲染):

| | 甲:html2pdf(现状) | 乙:window.print(选定) | 丙:后端 Chromium |
|---|---|---|---|
| PDF 文字质量 | 图片(html2canvas 截图),**ATS 读不了** | 真文字,ATS 友好 | 真文字,ATS 友好 |
| 现成代码 | ✅ 已在用 | ✅ Builder(`/builder`)已跑通(`window.print` + 注入 `@page` CSS + 打印隔离) | ❌ 无,需从零写 |
| 额外成本 | 零 | 零(纯前端) | 高(见下) |

**丙方案勘查到的关键事实(否决依据)**:
- `requirements.txt` 里确实有 `playwright~=1.51.0`,但**它是给 `browser-use`/`browsergym`(Agent 浏览器自动化工具)用的依赖**,全仓库**没有一行业务代码调用它做 PDF 渲染**——不能白嫖,等于要从零写一整条渲染路由(类似 RM 的 `apps/backend/app/pdf.py::render_resume_pdf`)。
- Chromium **浏览器二进制**(真正占 200-400MB 那个)大概率没装,还要跑 `playwright install chromium`。
- 生产环境要做浏览器进程的池化/排队/超时容错、服务器装中文字体,比 XeLaTeX 编译更重。
- 丙相对乙的唯一优势是"少一次点击"(乙会弹浏览器打印框,丙可以直接下载),这个体验提升配不上上面的成本。

**结论:走乙**——直接复用 Builder 已验证过的 `window.print + @page` 打印链路,零后端改动,PDF 真文字、ATS 友好。丙留到以后"乙的打印弹窗真被用户投诉"时再考虑。

---

## 二、现有 HTML 模板的处置:为什么可以"直接换掉"而不是"兼容共存"

关键事实(用户确认):**`/workspace/html`(`HTMLTemplateRenderer`)从未对用户开放过,没有真实用户数据依赖它的视觉。**

这解除了"新旧模板并存、默认项不能变以免老用户视觉突变"的顾虑——可以**直接用 Builder 的 5 套模板替换掉 `HTMLTemplateRenderer`**,不需要保留它作为"经典/第 6 选项"兼容,更干净、少一套长期维护面。

---

## 三、数据复用:不新增字段,直接共用 `globalSettings.builderSettings`

勘查 `frontend/src/pages/Workspace/v2/types/index.ts` 的 `GlobalSettings` 定义,发现其中已有:

```ts
/** Builder 模板市场页的排版设置随简历持久化;结构由 pages/Builder/settings.ts 定义并在读取时校验合并 */
builderSettings?: Record<string, unknown>
```

这正是 Builder(`/builder`)那套 `TemplateSettings` 的持久化字段,**已经和 LaTeX 专属字段(`latexFontSize`/`latexMargin`/`latexLineSpacing` 等)分开**,不会互相污染。

结论:**不需要新增字段**——`/workspace/html` 这条链路直接读写 `resumeData.globalSettings.builderSettings`,和 `/builder` 页面共用同一份数据格式。一份简历不管从 `/builder` 还是 `/workspace/html` 进,模板视觉和排版设置保持一致。

---

## 四、落地方案(4 步,待实施)

### 1. `PreviewPanel/index.tsx` —— 替换 HTML 分支渲染源
现状(第 46 行判断分支,第 224 行渲染):
```tsx
const isHTMLTemplate = resumeData?.templateType === 'html'
...
{isHTMLTemplate ? (
  <div className="flex justify-center w-full p-4">
    <HTMLTemplateRenderer resumeData={resumeData!} />
  </div>
) : ( /* LaTeX PDF 预览分支,不动 */ )}
```
改为:用 Builder 的 `ResumeRenderer`(5 模板分发器)+ `toBuilderResumeData` adapter,`settings` 从 `resumeData.globalSettings.builderSettings` 读取(经 `withSettingsDefaults` 校验合并,缺省回落 `DEFAULT_TEMPLATE_SETTINGS`)。LaTeX 分支(PDF 预览)完全不碰。

### 2. 排版设置面板 —— 按 `templateType` 分流
现有 `SidePanel`(刚换过 neo 皮)是给 LaTeX 模板用的一套设置项。HTML 模板这条线**换成 Builder 的 `FormattingControls`**(模板缩略图 + 页面尺寸 + 页边距滑块 + 间距/字号档位 + 选项 + 生效值汇总,即用户截图那个面板),接到 `builderSettings`。LaTeX 分支的 `SidePanel` 不动。

### 3. 导出引擎 —— `html/index.tsx` 的 `handleDownloadPDF`
从 `html2pdf` 切到 `window.print` + 注入 `@page` CSS(尺寸/边距按 `builderSettings.pageSize`/`margins`),复用 Builder `index.tsx` 已验证的打印隔离手法(`builder.css` 的 `.builder-print-root` / `body.builder-printing` 模式)。

### 4. 模板/adapter 直接跨目录引用 Builder,不重复造轮子
Workspace 直接 `import` `pages/Builder/templates/ResumeRenderer`、`pages/Builder/adapter`(`toBuilderResumeData`)、`pages/Builder/settings`(`withSettingsDefaults`/`DEFAULT_TEMPLATE_SETTINGS`/类型)。

**架构取舍(如实记录,非最优但当前够用)**:这会让 Workspace 和 Builder 两个页面模块产生跨目录耦合,不是长期最优分层(理想状态应该把模板渲染系统抽成一个中立的共享层,如 `pages/shared/resumeTemplates/`)。选择直接引用是为了图快、少改动、复用已验证过的代码,风险低于重写一遍。**如果将来还有第三处要用这套模板系统,再考虑抽取共享层**,现在不做投机性重构。

---

## 五、实施状态(2026-07-08 已落地,超出原方案范围)

实际实施走得比本方案更远:不止接入模板,还做了**三入口合并 + 死代码清理**(用户拍板"合并成一个 /workspace + 还代码债务")。提交链:`7ff59bd8` → `ae4ac0a0` → `8a45cb73` → `5db9d99f` → `66c572b4`。

- [x] `PreviewPanel` HTML 分支替换为 Builder `ResumeRenderer`(步骤 1,`7ff59bd8`)
- [x] `SidePanel` 按 `templateType` 分流接入 `FormattingControls`(步骤 2,`7ff59bd8`)
- [x] 删除死组件 `HTMLTemplateRenderer` + `ResumePreviewPanel`(`ae4ac0a0`)
- [x] 删除滚动编辑/JSON 编辑模式(`ScrollEditMode`/`JsonEditMode`),点击编辑为唯一布局(`8a45cb73`)
- [x] 统一模板选择器:Classic LaTeX(XeLaTeX)+ 5 套 Builder HTML(含 RM 的 LaTeX Style,命名区分双 LaTeX)(`5db9d99f` + `66c572b4`)
- [x] **三入口合并为统一 `/workspace`**:`/workspace`(当前简历)/`/workspace/:id`/`/workspace/new`(强制新建),老路由 `latex|html` 带 ID 兼容重定向;删 `v2/latex/` `v2/html/` 两入口(`66c572b4`)
- [x] 浏览器实测:6 模板双向实时切换、PDF/实时预览正确分流、老链接重定向、`npm run build` 通过

**遗留 TODO(用户确认暂缓)**:
- [ ] 步骤 3:HTML 导出从 `html2pdf`(截图式)换 `window.print` 真文字方案(当前合并入口里是 html2pdf 简化版)
- [ ] dev-only 控制台警告 "Cannot update ResumeProvider while rendering HTMLWorkspace" 根因排查(功能无影响、生产不出现;html 入口已删,需复测是否仍存在)

## 六、决策留痕

| 决策 | 结论 | 理由 |
|---|---|---|
| PDF 引擎 | 乙(window.print),不上丙(Chromium) | 丙成本(全新渲染路由+浏览器二进制+生产池化)远超收益(仅省一次点击) |
| 现有 HTML 模板去留 | 直接替换,不兼容共存 | 从未对用户开放,无视觉突变风险 |
| 排版设置字段 | 复用 `globalSettings.builderSettings`,不新增 | 该字段已预留、已与 LaTeX 字段分离 |
| 跨目录引用 Builder 组件 | 接受,不抽共享层 | 图快、复用已验证代码;等第三处需求出现再重构 |
