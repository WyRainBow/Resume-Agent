# 生产部署综合手册：Google 登录端到端打通（腾讯云 + Vercel 混合架构）

> 日期：2026-06-23
> 状态：**生产环境 Google 登录端到端可用**（`__Secure-better-auth.session_token` 跨子域生效）
> 适用域名：`resumegenkk.xyz`

本文档记录 Resume-Agent 从"本地可用"到"生产 Google 登录跑通"的完整经过、最终架构、要部署什么、要配置什么、登录链路是怎么走的，以及踩过的坑和收尾事项。

---

## 1. 一句话结论

国内服务器（腾讯云）被 GFW 拦在 Google OAuth 服务端换 token 这一步（`oauth2.googleapis.com` `ETIMEDOUT`），所以**只把 Next.js 鉴权层（`web/`）单独部署到 Vercel（海外）**，FastAPI + Vite 前端 + PostgreSQL 全部留在腾讯云；再用 BetterAuth 的**跨子域 cookie（`Domain=.resumegenkk.xyz` + `Secure`）**把登录态从 `auth.resumegenkk.xyz` 共享回 `resumegenkk.xyz`。

---

## 2. 最终生产架构

```text
                        浏览器
                          │
  ┌───────────────────────┼─────────────────────────────┐
  │                       │                             │
  ▼                       ▼                             ▼
https://resumegenkk.xyz   https://resumegenkk.xyz/api   https://auth.resumegenkk.xyz
  Vite 前端                FastAPI 业务后端               Next.js + BetterAuth 鉴权层
  （腾讯云 / Nginx）        （腾讯云 / pm2 :9000）         （Vercel，海外节点）
  静态 dist                PDF / Agent / 简历 / 鉴权校验   Google OAuth / 邮箱登录 / 会话桥
                                  │                             │
                                  └──────────────┬──────────────┘
                                                 ▼
                                       PostgreSQL（腾讯云 106.53.113.137:5432）
                                       BetterAuth 会话表 + 业务数据 + 权益表
```

要点：

- **三个服务、两个域、两台"机器"**：腾讯云一台服务器跑 Vite+FastAPI+PG，Vercel 跑鉴权层。
- `auth.resumegenkk.xyz` 与 `resumegenkk.xyz` 是**同一注册域（registrable domain）下的两个子域**，这是跨子域共享 cookie 的前提。
- 鉴权层和业务后端**共用同一个腾讯云 PostgreSQL**：Vercel 上的 BetterAuth 直接连腾讯云 PG 写会话，FastAPI 也读同一个库。

---

## 3. 为什么是这个架构（关键决策）

### 3.1 为什么 Google 鉴权必须放海外

| 现象 | 诊断 |
|------|------|
| 邮箱密码登录正常，**只有 Google 登录失败** | 说明 cookie/会话机制没问题，问题出在"调用 Google"这一步 |
| 无痕窗口点 Google 能跳到授权页 | 客户端跳转（浏览器→Google）没问题 |
| 服务端回调换 token 报 `ETIMEDOUT` | 服务端（腾讯云 IP）→ `oauth2.googleapis.com` 被 GFW 拦截 |

OAuth 授权码流程里，**最后一步"用 code 换 token"是鉴权服务器主动发起的服务端请求**。腾讯云在国内，这个出站请求到 Google 超时，所以 Google 登录永远卡在回调。把鉴权层搬到 Vercel（海外出口）后，这一步就通了。

### 3.2 为什么只搬鉴权层，不全搬 Vercel

| 组件 | 部署位置 | 原因 |
|------|----------|------|
| FastAPI（PDF/Agent/业务） | 腾讯云 | 算力重、PDF 编译耗时、Agent 是 SSE 长连接，不适合 Vercel 函数 |
| Vite 前端 | 腾讯云 | 纯静态，已在线，没必要动 |
| PostgreSQL | 腾讯云 | 数据在这，迁移成本高 |
| **Next.js 鉴权层** | **Vercel** | **只有它需要访问 Google，且体量小、天然 HTTPS** |

这是刘小排课程"Next.js + BetterAuth + Vercel 做登录最省事"的思路，但本项目做了裁剪：**只让鉴权层上 Vercel，其余留腾讯云**。

### 3.3 跨子域 cookie 是如何打通的（本次最后一个坑）

鉴权层在 `auth.resumegenkk.xyz` 上登录、种 cookie；前端在 `resumegenkk.xyz` 上要读到这个登录态。两者是不同子域，默认 cookie 互相读不到。解决链路：

1. **种到根域**：BetterAuth `crossSubDomainCookies` 把 cookie 的 `Domain` 设为 `.resumegenkk.xyz`，两个子域就都能读。
2. **跨站必须 `SameSite=None`**：跨子域请求属于跨站上下文，cookie 必须 `SameSite=None` 才会被带上。
3. **`SameSite=None` 必须配 `Secure`**：这是浏览器硬规则。一开始没设 `Secure`，浏览器**静默拒收**整个 cookie —— 表现为 DevTools 里 `auth.resumegenkk.xyz` 的 cookie 列表**完全是空的**。
4. **修复**：`useSecureCookies: true`。

打通后，浏览器里能看到这枚 cookie：

```
__Secure-better-auth.session_token
  Domain   = .resumegenkk.xyz
  SameSite = None
  Secure   = ✓
  HttpOnly = ✓
```

> `__Secure-` 前缀是 BetterAuth 在 `useSecureCookies: true` 时自动加的，看到它就说明 Secure 生效了。

---

## 4. 核心代码改动

唯一的代码改动在 `web/src/lib/auth.ts`，加了跨子域 + 强制 Secure 的 `advanced` 配置（**仅当配置了 `BETTER_AUTH_COOKIE_DOMAIN` 时启用**，本地开发不受影响）：

```ts
const cookieDomain = process.env.BETTER_AUTH_COOKIE_DOMAIN;

export const auth = betterAuth({
  // ...
  trustedOrigins, // 含 https://resumegenkk.xyz、https://auth.resumegenkk.xyz
  advanced: cookieDomain
    ? {
        // 跨子域 cookie 走 SameSite=None，必须强制 Secure，否则浏览器拒收
        useSecureCookies: true,
        crossSubDomainCookies: {
          enabled: true,
          domain: cookieDomain, // ".resumegenkk.xyz"
        },
      }
    : undefined,
  // ...
});
```

`trustedOrigins` 来自 `BETTER_AUTH_URL` + `AUTH_PROXY_ALLOWED_ORIGINS`，确保前端域被信任，否则 BetterAuth 会拒绝来自 `resumegenkk.xyz` 的请求。

---

## 5. 要部署什么（三件事 + DB）

### 5.1 Vercel — 部署 Next.js 鉴权层

```bash
cd web
npx vercel link            # 首次：关联到 Vercel 项目（project: web）
# 配置环境变量（见 6.1），逐条 vercel env add
npx vercel --prod          # 生产部署，输出 Production URL + 自动 alias
vercel domains add auth.resumegenkk.xyz   # 绑定自定义域
```

绑定域名后，按 Vercel 提示在 DNS 加解析（见 5.4）。

### 5.2 腾讯云 — Vite 前端

> ⚠️ `VITE_*` 变量是**构建期烘焙**进 dist 的，必须先写 `.env.local` 再 build。

```bash
cd frontend
# 先写 .env.local（见 6.2），再 build
npm run build
# 验证鉴权域已烘焙进产物：
grep -rl "auth.resumegenkk.xyz" dist/   # 必须有命中
# Nginx（宝塔）把 resumegenkk.xyz 指向 dist 目录
```

### 5.3 腾讯云 — FastAPI 后端

```bash
# pm2 常驻（命令来自 ~/.pm2/dump.pm2，按实际路径）
pm2 start venv/bin/uvicorn --name resume-backend --interpreter none -- \
  backend.main:app --host 0.0.0.0 --port 9000
pm2 save
# Nginx（宝塔）反代：location /api → http://127.0.0.1:9000；发送域名用 $host
```

### 5.4 DNS

| 记录 | 类型 | 值 | 说明 |
|------|------|-----|------|
| `resumegenkk.xyz` | A | 腾讯云服务器公网 IP | 前端 + FastAPI |
| `auth.resumegenkk.xyz` | A | `76.76.21.21` | Vercel（以 Vercel 控制台给出的值为准，可能是 A 或 CNAME） |

### 5.5 PostgreSQL 放行 Vercel

Vercel 函数从**海外出口**连腾讯云 PG，必须在腾讯云**安全组放行 5432**给 Vercel 的出站 IP（Vercel 出口 IP 不固定，通常需放宽来源），并确认 `pg_hba.conf` / 监听地址允许外网连接。

### 5.6 Google Cloud Console

同一个 OAuth 客户端（`740892207057-cfqq9...`）可并存多条回调地址，**生产和本地各登记一条**：

- **授权重定向 URI（生产）**：`https://auth.resumegenkk.xyz/api/auth/callback/google`
- **授权重定向 URI（本地开发）**：`http://localhost:3000/api/auth/callback/google` ← 本地用 Google 登录必须加，否则报 `Error 400: redirect_uri_mismatch`
- **授权 JavaScript 来源**：`https://auth.resumegenkk.xyz`（本地可另加 `http://localhost:3000`）

> 本地 `web/.env.local` 用的是同一个生产 Google 客户端，所以本地登录的回调 `http://localhost:3000/api/auth/callback/google` 也必须登记进这个客户端。漏登记**不是被墙**——Google 会正常返回 `redirect_uri_mismatch` 错误页，加上回调即可。生产那条保留别删，多条并存互不影响。

---

## 6. 要配置什么（环境变量逐项）

### 6.1 Vercel（`web/` 生产环境，`vercel env add <NAME> production`）

| 变量 | 生产值 | 说明 |
|------|--------|------|
| `BETTER_AUTH_URL` | `https://auth.resumegenkk.xyz` | 鉴权层自身地址 |
| `BETTER_AUTH_SECRET` | 随机 32 字节 base64 | 会话签名密钥 |
| `BETTER_AUTH_DATABASE_URL` | `postgresql://resume_user:****@106.53.113.137:5432/resume_db` | 连腾讯云 PG |
| **`BETTER_AUTH_COOKIE_DOMAIN`** | **`.resumegenkk.xyz`** | **跨子域 cookie 的开关，本次打通的关键** |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID | |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret | |
| `NEXT_PUBLIC_FASTAPI_BASE_URL` | `https://resumegenkk.xyz` | 前端可见的 FastAPI 地址 |
| `FASTAPI_INTERNAL_BASE_URL` | `https://resumegenkk.xyz` | **Vercel 连不到 `127.0.0.1`，必须填公网地址** |
| `FASTAPI_INTERNAL_AUTH_SECRET` | 与 FastAPI 一致 | Next→FastAPI 内部握手密钥 |
| `AUTH_PROXY_ALLOWED_ORIGINS` | `https://resumegenkk.xyz` | CORS 白名单 + trustedOrigins |
| `AUTH_DEFAULT_RETURN_TO` | `https://resumegenkk.xyz/workspace` | 登录后默认回跳 |

> 与腾讯云自托管版相比，**Vercel 上有两处不同**：①多了 `BETTER_AUTH_COOKIE_DOMAIN`；②`FASTAPI_INTERNAL_BASE_URL` 从内网 `http://127.0.0.1:9000` 改成公网 `https://resumegenkk.xyz`。

### 6.2 Vite 前端（`frontend/.env.local`，**build 前必须就位**）

| 变量 | 生产值 |
|------|--------|
| `VITE_AUTH_WEB_URL` | `https://auth.resumegenkk.xyz` |
| `VITE_API_VIA_AUTH_WEB` | `true` |

### 6.3 FastAPI 后端（腾讯云 `.env`）

| 变量 | 生产值 |
|------|--------|
| `FASTAPI_INTERNAL_AUTH_SECRET` | 与 Vercel 一致 |
| `BETTER_AUTH_INTERNAL_URL` | `https://auth.resumegenkk.xyz` |
| `FRONTEND_URL` | `https://resumegenkk.xyz` |
| `DATABASE_URL` | 腾讯云 PG 连接串 |
| AI / COS / JWT 等 | 按现有 `.env` 维护 |

---

## 7. 登录链路全流程（端到端时序）

```text
1. 用户在 resumegenkk.xyz 点「登录」
   → 前端跳转 https://auth.resumegenkk.xyz/account?returnTo=https://resumegenkk.xyz/workspace

2. 用户点「使用 Google 继续」
   → BetterAuth signIn.social({provider:'google'}) → 浏览器跳转 Google 授权页

3. 用户在 Google 授权
   → 回调 https://auth.resumegenkk.xyz/api/auth/callback/google?code=...

4. Vercel（海外）服务端用 code 向 oauth2.googleapis.com 换 token
   → ✅ 成功（不再被 GFW 拦）

5. BetterAuth 创建会话，写入腾讯云 PG，并 Set-Cookie：
   __Secure-better-auth.session_token; Domain=.resumegenkk.xyz; SameSite=None; Secure; HttpOnly

6. 302 → /account → 307 → returnTo（https://resumegenkk.xyz/workspace）
   → 浏览器回到前端域

7. 前端调用 https://auth.resumegenkk.xyz/api/auth-bridge/session（credentials:'include'）
   → 因 cookie Domain=.resumegenkk.xyz 且 SameSite=None+Secure，浏览器跨子域带上 cookie
   → 返回 { user }，侧边栏显示登录态 ✅

8. 业务请求 → resumegenkk.xyz/api（FastAPI）
   → FastAPI 三层鉴权（trusted headers / legacy JWT / BetterAuth Bearer）识别用户
```

关键点：第 4 步靠 Vercel 解决 GFW，第 5/7 步靠跨子域 cookie 解决登录态共享。两者缺一，Google 登录都跑不通。

---

## 8. 踩坑记录（按时间）

| 坑 | 现象 | 解决 |
|----|------|------|
| 服务器 Node 18 跑不了 Next 16 | 启动报错 | `nvm install 20`（v20.20.2）+ `pm2 update` |
| 端口 3000/3100 被 docker-proxy 占用 | 鉴权层起不来 | 当时改 8300；**搬 Vercel 后此问题作废** |
| 前端弹旧密码框，没跳鉴权层 | `VITE_AUTH_WEB_URL` 没烘焙进 dist | 服务器上**先写 `frontend/.env.local` 再 `npm run build`** |
| Google 登录 `ETIMEDOUT` | 腾讯云连不上 Google | **鉴权层搬 Vercel** |
| Vercel 连不到 FastAPI | `127.0.0.1` 在 Vercel 上无意义 | `FASTAPI_INTERNAL_BASE_URL` 改公网 `https://resumegenkk.xyz` |
| 登录后会话一直 null | DevTools cookie 列表**空** | `SameSite=None` 缺 `Secure` 被拒收 → `useSecureCookies: true` |
| 正常窗口登录态异常、无痕正常 | 旧的被拒 cookie 残留 | 清站点数据 / 用无痕复测 |
| pm2 daemon 重启丢进程 | `resume-backend` 消失 | 从 `~/.pm2/dump.pm2.bak` 取命令重建，谨慎 `pm2 save` |
| 本地 Google 登录 `Error 400: redirect_uri_mismatch` | 跳到 Google 报回调不匹配（**不是被墙**，Google 正常响应错误页） | Google Console 给该 OAuth 客户端加回调 `http://localhost:3000/api/auth/callback/google`，保留生产那条 |

---

## 9. 收尾事项（待清理 / 可选）

- [ ] **下线腾讯云上原 `auth.resumegenkk.xyz` 的 Nginx 反代**：DNS 已指向 Vercel，这段反代不再生效，可移除避免混淆。
- [ ] **停掉腾讯云 `resume-web`（pm2，端口 8300）**：鉴权层已由 Vercel 接管，`pm2 delete resume-web` 后 `pm2 save`。
- [ ] **`web/src/lib/auth.ts` 提交入库**（本次随本文档一并提交）。
- [ ] PG 安全组目前为放行 Vercel 出站而放宽了 5432 来源，后续评估是否能收敛到固定 IP 段，降低暴露面。
- [ ] 登录页"欢迎回来"默认文案优化（与本次部署无关，单独跟进）。

---

## 10. 复现一遍最短命令清单

```bash
# —— Vercel 鉴权层 ——
cd web
npx vercel link
# 11 个环境变量逐条： vercel env add <NAME> production  （见 6.1）
npx vercel --prod
vercel domains add auth.resumegenkk.xyz
# DNS: auth.resumegenkk.xyz A → 76.76.21.21（以 Vercel 提示为准）
# Google Console 加重定向 URI: https://auth.resumegenkk.xyz/api/auth/callback/google

# —— 腾讯云前端 ——
cd frontend
# 写 .env.local: VITE_AUTH_WEB_URL / VITE_API_VIA_AUTH_WEB（见 6.2）
npm run build
grep -rl "auth.resumegenkk.xyz" dist/      # 校验烘焙成功

# —— 腾讯云后端 ——
pm2 start venv/bin/uvicorn --name resume-backend --interpreter none -- \
  backend.main:app --host 0.0.0.0 --port 9000
pm2 save

# —— 腾讯云 PG ——
# 安全组放行 5432 给 Vercel 出站；确认外网可连
```

---

## 11. 关联文档

- `knowledge-base/plans/2026-06-20-auth-commercialization-roadmap.md` — 认证商业化路线图（P0 部署对应本文）
- `knowledge-base/reviews/2026-06-23-google-oauth-env-checklist.md` — Google OAuth 环境变量清单
- `knowledge-base/plans/2026-06-19-nextjs-betterauth-auth-layer.md` — 鉴权层实施计划
