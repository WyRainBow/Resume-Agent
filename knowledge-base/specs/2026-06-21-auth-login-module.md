# 登录模块：现状流程与生产闭环计划

> 日期：2026-06-21  
> 分支：`feature/06-20/01`  
> 状态：**本地登录主链路可用**；生产闭环（P0）未落地；支付（P1）已暂停  
> 关联：`knowledge-base/plans/2026-06-20-auth-commercialization-roadmap.md`

## 目标

1. **记录当前登录模块真实流程**（代码与请求路径，非设想）
2. **定义「登录闭环」完成标准**——生产环境端到端可用，且不依赖支付

优先级结论：**先完成 P0 登录闭环，再做支付接入**（见支付暂停实录）。

---

## 架构总览

```text
┌─────────────────────────────────────────────────────────────────┐
│  用户浏览器                                                       │
└────────────┬───────────────────────────────┬──────────────────┘
             │                               │
             ▼                               ▼
   resumegenkk.xyz:5173              auth.*:3000 (web/)
   Vite 工作台 (frontend/)           Next.js + BetterAuth
             │                               │
             │  VITE_AUTH_WEB_URL            │  Session Cookie / Bearer
             │  跳转 /account?returnTo=      │  PostgreSQL (BetterAuth 表)
             │                               │
             │  VITE_API_VIA_AUTH_WEB=true   │
             └──────────► /api/fastapi/proxy/* ──► FastAPI :9000
                          (trusted headers)         legacy User + entitlements
```

### 职责划分

| 层 | 目录 | 职责 |
|----|------|------|
| 认证与用户中心 | `web/` | BetterAuth 会话、Google/邮箱登录、`/account` 权益展示 |
| 业务 API | `backend/` | 简历、PDF、Agent；通过 trusted headers / JWT / Bearer 识别用户 |
| 工作台 UI | `frontend/` | 简历编辑；登录态来自 AuthContext；API 可走 Next 代理 |
| 权益 | `better_auth_entitlements` | 套餐/额度只读；扣减与支付写回未实现 |

---

## 当前登录流程（已实现）

### 模式 A：BetterAuth 主路径（推荐，本地已启用）

开启条件：`frontend/.env` 设置 `VITE_AUTH_WEB_URL`（如 `http://localhost:3000`）。

#### 1. 用户从 Vite 发起登录

```text
用户点击「登录」
  → AuthContext.openModal()
  → redirectToAuthWebLogin()
  → 跳转 http://localhost:3000/account?returnTo=http://localhost:5173/workspace
```

相关代码：

- `frontend/src/contexts/AuthContext.tsx` — `openModal` 检测 `isAuthWebEnabled()`
- `frontend/src/services/betterAuthSession.ts` — `redirectToAuthWebLogin`
- `web/src/lib/return-to.ts` — `sanitizeReturnTo` 仅允许 `localhost:5173` / `127.0.0.1:5173`

#### 2. 用户在 Next.js 完成登录

`/account` 渲染 `AuthPanel`，支持：

- 邮箱 + 密码（`signIn.email` / `signUp.email`）
- Google OAuth（`signIn.social({ provider: "google" })`）

BetterAuth 配置：`web/src/lib/auth.ts`

- 数据库：PostgreSQL（`BETTER_AUTH_DATABASE_URL`）
- 插件：`bearer()` + `nextCookies()`
- 路由：`web/src/app/api/auth/[...all]/route.ts`

登录成功后，若 URL 带 `returnTo`，`AuthPanel` 自动 `window.location.assign(returnTo)` 回工作台。

#### 3. Vite 恢复登录态

```text
AuthContext 初始化
  → fetchBetterAuthSession()
  → GET {VITE_AUTH_WEB_URL}/api/auth-bridge/session  (credentials: include)
  → 有 user → 写入 AuthContext，token 记为 better-auth-session
```

`auth-bridge/session` 实现：`web/src/app/api/auth-bridge/session/route.ts`  
读取 BetterAuth `getSession`，对 Vite Origin 返回 CORS + `Access-Control-Allow-Credentials`。

#### 4. 业务 API 请求（经 Next 代理）

开启 `VITE_API_VIA_AUTH_WEB=true` 时：

```text
getApiBaseUrl() → http://localhost:3000/api/fastapi/proxy

Vite axios/fetch → /api/fastapi/proxy/<fastapi-path>
  → Next 读取 BetterAuth session
  → 附加 trusted headers:
       X-Internal-Auth-Secret
       X-Better-Auth-User-Id / Email / Name / Image
  → 转发到 FastAPI /api/<path>
```

相关代码：

- `frontend/src/lib/runtimeEnv.ts` — `getAuthWebApiProxyBaseUrl()`
- `frontend/src/lib/configureAuthWebRequests.ts` — 对 auth web origin 请求加 `withCredentials`
- `web/src/app/api/fastapi/proxy/[...path]/route.ts`
- `web/src/lib/fastapi-server.ts` — `buildTrustedUserHeaders`

#### 5. FastAPI 识别用户

`backend/middleware/auth.py` 的 `get_current_user` 按优先级：

1. **Trusted headers**（来自 Next 代理，需 `FASTAPI_INTERNAL_AUTH_SECRET` 一致）
2. **Legacy JWT**（`Authorization: Bearer`，`sub` 为 legacy `users.id`）
3. **BetterAuth Bearer**（`verify_better_auth_token` 回调 Next `/api/auth/get-session`）

BetterAuth 用户映射到 legacy `User`：

- `backend/services/better_auth_users.py` — `resolve_legacy_user`
- 按 email 匹配已有用户，否则自动创建 `users` 记录（随机密码，role=user）

#### 6. 用户中心读权益

已登录用户在 `/account`：

```text
AuthPanel → GET /api/fastapi/account (Next 同源)
  → Next 带 trusted headers
  → FastAPI GET /api/auth/better/account
  → get_or_create_entitlement() → better_auth_entitlements
  → 展示 plan / credits / subscription_status（中文 UI）
```

---

### 模式 B：Legacy JWT（迁移兼容）

未设置 `VITE_AUTH_WEB_URL` 时：

```text
Vite AuthModal → POST /api/auth/login → FastAPI JWT
  → localStorage: auth_token + auth_user
  → 后续请求 Authorization: Bearer <jwt>
```

旧用户（31 条 `users`）仍可走此路径；与 BetterAuth 并行，非长期主路径。

---

## 本地开发配置清单

### 服务启动

```bash
# 终端 1：FastAPI
uv run python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000

# 终端 2：Next.js 认证层
cd web && npm run dev    # http://localhost:3000

# 终端 3：Vite 工作台
cd frontend && npm run dev    # http://127.0.0.1:5173
```

### 关键环境变量

**`web/.env.local`（示例见 `web/.env.example`）**

| 变量 | 本地值 | 作用 |
|------|--------|------|
| `BETTER_AUTH_URL` | `http://localhost:3000` | BetterAuth 基址 |
| `BETTER_AUTH_DATABASE_URL` | PostgreSQL 连接串 | 会话与用户表 |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth | 社交登录 |
| `FASTAPI_INTERNAL_BASE_URL` | `http://127.0.0.1:9000` | Next → FastAPI |
| `FASTAPI_INTERNAL_AUTH_SECRET` | 与后端一致 | Trusted handoff |
| `AUTH_PROXY_ALLOWED_ORIGINS` | `http://localhost:5173,...` | 代理 CORS |
| `AUTH_DEFAULT_RETURN_TO` | `http://localhost:5173/workspace` | 登录后默认跳转 |

**`frontend/.env.local`（示例见 `frontend/.env.example`）**

| 变量 | 本地值 | 作用 |
|------|--------|------|
| `VITE_AUTH_WEB_URL` | `http://localhost:3000` | 启用 BetterAuth 跳转 |
| `VITE_API_VIA_AUTH_WEB` | `true` | API 走 Next 代理 |

**`backend/.env`**

| 变量 | 作用 |
|------|------|
| `FASTAPI_INTERNAL_AUTH_SECRET` | 校验 trusted headers |
| `BETTER_AUTH_INTERNAL_URL` | Bearer 校验时回调 Next |

### 本地验证过的用户路径

```text
Google/邮箱登录 → /account 看到权益 → returnTo 回 /workspace
  → 上传/保存简历、PDF 等受保护 API（经 proxy + trusted headers）
```

冒烟脚本：

```bash
bash scripts/smoke-auth-stack.sh
# 检查 web 会话、FastAPI health、proxy CORS、account 401 等
```

---

## 当前完成度

| 模块 | 完成度 | 说明 |
|------|--------|------|
| BetterAuth 注册/登录（邮箱、Google） | ~90% | 本地可用；生产 OAuth 未配 |
| `/account` 用户中心（中文） | ~85% | Profile / Plan / Usage / Billing 展示 |
| Vite ↔ Next 会话桥接 | ~85% | auth-bridge、returnTo、proxy |
| FastAPI 统一鉴权 | ~80% | trusted / JWT / Bearer 三路径 |
| `better_auth_entitlements` 读取 | ~30% | 自动创建记录；默认 credits=0 |
| 权益扣减 / 注册赠额度 | 0% | 设计有，未实现 |
| 生产部署 `auth.resumegenkk.xyz` | ~10% | 方案已定，未落地 |
| 支付 | 0% | 已暂停（见 payment-provider 实录） |

### 数据库快照（2026-06-20）

| 表 | 数量 |
|----|------|
| BetterAuth `user` | 3 |
| Legacy `users` | 31 |
| `better_auth_entitlements` | 4 |

---

## 已知缺口（本地 → 生产前需处理）

> 进度（2026-06-23）：缺口 1、5 已通过代码修复关闭（commit `55a1426`），详见
> `knowledge-base/reviews/2026-06-23-auth-login-closure-fixes.md`。其余为外部配置 / 待生产验证。

1. ~~**`return-to` 白名单仅 localhost**~~ → ✅ **已修（`55a1426`）**  
   `web/src/lib/return-to.ts` 改为读 `AUTH_PROXY_ALLOWED_ORIGINS` / `AUTH_DEFAULT_RETURN_TO` 自动加入白名单，生产只需配环境变量、无需改码。

2. **CORS 白名单仅 localhost**  
   `web/src/lib/cors.ts` 默认 + `AUTH_PROXY_ALLOWED_ORIGINS` 需加入生产 Origin（纯配置，无需改码）。

3. **Google OAuth 回调 URI** 仅配了本地，未加 `https://auth.resumegenkk.xyz/api/auth/callback/google`。

4. **跨域 Cookie** 生产子域 `auth.resumegenkk.xyz` ↔ `resumegenkk.xyz` 需验证 `SameSite` / `Secure` 策略。

5. ~~**Legacy 与 BetterAuth 用户未统一合并策略（Vite 侧 `id: 0`）**~~ → ✅ **前端展示已修（`55a1426`）**  
   `betterAuthSession.fetchLegacyUserId()` 经 Next 代理 `/api/auth/me` 回填真实 legacy `User.id`；
   后端的统一合并策略（一次性迁移脚本）仍待生产前设计。

6. **Admin 权限**  
   `canUseAdminFeature()` 仍读 legacy JWT role；纯 BetterAuth 登录可能进不了 `/admin`。

---

## 未来：登录闭环（P0）定义与任务

> **闭环标准**：用户在**生产域名**完成登录后，无需手工改配置，可稳定访问用户中心、工作台及受保护 API；未登录访问返回 401；**不依赖支付**。

### 目标拓扑

```text
用户 → https://resumegenkk.xyz          (Vite 工作台)
     → https://auth.resumegenkk.xyz     (Next.js web/)
     → https://api.resumegenkk.xyz      (FastAPI，或内网 + Nginx)
     → PostgreSQL (腾讯云)
```

### P0 任务清单

#### P0-1 部署 Next.js `web/`

- [ ] Nginx 子域 `auth.resumegenkk.xyz` → `localhost:3000`（或 PM2/Docker）
- [ ] SSL（Let's Encrypt 或腾讯云证书）
- [ ] `cd web && npm run build &&` 生产启动

#### P0-2 生产环境变量

**`web/`**

| 变量 | 生产值 |
|------|--------|
| `BETTER_AUTH_URL` | `https://auth.resumegenkk.xyz` |
| `BETTER_AUTH_SECRET` | 生产随机密钥 |
| `BETTER_AUTH_DATABASE_URL` | 腾讯云 PostgreSQL |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud 生产凭据 |
| `FASTAPI_INTERNAL_BASE_URL` | `https://api.resumegenkk.xyz` 或内网地址 |
| `FASTAPI_INTERNAL_AUTH_SECRET` | 与 FastAPI 一致 |
| `AUTH_PROXY_ALLOWED_ORIGINS` | `https://resumegenkk.xyz` |
| `AUTH_DEFAULT_RETURN_TO` | `https://resumegenkk.xyz/workspace` |

**`frontend/`**

| 变量 | 生产值 |
|------|--------|
| `VITE_AUTH_WEB_URL` | `https://auth.resumegenkk.xyz` |
| `VITE_API_VIA_AUTH_WEB` | `true` |

**`backend/`**

| 变量 | 生产值 |
|------|--------|
| `BETTER_AUTH_INTERNAL_URL` | `https://auth.resumegenkk.xyz` |
| `FASTAPI_INTERNAL_AUTH_SECRET` | 与 web 一致 |
| `FRONTEND_URL` | `https://resumegenkk.xyz` |

#### P0-3 代码改动（生产前必做）

- [x] `web/src/lib/return-to.ts` — 白名单环境变量化（`55a1426`，生产配 `AUTH_PROXY_ALLOWED_ORIGINS` 即可）
- [ ] `web/src/lib/cors.ts` / 环境变量 — 允许生产 Vite Origin（纯配置）
- [ ] Google Cloud Console 添加回调：`https://auth.resumegenkk.xyz/api/auth/callback/google`
- [ ] BetterAuth `trustedOrigins`（若需显式配置）包含生产域名

#### P0-4 生产冒烟（闭环验收）

- [ ] 未登录访问受保护 API → 401
- [ ] Google 登录 → `https://auth.resumegenkk.xyz/account` 显示权益
- [ ] 自动/手动回跳 → `https://resumegenkk.xyz/workspace`
- [ ] 工作台：保存简历、上传照片、PDF 导出（经 proxy）
- [ ] 登出 → 会话清除，工作台变未登录
- [ ] 扩展 `scripts/smoke-auth-stack.sh` 支持生产 URL（可选参数）

```bash
# 生产冒烟示例（待实现参数化）
WEB_BASE_URL=https://auth.resumegenkk.xyz \
FASTAPI_BASE_URL=https://api.resumegenkk.xyz \
LEGACY_FRONTEND_ORIGIN=https://resumegenkk.xyz \
bash scripts/smoke-auth-stack.sh
```

### P0 完成后的下一步（非闭环，可并行规划）

| 阶段 | 内容 | 依赖 |
|------|------|------|
| P1 支付 | Creem / Paddle checkout + webhook | P0 + MoR 审核 |
| P1 额度 | `entitlement_usage` 扣减、注册赠 10 credits | P0 |
| P2 法务页 | `/terms` `/privacy` `/refund` `/pricing` | MoR 审核 + 合规 |

---

## 核心文件索引

| 路径 | 说明 |
|------|------|
| `web/src/lib/auth.ts` | BetterAuth 服务端配置 |
| `web/src/lib/auth-client.ts` | BetterAuth 客户端（Bearer 存 localStorage） |
| `web/src/components/auth-panel.tsx` | 登录表单 + 权益展示 + returnTo |
| `web/src/app/account/page.tsx` | 用户中心页 |
| `web/src/app/api/auth-bridge/session/route.ts` | Vite 读会话 |
| `web/src/app/api/fastapi/proxy/[...path]/route.ts` | 业务 API 代理 |
| `web/src/lib/return-to.ts` | 登录回跳白名单 |
| `web/src/lib/cors.ts` | 代理 CORS |
| `frontend/src/contexts/AuthContext.tsx` | Vite 登录态 |
| `frontend/src/lib/configureAuthWebRequests.ts` | 跨域 Cookie |
| `frontend/src/lib/runtimeEnv.ts` | auth web / proxy 开关 |
| `backend/middleware/auth.py` | 统一鉴权依赖 |
| `backend/services/better_auth_users.py` | BetterAuth → legacy User |
| `backend/services/better_auth_entitlements.py` | 权益读/建 |
| `backend/routes/better_auth.py` | `/api/auth/better/*` |
| `scripts/smoke-auth-stack.sh` | 本地冒烟 |

---

## 相关文档

| 文件 | 说明 |
|------|------|
| `knowledge-base/plans/2026-06-20-auth-commercialization-roadmap.md` | P0–P3 总路线图 |
| `knowledge-base/reviews/2026-06-20-payment-provider-evaluation-pause.md` | 支付探索暂停记录 |
| `knowledge-base/specs/2026-03-31-monetization-model.md` | Freemium + 额度模型 |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版：记录当前登录流程与未来 P0 闭环计划 |