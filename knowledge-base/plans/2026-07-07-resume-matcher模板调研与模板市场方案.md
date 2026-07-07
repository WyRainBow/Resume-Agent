# Resume-Matcher 模板系统调研 + 模板市场方案

- **日期**：2026-07-07
- **状态**：调研完成，方案待评审
- **目标**：借鉴 Resume-Matcher（下称 RM）的模板设计，在 ResumeAgent 新增「模板市场」dashboard，并抄录 RM 的模板风格（含它的"LaTeX 模板"）
- **范围**：仅文档，不改代码

---

## 一、🔥 最重要的认知纠偏：RM 的 "LaTeX 模板" 不是真 LaTeX

**RM 全仓库没有一个 `.tex` / `.cls` / `.sty` 文件。** 它根本不用 LaTeX 编译。

它的 "latex" 模板是一个叫 `resume-latex.tsx` 的 **React 组件 + CSS**，用 HTML/CSS **模拟** LaTeX 简历的视觉效果（衬线字体、small-caps 姓名、titlerule 横线、公司优先两行布局）。

```
RM 的 PDF 生成链路：
  简历数据 → React 组件渲染成 HTML DOM → Playwright(headless Chromium) 打印 PDF
  （没有任何 LaTeX 编译环节）
```

### 这意味着两件事

1. **"抄他们的 latex 模板" = 抄一套 HTML/CSS 设计配方**，不是抄 `.tex` 源码。这套配方完全可以**原样移植到我们现有的 HTML 模板链路**（`frontend/src/pages/Workspace/v2/HTMLTemplateRenderer/`），不需要改 LaTeX 链路。

2. **RM 的所有模板（含 latex/swiss/modern/vivid/clean）都是 HTML/CSS**，所以它们能共享一套 design token、能做双栏、能上强调色——这是 LaTeX 做不到的灵活性。

---

## 二、RM 模板系统全景

### 2.1 七套模板清单

| ID | 组件 | 布局 | 视觉特点 | 缩略图描述 |
|---|---|---|---|---|
| `swiss-single` | resume-single-column.tsx | 单栏 | 衬线标题大写+下划线、无衬线正文、等宽日期。**默认模板** | 经典学术风 |
| `swiss-two-column` | resume-two-column.tsx | 65/35 双栏 | 同 swiss-single，侧栏放技能/教育/奖项，主列右 1px 分隔线 | 空间高效 |
| `modern` | resume-modern.tsx | 单栏 | 强调色（蓝/绿/橙/红），section 标题用强调色+2px 强调色下划线 | 彩色现代 |
| `modern-two-column` | resume-modern-two-column.tsx | 65/35 双栏 | 同 modern，主列右 2px 强调色分隔线，姓名下渐变下划线 | 彩色双栏 |
| **`latex`** | resume-latex.tsx | 单栏 | **纯衬线单字体**、small-caps 姓名、Title-Case 标题+全宽横线、公司优先两行（公司+日期加粗，职位+地点斜体） | **经典 LaTeX 学术风** |
| `clean` | resume-clean.tsx | 单栏 | 纯无衬线、大字距灰色标题(0.12em)、单行紧凑条目 | 极简 |
| `vivid` | resume-vivid.tsx | 63/37 双栏 | Awesome-CV 风、small-caps、强调色箭头 bullet、姓名两色调 | 彩色张扬 |

### 2.2 模板分发机制（关键架构）

**一个 `<Resume>` 组件 + 7 路 `&&` 条件渲染**（`resume-component.tsx:177-234`）：

```tsx
<div className={`resume-body resume-template-${template}`} style={cssVars}>
  {template === 'swiss-single' && <ResumeSingleColumn ... />}
  {template === 'latex' && <ResumeLatex ... />}
  ...
</div>
```

- 所有模板共享外层 `resume-body` + CSS 变量（`cssVars`）
- 每个模板只渲染自己的内部结构，复用 `_base.module.css` 的原子类（`.resume-name/.resume-section-title/.resume-item-title` 等）
- 切换模板 = 改一个 `template` 字符串，**全实时预览，无编译**

### 2.3 模板选择 UI（"模板市场"的参考）

`components/builder/template-selector.tsx`：

```
[缩略图按钮] [缩略图按钮] [缩略图按钮] ...   ← flex flex-wrap gap-3
[模板名]      [模板名]      [模板名]          ← mono 10px uppercase
```

- 每个模板一个方块按钮，含 **TemplateThumbnail（CSS 画的迷你预览）+ 模板名**
- 选中态：`border-blue-700 + shadow-[3px_3px_0px_0px_#1D4ED8]`（瑞士风硬阴影）
- 国际化：每个模板的 name/description 走 `useTranslations`（7 语言）

---

## 三、RM "LaTeX 模板" 完整设计配方（可原样移植）

这是 `resume-latex.tsx` + `latex.module.css` 的完整视觉规格，每个数值都有据可查。

### 3.1 整体原则

**单字体设计（single-typeface）**：所有文字继承 `--header-font`（默认 serif）。这是它区别于 swiss/modern（衬线标题+无衬线正文）的核心特征——**全篇衬线，学术感最强**。

### 3.2 姓名区（header）

| 元素 | 规格 | CSS 来源 |
|---|---|---|
| 姓名 | `font-family: serif; font-size: base×header-scale(默认28px); font-weight:700; font-variant: small-caps; letter-spacing: 0.02em; color:#000; text-align:center` | `latex.module.css:30-37` |
| 职位(tagline) | `font-style: italic; font-size: base×1.05(14.7px); color:#1f2937; text-align:center` | `latex.module.css:39-43` |
| 所在地 | 单独一行居中，`font-size: base(14px); color:#1f2937` | `latex.module.css:45-48` |
| 联系信息行 | `flex flex-wrap justify-center gap-x-2 gap-y-1; font-size: base×0.95(13.3px)`，字段间用 `·` 分隔（`color:#4b5563`） | `latex.module.css:50-56` + `resume-latex.tsx:211-220` |

**关键**：姓名用 `small-caps`（不是 uppercase），配 `letter-spacing:0.02em`——这是 LaTeX `\scshape` 的视觉复刻。

### 3.3 Section 标题（最标志性元素）

```css
.sectionTitle {
  font-family: serif;
  font-size: base × section-header-scale(默认16.8px);
  font-weight: 700;
  text-transform: none;          /* Title-Case，不是大写 */
  letter-spacing: 0;             /* 无字距 */
  color: #000;
  border-bottom: 1px solid #000; /* 全宽黑色实线 = LaTeX \titlerule */
  padding-bottom: 0.1rem;
  margin-bottom: item-gap(默认4px);
  break-after: avoid;            /* 标题不孤立页底 */
  orphans: 3; widows: 3;
}
```

**对比 base 默认**：base 的 section 是 `UPPERCASE + letter-spacing:0.05em + #9ca3af 下划线`，latex 模板用 `text-transform:none` 和 `border-bottom:#000` 覆盖，做出"不大写、纯黑横线"的学术感。

### 3.4 经历条目（公司优先两行布局）—— LaTeX 风的灵魂

```tsx
// 第一行：公司(加粗)  ............  日期(加粗，右对齐)
<div className="flex justify-between items-baseline">
  <span className="entryPrimary">{company}</span>      {/* 700 #000 */}
  <span className="entryDates ml-4">{dates}</span>     {/* 700 #000 nowrap right */}
</div>
// 第二行：职位(斜体)                   地点(斜体)
<div className="flex justify-between items-baseline">
  <span className="entrySecondary">{role}</span>       {/* italic #1f2937 */}
  <span className="entrySecondary ml-4">{location}</span>
</div>
```

**与 swiss/modern 的关键区别**：
- swiss/modern 是"职位优先"（职位在第一行加粗，公司第二行）
- latex 是"**公司优先**"（公司在第一行加粗，职位第二行斜体）——这是经典学术简历范式
- latex 的**日期加粗**（其他模板日期是常规字重）——强调时间线

### 3.5 Bullet points

```tsx
<ul className="ml-4 resume-list resume-text-sm">
  <li className="flex">
    <span className="mr-1.5 flex-shrink-0">•&nbsp;</span>
    <span><SafeHtml html={desc} /></span>
  </li>
</ul>
```
- 手动 `•` + `&nbsp;`（不用 `list-style`，保证跨浏览器/PDF 一致）
- `ml-4`（16px 缩进）
- `resume-text-sm` = base×0.92 = 12.9px
- 支持 `<strong>/<em>/<u>/<a>` 富文本

### 3.6 项目条目（latex 特殊处理）

项目名加粗 + 内联 GitHub/网站链接 pill：

```tsx
<span className="entryPrimary">{project.name}</span>
<a className="resume-link-pill"><Github size={10} />github.com/...</a>  {/* 小图标 pill */}
<span className="entryDates">{dates}</span>
```
`resume-link-pill` 是 base 提供的小圆角链接标签（10px 图标 + 文本）。

### 3.7 技能/语言/证书/奖项（Additional section）

**行内单行**，不是列表：

```tsx
<div className="resume-stack resume-text-sm">
  <div><span className="font-bold">Technical Skills:</span> React, TypeScript, ...</div>
  <div><span className="font-bold">Languages:</span> Chinese, English</div>
  <div><span className="font-bold">Awards:</span> 国家奖学金, ...</div>
</div>
```
**加粗分类标签 + 逗号连接**，一行一类——这是 LaTeX 简历技能区的经典排版。

### 3.8 设计 Token（latex 模板用到的）

| Token | 值 | 用途 |
|---|---|---|
| `--resume-text-primary` | `#000000` | 姓名、公司、日期、section 标题/横线 |
| `--resume-text-body` | `#1f2937` | tagline、职位、地点、正文 |
| `--resume-text-tertiary` | `#4b5563` | 联系信息分隔符 |
| `--font-size-base` | `14px`（默认 L3） | 基准 |
| `--header-scale` | `2` | 姓名 = base×2 = 28px |
| `--section-header-scale` | `1.2` | 标题 = base×1.2 = 16.8px |
| `--item-gap` | `4px`（默认 L2） | 条目间距 |

**纯黑灰配色，零彩色**——这是 latex 模板"学术庄重感"的来源。

---

## 四、与 ResumeAgent 当前 LaTeX 模板的对比

| 维度 | RM "latex"（HTML模拟） | ResumeAgent LaTeX（真编译） |
|---|---|---|
| 渲染 | HTML→Playwright PDF | JSON→LaTeX→XeLaTeX |
| 姓名 | serif small-caps 28px 700 + letter-spacing 0.02em | `\Huge\scshape`（约24.88pt）居中 |
| Section | serif Title-Case + 全宽黑线 + padding-bottom 0.1rem | `\Large\scshape` + `\titlerule`（黑线） |
| 经历布局 | 公司加粗+日期加粗（第一行），职位斜体+地点斜体（第二行） | parbox 两列，公司-职位-日期混排 |
| 技能 | 加粗分类标签 + 逗号连接单行 | itemize 列表或富文本 |
| 字体 | ui-serif（系统衬线，渲染稳定） | TeX Gyre Termes + AdobeSongStd-**Light**（中文细字重） |
| 切换 | 改一个字符串，实时预览 | 改 templateId **后端忽略**，实际只一套 |
| 颜色 | 纯黑灰（latex 模板刻意不上色） | 纯黑白（连 token 都没有） |

### 我们能从 RM latex 模板抄的具体点

1. **公司优先两行布局**（当前我们是公司-职位-日期混排）：第一行公司加粗+日期加粗右对齐，第二行职位斜体+地点斜体——这个排版比我们清晰
2. **技能单行逗号连接**（当前我们是列表）：`**Technical Skills:** React, TS, ...` 一行一类
3. **small-caps 姓名 + letter-spacing 0.02em**：比纯 `\Huge\scshape` 更精致
4. **Section 标题 padding-bottom: 0.1rem**：横线和标题文字间留呼吸感（我们 `\titlerule` 紧贴）

---

## 五、模板市场方案（初步）

### 5.1 目标

新增一个「模板市场」dashboard，用户可浏览、预览、选择多套模板。**第一批照搬 RM 的 7 套设计**（重点是 latex/swiss/vivid 三套）。

### 5.2 架构方向：HTML 链路，不走 LaTeX

**结论**：新模板全部基于 **HTML/CSS → PDF**，不基于 LaTeX 编译。理由：
- RM 已经验证 HTML 链路能做出 LaTeX 风格（latex 模板）+ 现代风格（modern/vivid）+ 双栏（swiss-two-column）
- HTML 链路天然支持 design token、双栏、强调色、实时预览
- 我们已有 `HTMLTemplateRenderer`（`frontend/src/pages/Workspace/v2/HTMLTemplateRenderer/`）雏形，可复用

### 5.3 前端模板市场 UI

参考 RM 的 `template-selector.tsx`：

```
┌─────────────────────────────────────────────┐
│  模板市场                                      │
├─────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │缩略图│ │缩略图│ │缩略图│ │缩略图│         │
│ │LaTeX │ │Swiss │ │Vivid │ │Clean │  ...    │
│ └──────┘ └──────┘ └──────┘ └──────┘         │
│  ✓选中     默认                               │
├─────────────────────────────────────────────┤
│ [大预览区：实时渲染当前选中模板]                 │
└─────────────────────────────────────────────┘
```

- 缩略图：CSS 画的迷你预览（非截图，参考 RM `TemplateThumbnail`）
- 选中态：硬阴影 + 强调色边框
- 大预览：实时用真实简历数据渲染

### 5.4 模板注册系统（后端 + 前端）

需要一套模板注册表（参考 RM 的 `TEMPLATE_OPTIONS` + `template-settings.ts`）：

```typescript
// 拟新增 frontend/src/data/templateMarket.ts
export interface TemplateMeta {
  id: string                    // 'rm-latex' | 'rm-swiss-single' | ...
  name: string                  // 用户可见名
  description: string
  source: 'rm' | 'native'       // 来源（RM 抄的 / 原生）
  component: React.FC<...>      // 渲染组件
  cssVars?: Record<string, string>  // 该模板的 CSS 变量默认值
  thumbnail?: React.FC          // 缩略图组件
}

export const TEMPLATE_MARKET: TemplateMeta[] = [
  { id: 'rm-latex', name: 'LaTeX 学术', source: 'rm', ... },
  { id: 'rm-swiss-single', name: 'Swiss 单栏', source: 'rm', ... },
  { id: 'rm-swiss-two-column', name: 'Swiss 双栏', source: 'rm', ... },
  { id: 'rm-vivid', name: 'Vivid 彩色', source: 'rm', ... },
  ...
]
```

### 5.5 编辑区风格借鉴（你说"编辑区也借鉴他们风格"）

RM 的编辑区（builder）有几个可借鉴的设计：
- **FormattingControls 面板**：字号/间距/字体/强调色用 5 档滑块（SpacingLevel 1-5），所见即所得
- **TemplateSelector**：缩略图选择
- **live preview**：编辑即预览（我们已有，但可参考它的 CSS 变量实时注入机制 `settingsToCssVars`）

这部分需要单独探索 RM 的 builder 组件后细化，不在本文档展开。

---

## 六、实施分阶段（仅建议，未启动）

### Phase 1：基础设施（必先做）
- 后端新增 Playwright PDF 渲染服务（参考 RM `apps/backend/app/pdf.py`）
- 前端打通"HTML 模板 → 后端 Playwright → PDF"链路
- 设计 token 系统（`_tokens.css` 等价物）

### Phase 2：照搬 RM 模板
- 按本文档第三节的设计配方，先实现 `rm-latex` 模板（最经典）
- 再实现 `rm-swiss-single`（默认）、`rm-vivid`（彩色）
- 每个模板配缩略图

### Phase 3：模板市场 UI
- 新增 `/templates` 路由（模板市场 dashboard）
- 缩略图网格 + 大预览 + 应用按钮

### Phase 4：编辑区风格升级
- 借鉴 RM builder 的 FormattingControls（字号/间距/强调色滑块）
- 编辑区视觉重设计（单独立项）

---

## 七、关键文件索引（RM 侧，用于抄录）

| 用途 | 路径 |
|---|---|
| LaTeX 模板组件 | `apps/frontend/components/resume/resume-latex.tsx` |
| LaTeX 模板样式 | `apps/frontend/components/resume/styles/latex.module.css` |
| 基础原子类 | `apps/frontend/components/resume/styles/_base.module.css` |
| 设计 token | `apps/frontend/components/resume/styles/_tokens.css` |
| 模板元数据+CSS变量 | `apps/frontend/lib/types/template-settings.ts` |
| 模板分发器 | `apps/frontend/components/dashboard/resume-component.tsx:177-234` |
| 模板选择器 UI | `apps/frontend/components/builder/template-selector.tsx` |
| 缩略图组件 | `apps/frontend/components/builder/template-selector.tsx`（TemplateThumbnail） |
| PDF 渲染(Playwright) | `apps/backend/app/pdf.py`（`render_resume_pdf` :279） |
| Print 路由 | `apps/frontend/app/print/resumes/[id]/page.tsx` |
| Swiss 设计规范 | `docs/agent/design/templates/swiss-{single,two-column}-spec.md` |
| 其他 6 模板组件 | `apps/frontend/components/resume/resume-{clean,modern,modern-two-column,single-column,two-column,vivid}.tsx` |

## 八、待确认问题（评审时讨论）

1. **Playwright 部署成本**：服务器要装 Chromium（~200MB），首次启动慢。是否接受？还是用 Puppeteer？
2. **与现有 LaTeX 链路共存**：模板市场只放 HTML 模板，还是也把现有 LaTeX 模板包装进去（用截图当缩略图）？
3. **多模板数据适配**：RM 的数据结构和我们的 ResumeData 不同，模板组件要做数据适配层
4. **中文字体**：RM 用系统 `ui-serif`，PDF 渲染时服务器要有衬线中文字体（Noto Serif CJK 之类）

---

## 附：调研执行摘要

- RM 的 "latex 模板" 是 HTML/CSS 模拟，不是真 LaTeX——但这恰恰是它能好看且可移植的原因
- 它的核心设计配方（small-caps 姓名 + Title-Case 标题+黑线 + 公司优先两行 + 技能单行逗号）完全可以抄到我们的 HTML 链路
- 模板市场建议走 HTML→Playwright PDF 路线，不走 LaTeX 编译
- 第一批抄 3-4 套（latex/swiss-single/vivid/clean）即可覆盖经典/默认/彩色/极简四种风格
