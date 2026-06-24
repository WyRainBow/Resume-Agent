# 基本信息「每字段显示样式」设计

> 日期：2026-06-24
> 分支：`feature/06-23/01`
> 类型：跨链路功能（前端编辑态 → 预览/导出 HTML → convertToBackend → 后端 LaTeX）
> 来源：brainstorming（用户已逐项拍板，见「决策记录」）

## 1. 背景与目标

工作台「基本信息」目前用**一个全局** `globalSettings.contactLabelMode`（`icon`/`text`/`none`）控制**所有**联系方式字段的前缀样式，且用浏览器原生 `<select>`（用户反馈「很丑」）。

目标：改为**每个字段独立选择显示样式**，并用项目既有的自定义控件替换原生 select。例如用户可让：

- 邮箱 → `📧 zhang@x.com`（图标）/ `邮箱：zhang@x.com`（标签）/ `zhang@x.com`（仅值）
- 年龄 → `🎂 25 岁`（图标）/ `年龄：25 岁`（标签）/ `25 岁`（仅值）
- 职位/求职意向 → `🎯 后端开发`（图标）/ `求职意向：后端开发`（标签）/ `后端开发`（仅值）

## 2. 决策记录（brainstorming 已确认）

| 议题 | 决策 |
|---|---|
| 字段范围 | **所有基本信息字段（姓名除外）**：职位、年龄、邮箱、电话、地址、博客、自定义字段 |
| 全局开关 | **彻底替换**为每字段设置；旧全局值作为各字段初始种子，老简历不突变 |
| 无天然图标字段 | **给默认图标 + 可自定义 emoji**（复用 `basic.icons`） |
| 控件形态 | **紧凑分段切换**（每字段 3 态：标签/图标/仅值，一点即切；选图标时旁边 emoji 可改） |
| 年龄字段 | `birthDateDisplayMode`（出生年月 vs 年龄，内容）与新 labelMode（前缀）**正交并存**，如「🎂 25 岁」 |

## 3. 范围

**In**（可设显示样式的字段，key 用 `BasicInfo` 键）：

- `title`（职位/求职意向，header-left 副标题，后端映射为 `objective`）
- `birthDate`（年龄/生日，受 `birthDateDisplayMode` 控制内容）
- `email`、`phone`、`location`、`blog`（header-right 联系行）
- `customFields[*]`（自定义字段，key 用 `custom:<id>`）

**Out**：

- `name`（大标题 h1，无前缀）
- `employementStatus`（求职状态：派生自 birthDate/状态合并逻辑，沿用现有，不纳入本次）
- 照片相关字段

## 4. 数据模型（`types/index.ts`）

```ts
type FieldLabelMode = 'icon' | 'text' | 'none'

interface GlobalSettings {
  // ...existing
  // 废弃：contactLabelMode?: 'icon' | 'text' | 'none'
  fieldLabelModes?: Record<string, FieldLabelMode>  // key: title/birthDate/email/phone/location/blog/custom:<id>
}

interface BasicInfo {
  // ...existing；已有 icons?: Record<string, string> 复用为「每字段自定义 emoji」
}
```

- `fieldLabelModes` 放 `globalSettings` 的理由：`convertToBackend` 已**整体透传** `globalSettings`（`convertToBackend.ts:180 globalSettings: data.globalSettings`），后端零额外管线即可读到。
- **复用** `basic.icons`：`icons[key]` 为该字段的自定义 emoji；缺省时用 `DEFAULT_FIELD_ICONS`。
- 新增共享常量 `DEFAULT_FIELD_ICONS`（前端一份 + 后端一份，保持一致）：
  `title 🎯 / birthDate 🎂 / email 📧 / phone 📞 / location 📍 / blog 🔗`
  （与现有 header 硬编码图标一致：📞📧📍🎂🔗）
- 新增共享常量 `FIELD_TEXT_LABELS`（`text` 模式前缀文案，单一来源，避免歧义）：
  `title 求职意向 / email 邮箱 / phone 电话 / location 地点 / blog 博客`；
  `birthDate` 随 `birthDateDisplayMode` 取 `年龄` 或 `生日`；自定义字段用其 `label`。
  > 注：`title` 编辑区标签为「职位」，但 `text` 前缀用「求职意向」（与后端 `objective` 语义及用户示例一致）。

## 5. 迁移兼容（老简历不突变）

读取某字段 mode 的解析函数 `resolveFieldMode(key)`：

1. `fieldLabelModes[key]` 存在 → 用它；
2. 否则若旧 `globalSettings.contactLabelMode` 存在 → 用它（联系类字段沿用旧全局视觉）；
3. 否则默认 `'icon'`。

写入侧：用户首次在任一字段切换时，按上述解析把**全部 in-scope 字段**的当前值落盘到 `fieldLabelModes`（一次性固化），之后纯每字段。

## 6. UI 设计（`EditPanel/BasicPanel.tsx`）

- 删除原全局「联系方式显示样式」原生 `<select>`（BasicPanel ~181–195）。
- 新增组件 `FieldStyleToggle`（建议置于 `EditPanel/` 或 `shared/`）：
  - props：`mode: FieldLabelMode`、`icon: string`（当前 emoji，仅 icon 态用）、`onModeChange`、`onIconChange`、`fieldLabel`（用于「标签」态提示）。
  - 形态：3 个紧凑分段按钮（标签 / 图标 / 仅值），当前态高亮；选「图标」时右侧显示当前 emoji，点击弹极简 emoji 输入（写 `basic.icons[key]`）。
  - 深色模式 + `active:scale` 触觉，对齐 taste-skill。
- 在每个 in-scope 字段行接入该控件；`title` 行（职位）也接入。

## 7. 渲染链路（三处同步）

所有渲染处把「读全局 `contactLabelMode` + 硬编码图标」改为按字段解析 `resolveFieldMode(key)` + `resolveFieldIcon(key)`（`basic.icons[key] ?? DEFAULT_FIELD_ICONS[key]`）。

1. **预览** `HTMLTemplateRenderer/index.tsx`
   - header-right：phone/email/location/birthDate/blog（357–407）逐字段改为按字段 mode/icon。
   - header-left：`candidate-title`（361）按 `title` 字段 mode 加前缀（图标/标签/无）。
2. **导出 HTML** `utils/generateHTML.ts`：同步上述逻辑（PDF 渲染前的 HTML 形态如经此路）。
3. **convertToBackend** `utils/convertToBackend.ts`：`globalSettings` 已透传；**补传 `icons: data.basic.icons`**（当前未传，自定义 emoji 需要它）。
4. **后端** `latex_generator.py`（~384–407）：`contact_label_mode` 全局逻辑改为每字段 `field_label_modes.get(key)`；`_label()` 按字段中文名加前缀（电话/邮箱/地点/博客/求职意向/年龄·生日）。

## 8. 已知约束：PDF 不渲染 emoji 图标（重要）

- LaTeX 模板**无 emoji 字体支持**，后端 `_label()` 对 `icon` 模式**从不输出 emoji**（`latex_generator.py:384` 注释「icon(默认，仅值·分隔)」、`393` 「icon / none: 无前缀」）。
- 即：`icon` 模式下 **浏览器预览显示 emoji，但导出的 PDF 里 emoji 不出现（仅值）**。这是既有平台限制（XeLaTeX 彩色 emoji 不可靠），非本次引入。
- 本次设计**维持现状**：PDF 中 `text`/`none` 完全可用并逐字段生效；`icon` 模式在 PDF 等价「仅值」。预览端 `icon` 显示 emoji。
- **不在本次范围**：为 PDF 引入 emoji 字体（NotoColorEmoji 等）——高风险、需服务端字体与引擎适配，若用户确需可另立项。

## 9. 影响文件清单

| 文件 | 改动 |
|---|---|
| `frontend/src/pages/Workspace/v2/types/index.ts` | `GlobalSettings.fieldLabelModes`；废弃 `contactLabelMode`；`FieldLabelMode` 类型 |
| `frontend/src/pages/Workspace/v2/constants.ts`（或新建） | `DEFAULT_FIELD_ICONS`、`resolveFieldMode`/`resolveFieldIcon` 工具 |
| `frontend/src/pages/Workspace/v2/EditPanel/BasicPanel.tsx` | 删全局 select；接入 `FieldStyleToggle` |
| `frontend/src/pages/Workspace/v2/EditPanel/FieldStyleToggle.tsx`（新） | 分段切换 + emoji 自定义控件 |
| `frontend/src/pages/Workspace/v2/HTMLTemplateRenderer/index.tsx` | header 逐字段 mode/icon |
| `frontend/src/pages/Workspace/v2/utils/generateHTML.ts` | 同步逐字段逻辑 |
| `frontend/src/pages/Workspace/v2/utils/convertToBackend.ts` | 补传 `icons` |
| `backend/latex_generator.py` | `field_label_modes` 逐字段；`DEFAULT_FIELD_ICONS`（PDF icon=仅值，维持现状） |

## 10. 测试与验证

- **前端**：BasicPanel 每字段三态切换独立生效；选图标改 emoji 实时反映到右侧预览；老简历打开视觉不突变（迁移种子）。
- **PDF（真实渲染链路）**：覆盖 `text`/`none` × 多字段，确认 LaTeX 前缀正确（中文字体、求职意向/年龄·生日标签）；确认 `icon` 模式 PDF = 仅值（符合现状约束）。
- **构建**：`cd frontend && npm run build`。

## 11. 后续（writing-plans 承接）

本设计交 `/superpowers:writing-plans` 出分步实施计划：数据模型与工具 → UI 控件 → 预览渲染 → 导出/后端渲染 → 迁移 → 验证。
