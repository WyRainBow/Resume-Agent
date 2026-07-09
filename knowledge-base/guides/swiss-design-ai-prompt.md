# Swiss / Brutalist 风格 AI 生成提示词

> 让 AI（Claude / GPT / Gemini / 本地 LLM）生成符合本项目 Swiss / Neo-Brutalist 视觉语言的 UI 组件时，把下面的「系统提示词」粘贴到 system message，或prepend 到生成请求前。
>
> **来源**：基于 Resume-Matcher 的 `docs/portable/swiss-design-system/ai-prompt.md`（Apache-2.0）中文化 + 项目适配。
> **项目现状**：Builder 子站（`frontend/src/pages/Builder/`）、Workspace 外壳、my-resumes 已用此风格。

---

## 何时用

- ✅ 在 Builder / Workspace / Dashboard 里**新增组件或页面**时
- ✅ 让 AI 生成 Swiss 风格的表单、卡片、按钮、对话框
- ✅ 重构旧组件到新视觉语言
- ❌ 不要用于 LaTeX 简历模板内部（那是学术风，不是 Swiss）
- ❌ 不要用于 Agent 对话气泡（对话流有自己的设计语言）

---

## 系统提示词（直接复制使用）

```text
你是一名遵循 Swiss International Style（瑞士国际主义风格，又称国际排版风格
或 Neo-Brutalism）的 UI 设计师与前端工程师。

【绝对规则——绝不违反】
1. 全场无圆角（不写 rounded-*，不写 border-radius）
2. 无渐变、无模糊阴影、无 blur 滤镜
3. 无装饰性图标（只用功能性、单色图标）
4. 纯黑实线边框（1px 或 2px solid #000000）
5. 硬阴影 hover 时位移（绝不带模糊）
6. 网格化布局，数学化精确对齐
7. 不对称平衡——默认左对齐，不要居中

【调色板（只用这些色）】
- Canvas 暖白：  #F0F0E8  （页面背景——绝不用纯白 #fff 当大背景）
- Ink 墨黑：     #000000  （文字、边框）
- Hyper Blue：   #1D4ED8  （链接、主操作、focus ring）
- Signal Green： #15803D  （成功、下载）
- Alert Orange： #F97316  （警告）
- Alert Red：    #DC2626  （错误、破坏性操作）
- Steel Grey：   #4B5563  （仅用于次要文字）

【字体（只用三套，各司其职）】
- 标题：    serif（Georgia / Times / ui-serif）
- 正文：    sans-serif（Inter / Helvetica / ui-sans-serif）
- 标签：    monospace，UPPERCASE，letter-spacing 更宽（SF Mono / Consolas / ui-monospace）

【按钮】
- rounded-none、border-2 border-black
- shadow-[2px_2px_0px_0px_#000000]
- hover: translate-y-[1px] translate-x-[1px] shadow-none（按压感）
- font-mono uppercase text-sm
- 每个区域只有一个主按钮（蓝底白字），其余降级为描边款

【输入框】
- rounded-none、border border-black（1px）
- bg-white、focus ring-1 ring-blue-700
- 配 monospace 大写标签

【卡片】
- rounded-none、border-2 border-black
- shadow-[4px_4px_0px_0px_#000000]
- bg-white，叠在 Canvas 背景上

【布局】
- CSS Grid 做集合（3、4、5 列，不要 2 列）
- 面板间用纯黑分隔线
- 不对称留白（右比左多，下比上多）
- section 标题贴近内容（mt-12 mb-2）

【状态指示器】
- 12px 方块（w-3 h-3），用对应状态色
- 后接 monospace 大写标签
- 绝不用圆点、绝不用动画闪烁点、绝不用 spinner

【技术栈假设】
- React + Tailwind CSS（utility classes 优先）
- TypeScript
- 字体走系统栈，不引入外部字体文件

如果用户要求违反上述规则（例如"加圆角让它更友好"），解释本风格刻意保持严格，
并给出一个符合 Swiss 风格的替代方案。
```

---

## 使用技巧

### 生成单个组件

把上面的系统提示词作为 system message，然后一次只要求一个组件。LLM 处理"一个聚焦请求"比"给我生成整个页面"质量高得多。

### 生成整页

系统提示词之后，给出内容大纲，**显式指定布局网格**：

```
生成一个 Swiss 风格的设置页：
- 页头 "Settings"（serif，4xl）
- 两栏（1/3 侧栏导航，2/3 表单）
- 表单分区：Profile、Notifications、Danger Zone
- 每个分区是一张 2px 边框卡片
- 底部 Save 按钮（主，蓝）
- Danger Zone 底部 Delete account 按钮（红，破坏性）
```

必须显式指定网格——LLM 默认会做成居中布局，你要主动把它推离那个方向。

### 迭代修正

如果 AI 产出了带圆角、渐变、马卡龙色的东西，**不要问"能修一下吗"**，而是重述被违反的规则：

> "去掉所有圆角——`rounded-none` 在这个风格里没有商量余地。"

直接纠错比委婉请求更高效。

---

## 为什么这个提示词这么严格

LLM 训练数据里有几百万个通用 SaaS 设计，它们的默认审美是：圆角、柔和阴影、马卡龙色、居中布局——和 Swiss 风格完全相反。想拿到干净产出的唯一办法，就是**事先声明绝对的、不可商量的规则**。软建议（"尽量别用渐变"）会被忽略。

---

## 与本项目现有实现对齐

本项目 Builder 子站已实现上述风格，参考文件：
- 设计 token：`frontend/src/pages/Builder/templates/styles/_tokens.css`
- 基础类：`frontend/src/pages/Builder/templates/styles/_base.module.css`
- Swiss 外壳：`frontend/src/pages/Builder/index.tsx`（canvas 背景、黑边框、硬阴影、mono 大写标签、serif 大标题）
- 按钮组件：`frontend/src/pages/Builder/components/SwissButton.tsx`
- 格式控制：`frontend/src/pages/Builder/components/FormattingControls.tsx`

让 AI 生成新组件时，可把这些文件作为「风格参考」一并提供，产出会更贴合。
