# 法务页（服务条款 / 隐私政策 / 退款政策）上线

> 日期：2026-06-23
> 分支：`feature/06-20/01`
> 关联：`knowledge-base/reviews/2026-06-20-payment-provider-evaluation-pause.md`（恢复支付前置准备：法务页待补）

## 1. 背景

支付平台探索（Paddle 域名审核、MoR 通用要求）明确要求 `resumegenkk.xyz` 上线
`/terms` `/privacy` `/refund`，且首页页脚需可点击。此前前端没有任何法务页。

本次按"支付暂不接入"的约束，仅补齐这三页静态法务内容与入口，**不触碰任何计费 / checkout / webhook 代码**，
为后续恢复支付扫清前置门槛。`/pricing` 因与定价/计费强绑定，本次有意不做。

## 2. 改动内容

### 新增（`frontend/src/pages/Legal/`）

- `LegalLayout.tsx`：共享外壳，导出 `LegalLayout`（返回首页 + RA logo + 标题/更新日期 + 底部互链）、
  `LegalSection`、`LegalList`、`SUPPORT_EMAIL = 'support@resumegenkk.xyz'`。沿用 slate/blue + dark-mode 风格。
- `Terms.tsx`：服务条款（服务说明、账户登录、用户内容与责任、可接受使用、AI 生成内容、知识产权、
  付费服务、变更终止、免责、责任限制、修订、联系）。
- `Privacy.tsx`：隐私政策（收集信息、如何使用、第三方服务[AI 模型 DeepSeek/智谱/豆包、认证 BetterAuth/Google、
  云存储腾讯 COS]、Cookie、安全、保留、权利、儿童隐私、更新、联系）。
- `Refund.tsx`：退款政策（适用范围、数字产品性质、可退/不可退情形、申请方式、处理时效、变更、联系）。
  口径与"支付暂未接入"一致：声明为"未来付费功能的预先约定"。

### 接线

- `frontend/src/App.tsx`：新增 3 个 `lazyWithRetry` 懒加载 + `/terms` `/privacy` `/refund` 路由。
- `frontend/src/pages/LandingPage.tsx`：footer 增加三条 `<Link>`（服务条款/隐私政策/退款政策），
  与原"开源于 GitHub"并列；新增 `Link` 具名导入。

## 3. 验证

| 项 | 方式 | 结果 |
|----|------|------|
| 构建/类型 | `cd frontend && npm run build` | ✓ built 8.38s；产出 `Terms/Privacy/Refund/LegalLayout` 独立 chunk |
| 路由实测 | Vite dev + Playwright 访问 `/terms` `/privacy` `/refund` | ✓ 三页标题、分节、列表、邮箱链接、底部互链均正确渲染 |
| 首页入口 | 访问 `/`，截图 footer | ✓ 三条法务链接与 GitHub 链接并列显示 |
| 控制台 | error 级别 | 仅 `/api/logos` 500（后端未启动，与法务页无关） |

## 4. 边界与未做

- `/pricing` 未做：与定价/计费强绑定，按"支付暂不接入"刻意排除。
- 法务文案为通用模板措辞，正式商用前建议法务复核；邮箱 `support@resumegenkk.xyz` 需确保可达。
- 仅本地 dev 实测；生产可访问性随主站部署验证。

## 5. 承接：Landing 使用流程区 + FAQ（commit 8722896）

法务页上线后，按刘小排 `02-landing-page.md` 的页面层级补齐首页两屏缺失内容，
均零支付依赖，且 FAQ 承接上述法务页：

- **使用流程区**：输入/导入 → AI 协助打磨 → 导出投递，三步卡片（`frontend/src/pages/LandingPage.tsx`）。
- **FAQ 区**：费用 / 格式 / 隐私 / AI 可靠性 / 退款 五问；隐私→`/privacy`、可靠性→`/terms`、退款→`/refund`。
  轻量手风琴（`openFaq` state + framer-motion 高度过渡），首项默认展开。
- 验证：`npm run build` ✓ 7.30s；Playwright 实测两屏渲染、FAQ 单开折叠、法务页内链跳转均正确。

> 用户中心 `/account`、History 页**有意未做**：其 Plan/Usage/Billing/History 模块依赖额度与支付后端，
> 在"支付暂不接入"约束下属推测性占位，按 CLAUDE.md「不做推测性设计」暂缓。
