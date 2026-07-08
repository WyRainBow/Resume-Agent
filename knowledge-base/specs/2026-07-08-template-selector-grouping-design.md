# 模板选择器分组方案

- **日期**：2026-07-08
- **背景**：LaTeX 原生模板与 CSS/HTML 模板走不同渲染引擎（XeLaTeX vs 前端 CSS），混在一起设置容易让用户困惑
- **目标**：按渲染引擎分组，优化模板选择体验

---

## 一、现状问题

| 问题 | 说明 |
|------|------|
| 引擎不透明 | 用户不知道 `latex` 走后端编译，其他 6 个走前端 CSS |
| 参数不适用 | LaTeX 不支持 accentColor、fontFamily 等 CSS 参数，但设置面板混在一起 |
| 预览/导出差异 | LaTeX 预览是图片占位，HTML 是实时渲染，用户感知断裂 |

当前 `TemplateType` 是平铺结构：

```ts
type TemplateType =
  | 'swiss-single' | 'swiss-two-column' | 'modern' | 'modern-two-column'
  | 'latex'       | 'clean'            | 'vivid'
```

---

## 二、方案 A：完整分组（改数据结构）

### 2.1 数据结构

```ts
// 引擎层
export type RenderEngine = 'latex' | 'html'

// HTML 引擎下的模板
export type HtmlTemplateType =
  | 'swiss-single' | 'swiss-two-column'
  | 'modern' | 'modern-two-column'
  | 'clean' | 'vivid'

// 设置结构
export interface TemplateSettings {
  engine: RenderEngine        // 新增：引擎选择
  template: HtmlTemplateType  // html 模式下才生效
  pageSize: PageSize
  margins: MarginSettings
  // ...其他参数不变
}

export const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  engine: 'html',  // 默认现代 HTML
  template: 'modern',
  pageSize: 'A4',
  // ...
}
```

### 2.2 UI 交互

```
┌─────────────────────────────────────────────────────┐
│  渲染引擎                                            │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ ● 原生 LaTeX                                │    │
│  │   经典学术风格 · 后端 XeLaTeX 编译导出        │    │
│  │              [LaTeX 缩略图]                  │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ ○ 现代 HTML                                  │    │
│  │   前端实时渲染 · 预览与导出一致               │    │
│  │   [单栏] [双栏] [Modern] [Modern双栏]       │    │
│  │   [Clean] [Vivid]                           │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 2.3 参数联动

| 引擎 | 可见参数 | 隐藏参数 |
|------|----------|----------|
| `latex` | pageSize、margins | accentColor、fontFamily、compactMode、spacing |
| `html` | 全部可见 | — |

切换引擎时：
- `latex → html`：恢复 HTML 模板的默认格式设置（accentColor=blue 等）
- `html → latex`：保持 pageSize/margins，忽略其他格式参数

### 2.4 优点

- 数据模型与产品意图一致
- 引擎级别抽象便于后续扩展（如新增 `docx` 引擎）
- 设置面板可精确控制可见参数

### 2.5 缺点

- 改动范围较大（settings.ts、TemplateSelector、FormattingControls、工作台各处消费点）
- 需处理旧数据 migration（localStorage 里的 template 类型）

---

## 三、方案 B：轻量 UI 分组（只改选择器外观）

### 3.1 数据结构不变

保留 `TemplateType` 平铺结构，只在 `TemplateSelector` 组件里做 UI 分组。

### 3.2 UI 交互

```
┌─────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────┐    │
│  │  LaTeX 原生                                  │    │
│  │  Classic serif · 后端编译                    │    │
│  │           [LaTeX 缩略图]                     │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  现代 HTML                                           │
│  ┌──────┐ ┌──────┐ ┌─────────┐ ┌────────────┐       │
│  │单栏  │ │双栏  │ │ Modern  │ │Modern双栏 │       │
│  └──────┘ └──────┘ └─────────┘ └────────────┘       │
│  ┌────────┐ ┌────────┐                             │
│  │ Clean  │ │ Vivid  │                             │
│  └────────┘ └────────┘                             │
└─────────────────────────────────────────────────────┘
```

### 3.3 实现思路

```tsx
// TemplateSelector.tsx
const ENGINE_GROUPS = {
  latex: {
    label: 'LaTeX 原生',
    sublabel: 'Classic serif · 后端编译',
    templates: ['latex'],
  },
  html: {
    label: '现代 HTML',
    sublabel: '前端实时渲染 · 预览与导出一致',
    templates: ['swiss-single', 'swiss-two-column', 'modern', 'modern-two-column', 'clean', 'vivid'],
  },
}
```

### 3.4 优点

- 改动仅限于 `TemplateSelector.tsx`
- 无需迁移旧数据
- 快速上线，后续可升级到方案 A

### 3.5 缺点

- `TemplateType` 仍是平铺结构，产品语义不清晰
- 扩展新引擎时需改多处

---

## 四、方案对比

| 维度 | 方案 A（完整分组） | 方案 B（轻量 UI） |
|------|-------------------|------------------|
| 改动范围 | 中（多文件联动） | 小（仅选择器） |
| 数据迁移 | 需要 | 不需要 |
| 产品语义 | 清晰 | 一般 |
| 扩展性 | 好 | 一般 |
| 上线速度 | 慢 | 快 |
| 后续升级 | 预留结构 | 需重构 |

---

## 五、建议

**推荐方案 B 先上线**，理由：
1. 改动风险低，当天可完成
2. 用户体验提升明显（LaTeX vs HTML 分组清晰可见）
3. 方案 A 可作为后续「统一设置面板重构」的一部分

如选择方案 A，建议同时做：
- `settings.ts` 结构升级
- `TemplateSettings` 持久化格式兼容（v1 → v2 migration）
- FormattingControls 参数联动逻辑

---

## 六、涉及文件

### 方案 A 改动点

| 文件 | 改动 |
|------|------|
| `settings.ts` | 新增 `RenderEngine`、`HtmlTemplateType`，调整 `TemplateSettings` |
| `TemplateSelector.tsx` | 分组 UI、引擎切换逻辑 |
| `FormattingControls.tsx` | 参数可见性联动 |
| `ResumeRenderer.tsx` | 引擎路由分发 |
| 工作台各处 | `template: TemplateType` → `template: HtmlTemplateType` |

### 方案 B 改动点

| 文件 | 改动 |
|------|------|
| `TemplateSelector.tsx` | 分组 UI（仅此文件） |
