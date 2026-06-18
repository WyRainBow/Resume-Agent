# 2026-06-19 首页（落地页）视觉优化操作记录

分支：`feature/06-19/03`（基于 `dev`），仅提交推送，不合并。

## 目标
用 tasteskill（`design-taste-frontend`）优化 `localhost:5173` 首页，即 `frontend/src/pages/LandingPage.tsx`。
定位：**redesign-preserve（保留品牌、targeted evolution）**，不动路由/接口/后端，不引入新依赖。

## 设计判断（Design Read）
- 页面类型：公益 AI 简历制作落地页，面向中文求职者。
- 语言：trust-first / 克制，沿用既有 slate 中性底 + emerald 单一品牌色 + Resume.AI 字标 + 暗色模式。
- Dials：`VARIANCE 5 · MOTION 6 · DENSITY 3`（保留模式，运动 +1）。

## 改动（只改 LandingPage.tsx）
1. **Hero 重构**：把原先 4 行碎片化标题（含嵌入的大 GitHub 图标）改为 1 个 eyebrow（公益项目 · 完全免费）+ 两行主标题「把经历，写成一份 / 打动 HR 的简历」+ 一句副文案（≤20 字内核：AI 生成/润色/匹配/导出、完全免费、Token 不限量）+ 两个 CTA（开始创建 / 体验 AI 助手）+ 一行「GitHub 点个 Star」次级链接。
2. **新增能力区**：6 项**真实**简历制作能力的 bento 网格（自然语言生成 / 划词润色 / JD 岗位匹配 / 智能解析导入 / 简历质量评分 / 像素级 PDF 导出），非对称栅格 + emerald 渐变特色卡，`whileInView` 入场。
3. **新增结尾 CTA 区块**：slate-900 深色面板 + emerald 光晕，复用「开始创建 / GitHub Star」。
4. **页脚**：原 `RA · Neural Engine · Pixel Perfect LaTeX` 装饰串改为 字标 + 公益说明 + GitHub 链接。
5. **配色锁定**：去掉 indigo，统一到「中性 slate + 单一 emerald accent」，圆角统一（pill / xl / 2xl）。
6. **合规修复**：删除原副文案里的 em-dash 与「模拟面试」字样（后者违反长期约束「不做模拟面试」）。

## 保留项（逻辑零改动）
所有 `navigate` 跳转（/create-new、/my-resumes、/agent/new）、登录 `openModal`、`logout`、暗色切换 `setTheme`、GitHub star fetch、微信联系卡、左下角登录按钮、`agentEnabled` 门控全部原样保留。清理了未使用的 `animate-spin-slow` `<style>`（自身改动产生的孤儿）。

## 验证
- `cd frontend && npm run build` 通过。
- Playwright 实测 `localhost:5174`（5173 被既有实例占用）：浅色 + 暗色双模式截图确认；Hero、bento（滚动入场）、结尾 CTA、页脚均正常；GitHub star 正常拉取（144）；暗色切换生效。
- DOM 断言：无「模拟面试」、无 em-dash、6 张能力卡。
- 控制台仅有与本页无关的 `/api/logos` 404（后端未启动，既有 Workspace 常量预取）。

## 提交
`feat(landing): 用 tasteskill 重构首页 Hero/能力区/CTA，锁定 emerald 单色`
推送至 `origin/feature/06-19/03`，**未合并 dev**。
