# 2026-06-23 会话综合记录：登录闭环修复 + 法务页 + Landing 转化

> 日期：2026-06-23
> 分支：`feature/06-20/01`（已 push 到 `origin`，HEAD = `8b1a437`）
> 操作人：coco yu（weiyu9484@gmail.com）
> 主题：在"商业化但支付暂不接入"的约束下，清掉登录生产门槛、补齐支付前置法务页、优化首页转化
> 关联：
> - `knowledge-base/reviews/2026-06-23-auth-login-closure-fixes.md`
> - `knowledge-base/reviews/2026-06-23-legal-pages.md`
> - `knowledge-base/reviews/2026-06-20-payment-provider-evaluation-pause.md`
> - `knowledge-base/imports/liu-xiaopai-overseas-ai-product-notes/`（刘小排课程 KB）

---

## 0. 一句话总览

本次会话围绕"让产品具备可商业化的前置条件"，但**全程不接入支付**：
修了登录的 2 处生产门槛、上线了 3 个法务页与首页入口、补了首页"使用流程 + FAQ"两屏，
并明确把"依赖支付/额度后端"的用户中心类页面**主动暂缓**，避免推测性占位。

---

## 1. 已完成（按提交）

| 提交 | 类型 | 内容 |
|------|------|------|
| `55a1426` | fix(auth) | 登录闭环 2 处生产门槛修复 |
| `23ac741` | chore | `.gitignore` 忽略本地 codegraph 索引 |
| `17de7b6` | feat | 法务页 terms/privacy/refund + 首页页脚入口 |
| `8722896` | feat | 首页"使用流程区"+"FAQ 区" |
| `8b1a437` | docs | 记录 Landing 增强 |

### 1.1 登录闭环修复（`55a1426`）

核对结论：登录主链路（认证 → 会话 → 回跳 → 三级鉴权 → 登出）**代码层已闭环**，
但"只差部署"不成立，存在 2 处必须改码的门槛：

- **`web/src/lib/return-to.ts`**：回跳白名单原为硬编码 `localhost:5173`，
  生产域名换上去会被自身白名单卡空 → 登录后无法回跳。改为读
  `AUTH_PROXY_ALLOWED_ORIGINS` / `AUTH_DEFAULT_RETURN_TO` 自动加入白名单，
  生产只需配环境变量、**无需再改码**。
- **前端 `id: 0`**：`AuthContext.mapBetterAuthUser` 写死 `id:0`，真实身份只在
  `betterAuthUserId`。新增 `betterAuthSession.fetchLegacyUserId()` 经 Next 代理
  `/api/auth/me`（带 trusted headers）取真实 legacy `User.id`，登录后 fire-and-forget 回填。

实现取舍：未给 `authService`（`axios.create()` 实例）全局加 `withCredentials`——
因 FastAPI CORS 为 `allow_origins=["*"] + credentials`，跨域带 cookie 会被浏览器拒绝。
改走 `betterAuthSession` + 原生 fetch 经同源代理，最内聚、零副作用。

验证：`frontend` 与 `web` 均 `npm run build` ✓；**未做**端到端登录运行时实测（需三服务 + DB + OAuth）。

### 1.2 法务页（`17de7b6`）

支付平台（Paddle 域名审核、MoR 通用要求）的前置门槛：站点需上线
`/terms` `/privacy` `/refund` 且首页页脚可点击。本次只补静态法务页与入口，
**不触碰任何 checkout/webhook/计费代码**。

- 新增 `frontend/src/pages/Legal/`：`LegalLayout.tsx`（共享外壳，含 `SUPPORT_EMAIL`）
  + `Terms.tsx` / `Privacy.tsx` / `Refund.tsx`（中文内容，slate/blue + dark-mode）。
- `App.tsx` 接 3 条 `lazyWithRetry` 路由；`LandingPage` 页脚加 3 条法务链接。
- 验证：`npm run build` ✓；Playwright 实测三页渲染、内链、邮箱链接、页脚入口均正确。

### 1.3 Landing 使用流程 + FAQ（`8722896`）

按刘小排 `02-landing-page.md` 页面层级，补首页缺失两屏，零支付依赖：

- **使用流程区**：输入/导入 → AI 协助打磨 → 导出投递，三步卡片。
- **FAQ 区**：费用 / 格式 / 隐私 / AI 可靠性 / 退款 五问，轻量手风琴（首项默认展开）；
  其中 3 问内链到法务页（`/privacy` `/terms` `/refund`），与 1.2 形成闭环。
- 验证：`npm run build` ✓ 7.30s；Playwright 实测两屏渲染、FAQ 单开折叠、内链跳转均正确。

---

## 2. 未做 / 刻意暂缓（含原因）

### 2.1 主动暂缓（约束所致，非遗漏）

- **`/pricing` 定价页**：与定价/计费强绑定，按"支付暂不接入"刻意排除。
- **用户中心 `/account`、History 页**：刘小排 `03-auth-user-center.md` 列的模块为
  Profile / Plan / Usage / Billing / History，其中 **Plan/Usage/Billing/History 全部依赖额度与支付后端**。
  当前无 `credits`/`subscription` 数据，建页只能放空占位，属 CLAUDE.md 禁止的"推测性设计"——
  待支付恢复、有真实数据后再做才有内容可填。
- **支付接入本身**：Creem KYC（Sumsub 待人工）、Paddle 默认付款链接/个体户、billing 抽象 + webhook + 额度充值，
  全部按用户决策暂停，详见 `2026-06-20-payment-provider-evaluation-pause.md`。

### 2.2 登录剩余生产门槛（外部配置 / 待验证，非本次代码范围）

对照 spec `2026-06-21-auth-login-module.md` 的 6 个缺口：

- 缺口 1（return-to 白名单）→ ✅ 已修（`55a1426`）
- 缺口 5（前端 id:0）→ ✅ 已修（`55a1426`）
- 缺口 2（CORS）→ `cors.ts` 已读环境变量，**纯配置**，无需改码
- 缺口 3（Google OAuth 生产回调）→ 外部配置（Google Cloud Console + 生产域名），待做
- 缺口 4（跨域 Cookie `SameSite/Secure`）→ 待生产验证
- 缺口 6（Admin 权限仍读 legacy JWT role）→ 待处理

### 2.3 验证盲区（如实记录）

- 登录全链路**未做端到端运行时实测**：需起 FastAPI + Next + Vite 三服务 + BetterAuth DB + Google OAuth + 真实回跳，
  属 P0 部署冒烟（`scripts/smoke-auth-stack.sh`），不在本次代码修复范围。
- 法务文案为**通用模板措辞**，正式商用前建议法务复核；`support@resumegenkk.xyz` 需确保可达。
- 所有前端验证仅在**本地 dev**，生产可访问性随主站部署再验。

---

## 3. 还能做什么（候选路线）

### 3.1 零支付依赖、可立即做（优先）

- **Landing 继续打磨**：痛点区 / before-after 视觉 / 真实产品截图（文档 `02` 建议的首屏视觉），
  目前 Hero 用的是结构化骨架预览，可补一段 GIF 或 before/after。
- **Settings 页完善**：`frontend/src/pages/Settings/index.tsx` 已存在（367 行），
  可补语言 / 主题 / 删除账号等非支付项（文档 `03` 用户中心 Settings 模块的可做部分）。
- **登录缺口 3/4/6 中不依赖支付的部分**：Admin 权限改读 BetterAuth role（缺口 6）属纯代码，可做。

### 3.2 需外部配置（非纯代码）

- Google OAuth 生产回调 URL 配置（缺口 3）。
- 生产域名跨域 Cookie `SameSite/Secure` 验证（缺口 4）。
- 部署冒烟脚本跑通（`scripts/smoke-auth-stack.sh`）。

### 3.3 待支付恢复后（被 2.1 阻塞）

- billing 抽象（`paddle | creem`）+ webhook + `better_auth_entitlements` 额度充值。
- 用户中心 `/account`（Plan/Usage/Billing/History）+ `/pricing`。
- 额度扣减、免费/付费分层与付费引导（文档 `03` 三类用户模型）。

---

## 4. 关键技术约束（接手必读）

- **三服务架构**：Vite 前端（`frontend/` :5173）+ Next 认证层（`web/` :3000，BetterAuth）+ FastAPI（`backend/` :9000）。
- **FastAPI CORS = `allow_origins=["*"] + credentials`**：浏览器禁止跨域带 cookie，
  因此前端凡需带 cookie 的请求必须经 Next 同源代理（注入 trusted headers），不能给 axios 实例全局开 `withCredentials`。
- **回跳白名单**：生产只配 `AUTH_PROXY_ALLOWED_ORIGINS`，不要再硬编码 host。
- **支付红线**：本阶段不写任何 checkout/webhook/计费代码，不建依赖额度/订阅的占位页。

---

## 5. 提交与推送状态

- 本次会话 5 个提交（`55a1426` → `8b1a437`）已全部 push 到 `origin/feature/06-20/01`。
- 推送方式：origin 配的是 SSH 但本地 ssh-agent 无可用私钥，改用已认证 `gh` token 走 HTTPS 一次性推送，
  **未改动 remote 配置**。后续直接 `git push` 需 `ssh-add` 加载私钥或 `gh auth setup-git`。
- `.claude/settings.local.json` 为既有本地改动，按规则保持未提交、未推送。
