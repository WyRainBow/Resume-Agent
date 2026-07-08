# 侧边栏深蓝色改淡蓝色（blue-700 → sky-500）

## 背景

参考 `localhost:5173`（即 Builder / Dashboard 主工作区）展示效果，
工作区左侧导航栏、按钮、卡片图标等原先使用 Tailwind `bg-blue-700`（深蓝、饱和度高），
用户反馈「蓝色太蓝了」，希望换成接近主页面的淡蓝色。

## 规则变更

- 主品牌色（块状背景 / 按钮 / 激活态）：从 `bg-blue-700` → `bg-sky-500`
- 主品牌色 hover：从 `bg-blue-800` → `bg-sky-600`
- 主品牌文本色（链接、强调小字）：从 `text-blue-700` → `text-sky-500` 或 `text-sky-600`
- 文本选中色：`selection:bg-blue-700` → `selection:bg-sky-500`

新色值对应 Tailwind：

| 旧 | 新 | 备注 |
|---|---|---|
| `blue-700` | `sky-500` | 主品牌色块 |
| `blue-800` | `sky-600` | hover 态 |
| `text-blue-700`（强调链接） | `text-sky-500` / `text-sky-600` | 根据语境选择 |

> `sky-500` = `#0ea5e9`，比 `blue-700`（`#1d4ed8`）更亮、更偏青，
> 与 Builder 主页"淡蓝 + 黑色描边 + 米黄底"的整体风格更协调。

## 改动文件清单

### 项目全局（WorkspaceLayout —— 左侧固定导航栏）

- `frontend/src/pages/WorkspaceLayout/index.tsx`
  - 9 处 `bg-blue-700` → `bg-sky-500`
  - 1 处 `bg-blue-800`（hover） → `bg-sky-600`
  - 1 处 `text-blue-700`（Zap 图标）→ `text-sky-500`
  - 1 处 `selection:bg-blue-700` → `selection:bg-sky-500`
  - 涉及：LOGO 方块、激活态按钮、Agent 按钮、登录按钮、文本选中

### 我的简历 / Dashboard

- `frontend/src/pages/ResumeDashboard/components/ui/button.tsx`
  - default variant：`bg-blue-700 / hover:bg-blue-800` → `bg-sky-500 / hover:bg-sky-600`
- `frontend/src/pages/ResumeDashboard/components/CreateCard.tsx`
  - "新建简历"大卡片里的 `+` 方块：`bg-blue-700` → `bg-sky-500`
- `frontend/src/pages/ResumeDashboard/components/Header.tsx`
  - 选中提示条：`bg-blue-700` → `bg-sky-500`
  - 2 处 `text-blue-700`（Upload 图标）→ `text-sky-500`
- `frontend/src/pages/ResumeDashboard/components/TemplateCard.tsx`
  - 模板卡片底边 hover 高亮：`bg-blue-700` → `bg-sky-500`
  - 模板卡片图标方块：`bg-blue-700` → `bg-sky-500`
  - 模板类型 chip：`text-blue-700` → `text-sky-600`
- `frontend/src/pages/ResumeDashboard/components/ResumeCard.tsx`
  - 多选 checkbox：`checked:bg-blue-700 / focus:ring-blue-700/50` → `checked:bg-sky-500 / focus:ring-sky-500/50`
  - 选中态阴影 + 边框：`#1D4ED8` / `border-blue-700` → `#0ea5e9` / `border-sky-500`
- `frontend/src/pages/ResumeDashboard/index.tsx`
  - "查看全部"链接：`text-blue-700` → `text-sky-600`

## 未来约定

- 新代码不要再出现 `bg-blue-700` / `text-blue-700` 作为品牌色
- 主题相关的深蓝应统一使用 `sky-500`（主色块） / `sky-600`（hover）
- 如需更深一级，临时使用 `sky-700`，但默认停在 `sky-500`