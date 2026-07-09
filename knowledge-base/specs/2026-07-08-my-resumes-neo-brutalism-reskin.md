# /my-resumes 换皮为 Neo-Brutalism(Swiss)风格 —— 设计

- **日期**:2026-07-08
- **分支**:`feature/template-market`(与 Builder 模块同分支,不合并 main)
- **发起人**:用户直接要求,参照 `/builder`、`/builder/dashboard`(抄自 Resume-Matcher 的 Swiss/neo-brutalism 风格)给 `/my-resumes`(生产环境在用的简历列表页,组件 `ResumeDashboard`)换皮

## 一、目标与范围

只做视觉换皮,**功能与数据逻辑一律不动**。范围锁定在:

```
frontend/src/pages/ResumeDashboard/
├── index.tsx                    页面容器/背景/布局
├── components/
│   ├── Header.tsx                顶部工具栏(新建/导入/AI导入/批量操作/UserMenu)
│   ├── ResumeCard.tsx             简历卡片
│   ├── CreateCard.tsx             新建卡
│   ├── TemplateCard.tsx           模板选择卡
│   ├── SimpleTemplateCard.tsx     模板选择卡(简化版)
│   └── ui/
│       ├── card.tsx               页面私有 shadcn 风格卡片基础组件
│       ├── button.tsx             页面私有按钮基础组件
│       └── alert.tsx              页面私有提示条组件
```

以上组件 / ui 基础件均确认为 `ResumeDashboard` 页面私有,未被其它页面 import,改动不会外溢。

**明确不做**:
- 不改路由(`App.tsx` 的 `/my-resumes` 注册不变)
- 不改数据获取 / `resumeStorage` 交互逻辑
- 不改 `UserMenu`(公共组件,别的页面在用)
- 不抽取公共 Swiss 设计系统组件库(评估过方案 B,用户选择方案 A:只换皮不重构)
- 不动 `/builder` 现有代码
- 不做 A/B 开关或旧版预览,直接原地替换

## 二、Token 映射表

| 现状 | 目标(取自 Builder 已用的 neo-brutalism token) |
|---|---|
| `rounded-xl` / `rounded-md`(卡片圆角) | `rounded-none` + `border border-black` |
| `shadow-lg` / `shadow-xl` / `shadow-[0_Npx_Npx_rgba(...)]`(柔光阴影) | 硬阴影 `shadow-[Npx_Npx_0px_0px_#000000]`(卡片 2-4px,大容器 8px) |
| 页面背景(白 / 浅灰渐变) | `#F0F0E8` 米白画布 + 格纸网格背景(`linear-gradient` 1px 网格线,直接照搬 `Builder/DashboardPage.tsx` 现有实现,保持与 Builder 视觉一致) |
| 按钮圆角 / hover 浮起放大 | `rounded-none`;hover 时 `translate-y-[1px] translate-x-[1px]` + 阴影收成 0(硬阴影"按下"效果) |
| sans-serif 常规字重标题 | 大标题 `font-serif`,标签 / 按钮 `font-mono uppercase tracking-wide` |
| 强调色随意取色 | 收拢到 Builder 8 色板:`#1D4ED8` 蓝 / `#15803D` 绿 / `#000000` 黑 / `#92400E` 棕 / `#7C3AED` 紫 / `#0E7490` 青 / `#B91C1C` 红 / `#4338CA` 靛 |
| 头像 | 保留圆形(`rounded-full` 不动,人像/monogram 本身不受直角化约束) |

## 三、逐组件改动点

- **`index.tsx`**:整体背景换 `#F0F0E8` 画布 + 格纸网格背景
- **`Header.tsx`**:按钮统一换成硬阴影按钮样式(可直接复用 `Builder/components/SwissButton.tsx` 的 class 组合,或在本页 `ui/button.tsx` 里同步改);`rounded-full`/`rounded-xl` → `rounded-none`
- **`ResumeCard.tsx`**:依赖的 `ui/card.tsx` 圆角 + 柔光阴影 → 直角 + 硬阴影;保留 `framer-motion` 动效,但把"浮起放大"类动效调整为"按下位移"这种更贴合硬阴影语言的效果
- **`CreateCard.tsx`** / **`TemplateCard.tsx`** / **`SimpleTemplateCard.tsx`**:同上直角化 + 硬阴影化
- **`ui/card.tsx`** / **`ui/button.tsx`** / **`ui/alert.tsx`**(页面私有基础组件):直接改基础样式,而不是每个调用点覆写 className

## 四、验证计划

- `cd frontend && npm run build`
- `npx tsc --noEmit 2>&1 | grep pages/ResumeDashboard`(应为空)
- 无头 Chrome 截图核对:整体视觉是否符合 neo-brutalism 语言、关键交互元素(新建 / 导入 / 批量选择 / 删除按钮等)仍然可见可点
- 不做全链路交互回归测试(数据 / 逻辑未改动,风险主要在视觉层)

## 五、决策留痕

| 决策 | 结论 | 理由 |
|---|---|---|
| 换皮粒度 | 只改视觉 token,不动逻辑/props | 用户明确"功能保留",风险最小化 |
| 是否抽公共组件库 | 不抽(方案 A) | 用户明确诉求是"优化这一个页面",不是搭设计系统;避免过度设计 |
| 替换方式 | 直接原地替换,不做开关/预览 | 用户明确要求 |
| 影响面 | 仅 `/my-resumes`,不影响其它页面 | 所有涉及组件均已确认页面私有,无跨页面复用 |
