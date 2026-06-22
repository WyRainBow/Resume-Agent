# 登录闭环核对与两处生产门槛修复

> 日期：2026-06-23
> 分支：`feature/06-20/01`
> 关联：`knowledge-base/specs/2026-06-21-auth-login-module.md`（缺口 1、5）

## 1. 背景

核对问题：登录模块是否"完整闭环、只差部署"。逐环节读真代码（非仅信文档）后结论：

- **登录主链路（认证 → 会话 → 回跳 → 三级鉴权 → 登出）在代码层已闭环、本地可用。**
- 但"只差部署"不成立——存在 **2 处必须改代码的生产门槛**，否则换生产域名即断。

证据要点：

- `web/src/lib/return-to.ts` 的 `ALLOWED_RETURN_HOSTS` 是**硬编码** `Set(["localhost:5173","127.0.0.1:5173"])`，不读环境变量。生产域名不在表内 → `sanitizeReturnTo` 返回 `""`，即使配了 `AUTH_DEFAULT_RETURN_TO` 也会被自身白名单卡空 → 登录后无法回跳工作台。
- `frontend/src/contexts/AuthContext.tsx` 的 `mapBetterAuthUser` 写死 `id: 0`，真实身份只在 `betterAuthUserId`。后端 `get_current_user` 经 `resolve_legacy_user` 能拿到真实 legacy `User.id`，但前端展示与"前端传 id 的链路"（如 Agent 会话归属）会落到 `0`。

## 2. 修复内容

### 2.1 `web/src/lib/return-to.ts`：回跳白名单环境变量化

- 默认仍含 `localhost:5173 / 127.0.0.1:5173`（本地不退化）。
- 新增 `configuredReturnHosts()`：从 `AUTH_PROXY_ALLOWED_ORIGINS`（复用代理 CORS 白名单，与 `cors.ts` 同源）解析出 host 加入白名单；同时把 `AUTH_DEFAULT_RETURN_TO` 自身 host 一并加入，避免 `getDefaultReturnTo` 被卡空。
- 校验在 `account/page.tsx`（**server component**）执行，`process.env` 在服务端可读，安全位置正确。
- 效果：生产只需设 `AUTH_PROXY_ALLOWED_ORIGINS=https://resumegenkk.xyz`，回跳即放行，**无需再改这行代码**。

### 2.2 前端真实 `legacy user.id` 回填

- `frontend/src/services/betterAuthSession.ts` 新增 `fetchLegacyUserId()`：经 Next 代理 `getAuthWebApiProxyBaseUrl()/api/auth/me`（`credentials: 'include'`，被代理注入 trusted headers），后端 `resolve_legacy_user` 返回真实记录。仅在 `VITE_API_VIA_AUTH_WEB` 开启（API 走代理）时生效。
- `frontend/src/contexts/AuthContext.tsx`：`setUser(mapBetterAuthUser(...))` 后 **fire-and-forget** 调用回填，`setUser(prev => { ...prev, id })`。
  - 不阻塞首屏（不进入 `init` 的关键路径，`setLoading(false)` 不受影响）。
  - 失败时保留 `betterAuthUserId`、`id` 维持 0，不退化、不影响 `isAuthenticated`。

实现取舍：未给 `authService` 的 `authClient`（`axios.create()` 独立实例）全局加 `withCredentials`——因 FastAPI CORS 为 `allow_origins=["*"] + credentials`，跨域带 cookie 会被浏览器拒绝，破坏 legacy 直连。改走 `betterAuthSession` + 原生 fetch（经代理同源、带 cookie），最内聚、零副作用。

## 3. 验证

| 项 | 命令 | 结果 |
|----|------|------|
| frontend 编译/类型 | `cd frontend && npm run build` | ✓ built ~7s |
| web 编译/类型 | `cd web && npm run build` | ✓ Compiled + TypeScript ✓，`/account` 为 Dynamic |
| 改动范围 | `git diff --stat` | 仅 3 个代码文件，无意外改动 |

**验证边界（如实记录）**：仅验证到**类型/编译与改动范围**。未做端到端登录运行时实测（需起 FastAPI + Next + Vite 三服务 + BetterAuth DB + Google OAuth + 真实回跳），该项属 P0 部署冒烟（`scripts/smoke-auth-stack.sh`），不在本次代码修复范围。

## 4. 剩余生产门槛（未在本次处理）

对照 spec `2026-06-21-auth-login-module.md` 的 6 个缺口：

- 缺口 1（return-to 白名单）→ ✅ 本次修复
- 缺口 5（前端 id:0）→ ✅ 本次修复
- 缺口 2（CORS）→ `cors.ts` 已读 `AUTH_PROXY_ALLOWED_ORIGINS`，**纯配置**，无需改码
- 缺口 3（Google OAuth 生产回调）→ 外部配置，待做
- 缺口 4（跨域 Cookie `SameSite/Secure`）→ 待生产验证
- 缺口 6（Admin 权限仍读 legacy JWT role）→ 待处理

商业化层（额度扣减 / 支付 / History / Settings）为**未实现**，与部署无关，按 spec 口径不计入登录闭环。
