# Google OAuth 完整鉴权配置清单

> 每次重新部署或在新机器上启动时对照此单检查，缺少任意一项都会导致「使用 Google 继续」按钮无反应或报错。

## 架构说明

本项目是三服务架构：

| 服务 | 端口 | 目录 | 读取的 env 文件 |
|---|---|---|---|
| FastAPI 后端 | 9000 | `backend/` | 根目录 `.env` |
| Next.js 鉴权层 | 3000 | `web/` | `web/.env.local` |
| Vite 前端 | 5173 | `frontend/` | `frontend/.env.local` |

**关键点：** Next.js 只读自己目录下的 `.env` 文件，父目录的 `.env` 对它不可见。

---

## 1. `web/.env.local`（Next.js 鉴权层，最关键）

```env
# BetterAuth 基础配置
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<openssl rand -base64 32 生成>
BETTER_AUTH_DATABASE_URL=postgresql://resume_user:0000@<host>:5432/resume_db

# Google OAuth 凭证（必须，否则 Google 登录按钮无反应）
AUTH_GOOGLE_ID=<Google Cloud Console 的 client_id>
AUTH_GOOGLE_SECRET=<Google Cloud Console 的 client_secret>

# FastAPI 通信
NEXT_PUBLIC_FASTAPI_BASE_URL=http://127.0.0.1:9000
FASTAPI_INTERNAL_BASE_URL=http://127.0.0.1:9000
FASTAPI_INTERNAL_AUTH_SECRET=<与根 .env 里 FASTAPI_INTERNAL_AUTH_SECRET 一致>

# 跨域白名单
AUTH_PROXY_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
AUTH_DEFAULT_RETURN_TO=http://localhost:5173/workspace
```

## 2. `frontend/.env.local`（Vite 前端）

```env
# 指向 Next.js 鉴权层，开启 BetterAuth 登录按钮
VITE_AUTH_WEB_URL=http://localhost:3000
```

缺少此项时，前端 `isAuthWebEnabled()` 返回 false，登录弹窗只显示旧密码表单，不显示 Google 入口。

## 3. 根目录 `.env`（FastAPI 后端）

```env
# 用于 FastAPI 验证来自 Next.js 的内部请求
FASTAPI_INTERNAL_AUTH_SECRET=<与 web/.env.local 里一致>
BETTER_AUTH_INTERNAL_URL=http://localhost:3000
```

---

## Google Cloud Console 操作步骤

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → API 和服务 → 凭据
2. 创建凭据 → OAuth 2.0 客户端 ID → 应用类型：Web 应用
3. 已授权的重定向 URI 添加：
   - 本地开发：`http://localhost:3000/api/auth/callback/google`
   - 生产环境：`https://<your-domain>/api/auth/callback/google`
4. 保存，复制 Client ID 和 Client Secret 填入 `web/.env.local`

---

## 排查流程

| 症状 | 原因 | 解决 |
|---|---|---|
| 点 Google 按钮无反应（前端） | `frontend/.env.local` 缺少 `VITE_AUTH_WEB_URL` | 创建文件，重启 Vite |
| 点 Google 按钮无反应（跳转后） | `web/.env.local` 里 `AUTH_GOOGLE_ID/SECRET` 为空 | 填入凭证，重启 Next.js |
| 重定向后报 redirect_uri_mismatch | Google Console 回调地址与实际不符 | 在 Google Console 添加正确的回调 URI |
| 登录后前端无 session | `VITE_AUTH_WEB_URL` 与 `BETTER_AUTH_URL` 不一致 | 确保两者都指向同一个 3000 端口 |
