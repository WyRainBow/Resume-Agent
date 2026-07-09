# Workspace 设置抽屉面板 —— 待审核测试清单

> 状态:实现完成,待用户手动验收｜分支:feature/template-market｜日期:2026-07-09
> 关联方案:`knowledge-base/specs/2026-07-09-workspace设置抽屉面板方案.md`
> 涉及文件:
> - `frontend/src/pages/Workspace/v2/EditPreviewLayout.tsx`(改)
> - `frontend/src/pages/Workspace/v2/SidePanel/index.tsx`(改,拆分)
> - `frontend/src/pages/Workspace/v2/SidePanel/SettingsDrawer.tsx`(新)

## 一、实现摘要

- 轨道宽度 300 → 280px(`EditPreviewLayout.tsx` `sidePanelWidth`)。
- `SidePanel` 只保留模块导航列表 + 顶部「🎨 模板｜⚙ 排版」segmented 触发条;原先塞在 SidePanel 里的模板选择器和排版设置整体搬进新组件 `SettingsDrawer.tsx`。
- `EditPreviewLayout` 新增状态 `settingsDrawer: null | 'template' | 'format'`,以及 `toggleSettingsDrawer`(同 tab 收起、异 tab 切换)/`closeSettingsDrawer`。
- `SettingsDrawer` 以 `absolute left-0` 覆盖层渲染,宽度 560px,`z-20`;framer-motion `AnimatePresence` 控制整体挂载/卸载,内部 `x` 位移做 slide(`~200ms ease-out`),scrim(`bg-black/30`)覆盖 EditPanel 未被抽屉盖住的部分,预览列(flex-1)不在覆盖层宽度内,不受影响。
- 模板 tab:复用 `Builder/components/TemplateSelector` 的 `TemplateThumbnail`,新写 `LargeTemplateCard`(56×72 缩略图 `scale-[2.7]` 放大到约 150×195),2 列 grid,按「原生 LaTeX / 在线 HTML」分组,当前项黑框 + 角标 ✓。
- 排版 tab:按 `templateType` 分支——`html` 复用现有 `FormattingControls`(`hideTemplateSection`);`latex` 复用原 SidePanel 里的排版卡片代码(字体大小/页边距/行间距/经历间距/页面内边距/头部空白),原样搬迁,未改字段与取值逻辑。

## 二、实现时的具体判断(供 review 对照)

1. **收起方式的复用**:抽屉头部 tab 按钮和 SidePanel 顶部 segmented 共用同一个 `onToggleTab` / `onToggleSettingsDrawer` 回调(`prev === tab ? null : tab`)。所以"点触发条再收起"和"点抽屉内当前 tab 再收起"是同一套逻辑,没有分别写两套状态机。
2. **z-index 分层**:`SettingsDrawer` 用 `z-20`,显式低于列宽拖拽遮罩层的 `z-[9999]`——拖拽遮罩层在拖拽进行时全屏铺开,永远盖过抽屉;但**没有反向处理**"抽屉展开时是否允许发起拖拽"这件事,详见下方第三节的已知风险点。
3. **overlayWidth 计算**:`overlayWidth = sidePanelWidth + 1(分隔线) + editPanelWidth`,与实际 DOM 里"轨道 + 分隔线 + EditPanel"的物理宽度对齐,保证 scrim 精确盖住 EditPanel 剩余区域、不多不少。
4. **孤儿清理**:`SidePanel` 组件体内不再使用 `templateType` / `onSelectTemplate`(逻辑搬进了 `SettingsDrawer`),这两个 prop 在原地已无任何调用方传入(`EditPreviewLayout`、`ResizableLayout` 均未传),判定为本次改动产生的孤儿声明,已从 `SidePanelProps` 接口删除。`globalSettings` / `updateGlobalSettings` 虽然 `SidePanel` 组件体内也不再使用,但 `ResizableLayout.tsx`(未接入路由的旧布局,不在本次改动范围)仍按原签名传入这两个 prop,为不牵连无关文件,予以保留。
5. **未触碰文件**:`PreviewPanel/index.tsx` 按方案第 5 节要求未改动。

## 三、已知风险点 / 需要重点验证

- **拖拽 × 抽屉展开的联动未做特殊处理**:抽屉展开时,scrim 覆盖了 EditPanel 右侧的列宽拖拽分隔线(`DragHandle`)所在区域,拖拽分隔线的 DOM 元素在覆盖层 `z-20` 之下,预期效果是"抽屉展开时无法发起拖拽"(scrim 会先接住 mousedown 并触发收起抽屉的 onClick)。这是设计层面合理的取舍,但**没有专门测试过按下拖拽手柄和点击 scrim 同一位置的事件优先级**,需要用户手动验证是否有"意外触发一次收起 + 拖拽未生效"或"拖拽和 scrim 点击都没反应"的边界情况。
- **抽屉内 tab 切换不触发 slide 动画**:因为整个抽屉容器 `motion.div` 的 `key="settings-drawer"` 固定不变,只有 `activeTab` 从 `null` → 非 null / 非 null → `null` 时触发 `AnimatePresence` 的 mount/unmount 动画;纯粹切 tab(`template` ↔ `format`)不会重新触发位移动画,符合方案第 3 节"切 tab 即时切,无 slide"的要求,但需要肉眼确认没有意外的白屏闪烁。

## 四、验收 Checklist

### 4.1 抽屉展开 / 收起(四种收起方式)

- [ ] 点顶部 segmented「🎨 模板」→ 抽屉从轨道右缘滑出,预览列保持可见且不被遮挡
- [ ] 再点一次「🎨 模板」(同一 tab)→ 抽屉收起,EditPanel 原样露出,无布局跳动(reflow)
- [ ] 展开后点抽屉头部 ✕ → 抽屉收起
- [ ] 展开后点击 scrim(半透明遮罩区域,EditPanel 未被抽屉盖住的部分)→ 抽屉收起
- [ ] 展开「模板」tab 后,点抽屉头部内的「模板」tab 按钮(当前激活项)→ 抽屉收起
- [ ] 先点「模板」展开,再点「排版」→ 不收起,直接切到排版内容,抽屉宽度不变、无二次 slide 动画
- [ ] 收起状态下预览面板可以正常滚动/缩放,不受抽屉残留元素影响

### 4.2 模板 tab

- [ ] 展开后是 2 列大缩略图(不是原来 4 列小图),分组标题「原生精排 · LaTeX」「在线模板 · HTML」清晰可辨
- [ ] 当前选中模板有黑框高亮 + 右上角 ✓ 角标,和未选中项区分明显
- [ ] 点击某个 HTML 模板缩略图 → 立即应用(`applyTemplatePreset` + `templateType` 切到 `html`),右侧预览实时刷新为新模板样式
- [ ] 点击「Classic LaTeX」→ 立即切回 `templateType='latex'`,预览刷新为 LaTeX 渲染结果
- [ ] 连续点击 2-3 个不同模板 → 抽屉全程不自动关闭,可以连续切换对比
- [ ] 切换模板后,高亮角标跟随立即更新到新选中项,没有旧高亮残留

### 4.3 排版 tab —— HTML 模板

- [ ] 先在模板 tab 选中任意 HTML 模板,再切到「排版」tab → 显示的是 `FormattingControls`(字号/间距/颜色等 HTML 专属字段),不是 LaTeX 那套字段
- [ ] 拖动任意滑块(如字号、行距)→ 预览实时刷新,数值与预览效果匹配
- [ ] 切换任意下拉/选项类设置 → 预览同步刷新,无需手动触发渲染

### 4.4 排版 tab —— LaTeX 模板

- [ ] 模板 tab 选中「Classic LaTeX」后切到「排版」tab → 显示原 LaTeX 排版卡片(字体大小 9/10/11/12PT、页面边距、行间距、多段实习/项目经历间距、页面内边距、头部空白三项)
- [ ] 逐项调整(至少覆盖字体大小档位切换 + 行间距自定义输入 + 头部空白展开/收起)→ 预览随之重新渲染
- [ ] 「头部空白」区块的展开/收起箭头交互正常,收起后三项子控件隐藏

### 4.5 轨道宽度变化(300→280)

- [ ] 模块导航列表(教育经历/项目经历等条目)在 280px 宽度下没有文字截断异常、图标错位或横向溢出滚动条
- [ ] 顶部 segmented「🎨 模板｜⚙ 排版」两个按钮在 280px 轨道宽度内完整显示,文字不换行挤压
- [ ] 「添加自定义模块」按钮在新宽度下样式正常,不溢出

### 4.6 深色模式

- [ ] 深色模式下抽屉背景、边框、scrim 对比度正常,文字可读
- [ ] 深色模式下 segmented 触发条和抽屉头部 tab 的选中态/未选中态颜色区分清晰
- [ ] 深色模式下 2 列大缩略图卡片的边框高亮(选中态)清晰可辨,不会和背景糊在一起

### 4.7 拖拽 EditPanel 列宽 × 抽屉展开的交互(重点,见上方风险点)

- [ ] 抽屉收起状态下,拖拽 EditPanel/预览之间的分隔线,列宽正常调整,预览不抖动
- [ ] 抽屉展开状态下,尝试在原拖拽分隔线位置按下鼠标 → 确认实际发生的是"抽屉收起"还是"无响应"还是"拖拽误触发",记录实际现象
- [ ] 拖拽过程中(`isDragging=true`)如果此时抽屉恰好是展开状态,确认全屏拖拽遮罩层(`z-[9999]`)与抽屉/scrim(`z-20`)没有出现层级错乱或残留遮罩挡住预览的情况

## 五、验证记录(本次已完成的自动化部分)

- `cd frontend && npx tsc --noEmit`:改动涉及的三个文件(`EditPreviewLayout.tsx`、`SidePanel/index.tsx`、`SidePanel/SettingsDrawer.tsx`)均无报错;仓库内现存 150 行 tsc 报错经 `git stash` 对比确认为改动前已存在的既有问题(集中在 `EditPanel/Field.tsx`、`EditPanel/OpenSourcePanel.tsx`、`shared/AiAssistantChat.tsx` 等无关文件),与本次改动无关。
- `cd frontend && npm run build`:构建成功,仅有 Vite 常规的 chunk 体积警告,无报错。
- 未做浏览器实测(dev server 走一遍用户路径)——按 CLAUDE.md 要求 UI 任务应实测,但用户本次要求"不要 git commit,我会 review 后统一提交",且用户历史偏好是自己手动测试、跳过 agent 侧验证,故本次交付以上方 Checklist 形式列出,由用户手动跑一遍并对照代码 review。
