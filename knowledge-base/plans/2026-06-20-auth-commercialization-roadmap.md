# 认证商业化与生产部署路线图

> 日期：2026-06-20  
> 分支：`feature/06-19/05` → `dev`  
> 状态：认证主链路可用；商业化与生产部署待实施

## 背景

Resume-Agent 已完成 Next.js + BetterAuth 认证层与 FastAPI handoff，Vite 工作台可通过 Next.js 代理携带登录态访问业务 API。本文档记录当前完成度、部署选型结论，以及 P0–P3 实施计划。

## 当前完成度（2026-06-20）

| 模块 | 完成度 | 说明 |
|------|--------|------|
| BetterAuth 登录（Google / 邮箱） | ~90% | 本地已验证，生产 OAuth 未配 |
| 用户中心 `/account` | ~85% | 中文界面、Profile/Plan/Usage/Billing 展示 |
| FastAPI 统一鉴权 | ~80% | trusted headers → JWT → BetterAuth Bearer；legacy User 映射 |
| Vite ↔ Next 会话桥接 | ~85% | auth-bridge、侧边栏头像、`VITE_API_VIA_AUTH_WEB` |
| 权益表 `better_auth_entitlements` | ~30% | 表结构与读取已有，扣减/充值未实现 |
| Stripe 支付 / Webhook | 0% | 未开始 |
| 生产部署 | ~10% | Vercel CLI 已装；腾讯云方案未落地 |

### 已验证链路

- Google 登录 → `/account` → 跳转工作台
- `bash scripts/smoke-auth-stack.sh` 通过
- BetterAuth 相关 pytest 15 passed
- `web` / `frontend` build 通过

### 数据库用户快照（2026-06-20）

| 表 | 数量 |
|----|------|
| BetterAuth `user` | 3 |
| Legacy `users` | 31 |
| `better_auth_entitlements` | 4（含 1 条历史遗留） |

## 部署选型：Vercel vs 腾讯云

### 课程路径（刘小排 / 海外 AI 产品）

课程推荐 **Next.js + BetterAuth** 做登录与用户中心，**Vercel 是默认最省事的部署方式**（HTTPS、OAuth、海外访问），但**不是硬性要求**。

### 本项目结论：优先全腾讯云

| 组件 | 建议部署位置 | 理由 |
|------|--------------|------|
| FastAPI（PDF、Agent、业务 API） | 腾讯云 | 算力重、耗时长，不适合 Vercel |
| Vite 工作台 `resumegenkk.xyz` | 腾讯云 | 已在线 |
| PostgreSQL | 腾讯云 | 已在 `106.53.113.137` |
| Next.js `web/`（BetterAuth、/account） | **腾讯云子域** | 与 DB、FastAPI 同区域，Cookie/CORS 更简单 |

推荐拓扑：

```text
用户 → resumegenkk.xyz          (Vite 工作台)
     → auth.resumegenkk.xyz     (Next.js web/)
     → api.resumegenkk.xyz      (FastAPI)
     → PostgreSQL               (腾讯云)
```

Vercel CLI / Plugin 保留为备选工具，不绑定部署方式。

---

## P0 — 生产上线（必做）

> 目标：生产环境登录链路端到端可用（不依赖 Stripe）。

### P0-1 Next.js `web/` 腾讯云部署

- [ ] Nginx 子域 `auth.resumegenkk.xyz` → `localhost:3000`
- [ ] 服务器执行 `cd web && npm run build && pm2 start`（或 Docker）
- [ ] SSL 证书（Let's Encrypt 或腾讯云证书）

### P0-2 生产环境变量

**`web/`（Next.js）**

| 变量 | 生产值示例 |
|------|------------|
| `BETTER_AUTH_URL` | `https://auth.resumegenkk.xyz` |
| `BETTER_AUTH_SECRET` | 生产随机密钥 |
| `BETTER_AUTH_DATABASE_URL` | 腾讯云 PostgreSQL |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud 生产凭据 |
| `FASTAPI_INTERNAL_BASE_URL` | `https://api.resumegenkk.xyz` 或内网地址 |
| `FASTAPI_INTERNAL_AUTH_SECRET` | 与 FastAPI 一致 |
| `AUTH_PROXY_ALLOWED_ORIGINS` | `https://resumegenkk.xyz` |
| `AUTH_DEFAULT_RETURN_TO` | `https://resumegenkk.xyz/workspace` |

**`frontend/`（Vite）**

| 变量 | 生产值示例 |
|------|------------|
| `VITE_AUTH_WEB_URL` | `https://auth.resumegenkk.xyz` |
| `VITE_API_VIA_AUTH_WEB` | `true` |

**`backend/`（FastAPI）**

| 变量 | 生产值示例 |
|------|------------|
| `BETTER_AUTH_INTERNAL_URL` | `https://auth.resumegenkk.xyz` |
| `FASTAPI_INTERNAL_AUTH_SECRET` | 与 web 一致 |
| `FRONTEND_URL` | `https://resumegenkk.xyz` |

### P0-3 Google OAuth 生产配置

- [ ] Google Cloud Console 添加授权重定向 URI：`https://auth.resumegenkk.xyz/api/auth/callback/google`
- [ ] BetterAuth `trustedOrigins` 包含 `https://resumegenkk.xyz`、`https://auth.resumegenkk.xyz`
- [ ] 执行 `AUTH_ENV_REQUIRE_GOOGLE=true bash scripts/check-auth-stack-env.sh` 验证

### P0-4 跨域 Cookie 与 CORS

- [ ] 确认 `auth.resumegenkk.xyz` 与 `resumegenkk.xyz` 跨域 Cookie（`SameSite=None; Secure` 或同站策略）
- [ ] `configureAuthWebRequests.ts` 生产环境 `credentials: include` 生效
- [ ] `OPTIONS` 预检对生产 Origin 返回 204

### P0-5 生产冒烟

- [ ] 登录 → 用户中心 → 工作台 → 上传照片 / 保存简历 / PDF 导出
- [ ] 未登录访问受保护 API 返回 401
- [ ] 更新 `scripts/smoke-auth-stack.sh` 支持生产 URL（可选参数）

---

## P1 — Stripe 支付与 Webhook

> 目标：能收钱，权益表与 Stripe 状态同步。  
> 参考：`knowledge-base/specs/2026-03-31-monetization-model.md`（Freemium + 按次额度）

### P1-1 Stripe 基础设施

- [ ] Stripe 账号与测试/生产 API Key
- [ ] 定义套餐：free / pro（Price ID、订阅周期）
- [ ] 环境变量：`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_PRO_MONTHLY` 等

### P1-2 后端 API

- [ ] `POST /api/billing/checkout` — 创建 Checkout Session（订阅或一次性）
- [ ] `POST /api/billing/portal` — Customer Portal 链接
- [ ] `POST /api/billing/webhook` — Stripe Webhook（验签 + 幂等）
- [ ] Webhook 事件处理：
  - `checkout.session.completed`
  - `customer.subscription.created` / `updated` / `deleted`
  - `invoice.paid` / `invoice.payment_failed`

### P1-3 权益表写回

- [ ] 更新 `better_auth_entitlements`：`plan`、`credits`、`subscription_status`、`provider_customer_id`、`provider_subscription_id`、`current_period_end`
- [ ] 新用户注册赠送 10 credits（设计文档要求，当前默认为 0）

### P1-4 用户中心 UI

- [ ] `/account` 账单区「升级 / 管理订阅」按钮
- [ ] 支付成功/取消回跳页
- [ ] 显示真实订阅状态与周期截止日

### P1-5 安全与运维

- [ ] Webhook 幂等表（`stripe_event_id` 去重）
- [ ] 日志不打印完整 API Key
- [ ] Stripe CLI 本地 webhook 转发测试

---

## P1 — 额度扣减业务逻辑

> 目标：AI / PDF 等消耗与权益表联动，超额引导付费。

### P1-6 扣减服务

- [ ] 新增 `backend/services/entitlement_usage.py`
  - `check_and_consume(better_auth_user_id, action, cost=1)`
  - 日切重置 `daily_usage_count`（`last_usage_reset_at`）
- [ ] 注册时 `credits=10`（免费层）

### P1-7 接入点（按 monetization spec）

| 动作 | 扣减规则 |
|------|----------|
| AI 改写 / 评分 / Agent | 每次 1 credit |
| PDF 导出 | 按产品定义（可先免费） |
| 简历数量 | 免费 1 份，超出引导付费 |

建议优先接入：

- [ ] `/api/resume/rewrite`、`/api/resume/score`
- [ ] Agent `/api/agent/stream`
- [ ] `/api/resumes` 创建时校验简历数量

### P1-8 前端拦截

- [ ] API 402/403 统一提示「额度不足」
- [ ] 弹窗引导 `/account` 或 Stripe Checkout
- [ ] 用户中心展示实时剩余额度

---

## P2 — 认证层收尾

| 任务 | 现状 | 动作 |
|------|------|------|
| `canUseAgentFeature()` | 仍只看 `auth_token` | 识别 `better-auth-session` |
| `canUseAdminFeature()` | 未接 BetterAuth 映射 | 从 legacy User.role 判断 |
| 双轨 JWT | `backend/routes/auth.py` 仍在 | 全量迁移后下线 |
| 权益脏数据 | 4 条 entitlement vs 3 user | 清理孤立记录 |
| 旧 smoke 测试账号 | `smoke-*@example.com` | 生产前清理或隔离 |

---

## P3 — 商业化体验与增长

- [ ] Landing 定价区 + CTA 链到 `/account`
- [ ] 用量 / 账单历史（不只当前快照）
- [ ] 邮件通知（订阅到期、额度不足）
- [ ] E2E：登录 → 付费 → 扣额度 → 功能解锁
- [ ] 国内支付（微信 / 支付宝）评估 — 设计文档标注「待定」，海外优先 Stripe

---

## 建议实施顺序

```text
P0 生产部署（腾讯云全栈）
  ↓
P1 Stripe Checkout + Webhook
  ↓
P1 额度扣减 + 前端拦截
  ↓
P2 认证收尾 + 数据清理
  ↓
P3 增长与体验
```

预估工时（单人）：

| 阶段 | 工时 |
|------|------|
| P0 | 1–2 天 |
| P1 Stripe | 2–3 天 |
| P1 扣减 | 2 天 |
| P2 | 1 天 |
| P3 | 按需 |

---

## 关键文件索引

| 路径 | 用途 |
|------|------|
| `web/` | Next.js + BetterAuth + `/account` |
| `web/src/app/api/fastapi/proxy/[...path]/route.ts` | Vite → FastAPI 代理 |
| `backend/middleware/auth.py` | 统一鉴权 |
| `backend/services/better_auth_users.py` | BetterAuth → legacy User |
| `backend/services/better_auth_entitlements.py` | 权益读取 |
| `backend/routes/better_auth.py` | `/api/auth/better/*` |
| `frontend/src/lib/runtimeEnv.ts` | `VITE_AUTH_WEB_URL`、`VITE_API_VIA_AUTH_WEB` |
| `frontend/src/lib/authHeaders.ts` | BetterAuth 会话请求头 |
| `scripts/smoke-auth-stack.sh` | 本地认证冒烟 |
| `knowledge-base/specs/2026-03-31-monetization-model.md` | 付费模型设计 |
| `knowledge-base/plans/2026-06-19-nextjs-betterauth-auth-layer.md` | 认证层实施计划 |

---

## 相关提交（feature/06-19/05）

| Commit | 说明 |
|--------|------|
| `f9fc67f` | Next.js BetterAuth 层 + FastAPI handoff |
| `71ddedc` | Vite 侧边栏同步 BetterAuth 会话 |
| `15b06c9` | 统一鉴权 + proxy 修复 + 用户中心增强 |
| `6920f2c` | 用户中心中文化 |
| `4ac07b4` | Vercel CLI（备选工具，非绑定部署） |