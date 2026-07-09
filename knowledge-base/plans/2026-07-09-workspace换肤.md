# Workspace 换肤模块 实施计划

> 设计文档:`knowledge-base/specs/2026-07-09-workspace换肤模块调研.md`(含用户决策)
> 分支:`feature/workspace-skin`;**不允许自主合并到 main**

**目标**:Workspace 编辑页支持 Neo(默认)/ 清新 双皮肤切换:顶栏按钮随时切,首次进入弹选择框,外壳跟随,选择持久化。

**架构**:Tailwind 自定义变体 `fresh:`(`[data-skin="fresh"] &`),与 `dark:` 同构;`data-skin` 挂 WorkspaceLayout 根节点;皮肤状态照抄 `lib/theme.ts` 模式(localStorage + 自定义事件)。fresh 类值从 7-8 日 Neo 改版 commit 的 diff `-` 行机械反推。**fresh 只定义亮色形态,深色模式沿用现有 `dark:` 不变。**

## 全局约束

- 纯视觉增量:只加 `fresh:` 成对类,不改任何逻辑/props/事件;默认(neo)视觉零改动
- AI 弹窗(shared/,~136 处)一期不做
- PreviewPanel 简历纸张永远白底,不参与换肤;只做其工具栏
- 每阶段独立 commit + `npm run build` 通过

## Task 1: 皮肤基建 + 顶栏切换 + Field/Header 打样(P1)

- Create: `frontend/src/lib/skin.ts` — `WorkspaceSkin = 'neo' | 'fresh'`、`SKIN_KEY='workspace-skin'`、`SKIN_EVENT`、`getStoredSkin()`(无记录返回 `null` 以区分"从未选过")、`getSkinOrDefault()` 返回 `'neo'` 兜底、`setStoredSkin()`(写 storage + dispatchEvent)
- Modify: `frontend/tailwind.config.js` — 引入 `tailwindcss/plugin`,`addVariant('fresh', '[data-skin="fresh"] &')`
- Modify: `frontend/src/pages/WorkspaceLayout/index.tsx` — 根 div 挂 `data-skin`,`useState(getSkinOrDefault)` + `SKIN_EVENT` 监听
- Modify: `frontend/src/pages/Workspace/v2/components/Header.tsx` — 加 Palette 图标按钮,点击 neo↔fresh 切换,title 显示当前皮肤
- Modify: `frontend/src/pages/Workspace/v2/EditPanel/Field.tsx` — 全部 Neo 类补 `fresh:` 对(参照 `git show 083b430d` 的 `-` 行:`fresh:rounded-md fresh:border fresh:border-gray-200 fresh:font-sans fresh:text-sm fresh:normal-case` 等)
- 验证:build;浏览器切换皮肤看 Field 标签/输入框形态变化

## Task 2: 首次进入弹皮肤选择框(P1)

- Create: `frontend/src/pages/Workspace/v2/components/SkinPickerModal.tsx` — 两张皮肤预览卡(NEO / 清新,各配一小段样式示意),点选即 `setStoredSkin` 并关闭;仅当 `getStoredSkin() === null`(从未选过)时由 Workspace v2 index 弹出
- Modify: `frontend/src/pages/Workspace/v2/index.tsx` — mount 时判断弹框
- 验证:清 localStorage 进 /workspace 弹框;选过后刷新不再弹

## Task 3: EditPanel 14 面板换肤(P2,~142 处)

- Modify: EditPanel 下 `AwardPanel/BasicPanel/BoldInput/CustomPanel/EducationPanel/ExperienceItem/ExperiencePanel/FieldStyleToggle/OpenSourcePanel/ProjectItem/ProjectPanel/SelfEvaluationPanel/SkillPanel/index`
- 方法:逐文件 `git show 8c15df7b -- <file>`,每个 `+` 行的 Neo 类旁补 `fresh:<对应 - 行旧值>`
- 兜底检查:`grep -n "rounded-none" <file>` 逐处确认有 `fresh:` 伴随(除非该处本来就该两皮肤一致)
- 验证:build;浏览器双皮肤过一遍所有面板

## Task 4: 外壳 + SidePanel + Preview 工具栏换肤(P3,~124 处)

- Modify: `WorkspaceLayout/index.tsx`(参照 `git show 07a1e8eb` 反推,~52 处)、`SidePanel/` 5 文件 + `components/` 其余文件(参照 `git show 23289871`)、`PreviewPanel/index.tsx` 工具栏(纸张容器不动)
- 验证:build;双皮肤看侧边栏/顶栏/排版面板/预览工具栏

## Task 5: 收尾

- 全量走查:清新皮肤下逐区域截图自查;`grep -rn "rounded-none" src/pages/Workspace src/pages/WorkspaceLayout | grep -v "fresh:"` 清单核对
- 更新 spec 文档状态为已实施;不合并、不推送,等用户验收
