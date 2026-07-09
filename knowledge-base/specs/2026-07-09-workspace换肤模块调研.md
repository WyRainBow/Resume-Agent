# Workspace 编辑页换肤模块 —— 调研与设计文档

- 日期:2026-07-09
- 状态:已实施(P1~P3,分支 feature/workspace-skin,2026-07-09);P4 弹窗按用户决策不做
- 背景:用户朋友反馈当前 Workspace 编辑页(Neo/新野兽派风格)不好看,希望做一个换肤模块:保留当前 **Neo 风格**,同时把改版前的**清新风格**作为第二套皮肤,用户可切换。

## 1. 现状审查

### 1.1 Neo 风格是怎么来的

2026-07-07~08 一批 style 提交把 Workspace 从"清新"整体换成了 neo-brutalism,均为 **className 成对替换、不动逻辑**:

| 提交 | 范围 |
|---|---|
| `07a1e8eb` | WorkspaceLayout 外壳(侧边栏/顶栏)+ AIImportModal |
| `083b430d` | EditPanel 共享 Field(样板) |
| `8c15df7b` | EditPanel 全部 14 个面板(176 处成对替换) |
| `23289871` | SidePanel 排版面板 + Header 顶栏 |
| `106872aa` `1d09f8d8` `64d9d586` | 预览区底色、侧边栏淡蓝、Swiss 格子等后续微调 |

**关键事实:两套风格的完整对照就躺在这些 commit 的 diff 里**——每一处 `-` 行是清新风格的原始类名,`+` 行是 Neo 类名。第二套皮肤不需要重新设计,可以从 git 历史机械反推。

### 1.2 硬编码程度量化(2026-07-09 主干)

Neo 类(`rounded-none` / 硬阴影 `shadow-[Npx_Npx_0px]` / `border-2 border-black` / `font-mono`)直接写死在 className 里,无任何皮肤抽象层:

| 区域 | 出现次数 | 文件数 |
|---|---|---|
| `Workspace/v2/EditPanel`(14 面板) | 142 | 15 |
| `Workspace/v2/shared`(AI 弹窗等) | 136 | 2 |
| `Workspace/v2/SidePanel`(排版面板) | 54 | 5 |
| `Workspace/v2/components`(Header 等) | 41 | 2 |
| `Workspace/v2/PreviewPanel` | 18 | 1 |
| `WorkspaceLayout`(侧边栏外壳) | 52 | 1 |
| **合计** | **≈443** | **≈26** |

### 1.3 既有的"主题"基础设施

- `frontend/src/lib/theme.ts`:亮/暗主题(localStorage `app-theme` + `THEME_EVENT` 自定义事件 + `<html>.classList`,Tailwind `darkMode: ["class"]`)——**这是现成的、已验证的皮肤机制范式**,换肤可完全照抄这套模式。
- `Builder/templates/styles/_tokens.css`:简历模板的 `--resume-*` CSS 变量——证明项目已有"CSS 变量按容器覆盖"的成功先例(深色模式简历反色就是这么做的)。
- Tailwind 配置:`plugins: [typography]`,加自定义 variant 插件无障碍。

### 1.4 「清新」风格的定义(从 git diff 提取)

| 维度 | 清新(旧) | Neo(现) |
|---|---|---|
| 圆角 | `rounded-md` / `rounded-lg` | `rounded-none` |
| 边框 | `border border-slate-200/gray-200` | `border-2 border-black` |
| 阴影 | `shadow-sm` 柔和阴影 | `shadow-[2px_2px_0px_0px_#000]` 硬阴影 |
| 标签字体 | `text-sm text-gray-600`(无衬线) | `font-mono text-xs font-bold uppercase` |
| 页面底色 | `bg-slate-50` / 白 | `bg-[#F0F0E8]` 米白 / `#F6F3EC` |
| 焦点态 | `ring-primary/20 border-primary` | `ring-blue-700 border-black` |
| 选中/激活 | `bg-slate-100 text-slate-900` | `bg-blue-700 text-white` + 硬阴影 |
| 交互动效 | hover 变色、scale | 阴影消失 + `translate-[1px]` 按压位移 |

## 2. 方案对比

### 方案 A:Tailwind 自定义变体 `fresh:`(推荐)

和 `dark:` 完全同构:tailwind.config.js 加一行 `addVariant('fresh', '[data-skin="fresh"] &')`;Workspace 根节点挂 `data-skin` 属性;每个 Neo 类旁边补一个 `fresh:` 对应类:

```tsx
// 现状
className="rounded-none border-2 border-black shadow-[2px_2px_0px_0px_#000000]"
// 改后
className="rounded-none fresh:rounded-md border-2 fresh:border border-black fresh:border-gray-200 shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm"
```

- ✅ 与深色模式(`dark:`)心智一致,团队已熟悉
- ✅ 纯增量:默认视觉零改动,可逐文件推进、逐文件验收,风险最低
- ✅ fresh 值可以直接从 §1.1 那批 commit 的 `-` 行机械反推,不需要重新设计
- ✅ 做法与当初 Neo 改版完全对称(成对替换),历史已证明这种改法可控(176 处一次过、零逻辑泄漏)
- ❌ className 变长(每处 Neo 类多一个 fresh: 类,约 443 处)

### 方案 B:语义 token 重构(CSS 变量层)

把 443 处硬编码类收敛成语义类(`.ws-card`、`.ws-input`、`--ws-radius`、`--ws-shadow`...),皮肤 = 一组变量值。

- ✅ 最干净,第三套皮肤边际成本极低
- ❌ 等于把 26 个文件全部重写一遍 className,回归风险和工作量远大于 A;且和项目现有 Tailwind 原子类风格相悖(CLAUDE.md:匹配现有风格)
- ❌ 一次性大爆炸改动,无法逐文件灰度

### 方案 C:双组件树 / 独立覆盖 CSS 文件

- ❌ 组件复制两份或写全局覆盖样式表,双倍维护,排除。

**结论:选 A。** 若未来皮肤超过 3 套再考虑向 B 演进(A 的 data-skin 属性和切换机制可以原样保留)。

## 3. 推荐方案设计(方案 A 细化)

### 3.1 皮肤状态层:`frontend/src/lib/skin.ts`(新)

照抄 `theme.ts` 模式:

```ts
export type WorkspaceSkin = 'neo' | 'fresh'
const SKIN_KEY = 'workspace-skin'            // localStorage
export const SKIN_EVENT = 'workspace-skin-change'
export function getStoredSkin(): WorkspaceSkin
export function setStoredSkin(skin: WorkspaceSkin): void  // 写 storage + dispatchEvent
```

### 3.2 挂载点

`data-skin={skin}` 挂在 **WorkspaceLayout 根 div**(`frontend/src/pages/WorkspaceLayout/index.tsx`),用 `useState` + `SKIN_EVENT` 监听保持响应。只影响该子树,Landing / Dashboard / Chat 不受影响。

### 3.3 Tailwind 变体

```js
// tailwind.config.js
plugins: [typography, plugin(({ addVariant }) => {
  addVariant('fresh', '[data-skin="fresh"] &')
})]
```

### 3.4 切换入口

Workspace 顶栏 `Header.tsx` 加一个 Palette 图标按钮,点击在 neo / fresh 间切换(或小下拉)。所有用户可用。

### 3.5 与深色模式的关系(简化决策)

**fresh 皮肤只定义亮色形态**;深色模式下现有 `dark:` 类照常生效、不做 `fresh:dark:` 组合(深色模式现已是管理员专属摸鱼功能,不值得为组合态翻倍工作量)。

### 3.6 分阶段实施

| 阶段 | 范围 | 规模 |
|---|---|---|
| P1 样板 | skin.ts + tailwind variant + Header 切换按钮 + `Field.tsx` + `Header.tsx` 打样 | ~30 处 |
| P2 编辑区 | EditPanel 14 个面板(参照 `8c15df7b` 的 diff 反推 fresh 值) | ~142 处 |
| P3 外壳与排版 | WorkspaceLayout + SidePanel + PreviewPanel 工具栏(纸张永远白底不参与换肤) | ~124 处 |
| P4 弹窗(可选) | shared/ 下 AI 导入等弹窗 | ~136 处 |

每阶段:`npm run build` + 浏览器双皮肤实测 + 独立 commit。

### 3.7 风险

- 成对类遗漏 → 某控件在 fresh 下仍是 Neo 样子:靠逐文件 grep `rounded-none` 无 `fresh:` 伴随类来兜底检查
- `font-mono uppercase` 这类排版类换肤后文案宽度变化,个别布局需微调
- shared/ 弹窗部分组件跨页面复用(如 AIImportButton 在别处也用),P4 要先查引用面再决定是否纳入

## 4. 开放问题(已由用户定夺,2026-07-09)

1. **默认皮肤**:Neo(现状)。
2. **切换入口**:Workspace 顶栏图标;另外**首次进入编辑页路由时弹一个皮肤选择框**,让用户选皮肤进入(已选过则不再弹,记住选择,后续用顶栏按钮切换)。
3. **侧边栏(WorkspaceLayout)跟随换肤**:挂在外壳根上,凡用该外壳的页面都跟随。
4. **P4 弹窗不做**:一期只做编辑页 Workspace 本体(P1~P3)。
5. **分支纪律**:在独立 feature 分支上做,不允许自主合并到 main。
