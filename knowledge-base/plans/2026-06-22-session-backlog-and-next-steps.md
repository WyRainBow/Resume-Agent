# 本地稳定性修复记录与后续待办总览

> 日期：2026-06-22  
> 分支：`feature/06-20/01`  
> 状态：本地三件套可跑；生产登录闭环与若干体验问题待实施  
> 关联：
> - `knowledge-base/specs/2026-06-21-auth-login-module.md`（登录模块现状与 P0 闭环）
> - `knowledge-base/plans/2026-06-20-auth-commercialization-roadmap.md`（认证商业化路线图）

---

## 1. 本文档目的

把近期会话里**已经做完的**、**计划要做的**事情写清楚，方便后续按优先级推进，避免口头约定散落。

范围覆盖：

1. 本地开发稳定性（COS / 认证 / PDF）
2. 登录模块生产闭环（P0）
3. Agent 对话 PDF 预览防抖
4. BetterAuth 与 legacy 用户体系衔接
5. 支付与额度（P1，已暂停）

---

## 2. 本地开发拓扑（当前默认）

```text
┌──────────────────────────────────────────────────────────────┐
│ 浏览器                                                        │
└────────────┬────────────────────────────┬────────────────────┘
             │                            │
             ▼                            ▼
   http://127.0.0.1:5173          http://localhost:3000
   Vite 工作台 (frontend/)        Next.js + BetterAuth (web/)
             │                            │
             │  VITE_AUTH_WEB_URL         │  Session Cookie
             │  VITE_API_VIA_AUTH_WEB     │  PostgreSQL（当前多为远程 106.53.113.137）
             └────► /api/fastapi/proxy/* ─┴──► FastAPI :9000 (backend/)
```

### 关键本地配置

| 文件 | 关键变量 | 说明 |
|------|----------|------|
| `frontend/.env.local` | `VITE_AUTH_WEB_URL=http://localhost:3000` | 登录跳转 Next |
| `frontend/.env.local` | `VITE_API_VIA_AUTH_WEB=true` | 业务 API 走 Next 代理 |
| `web/.env.local` | `BETTER_AUTH_DATABASE_URL` | BetterAuth 会话库（常为远程 PG） |
| `backend/.env` | `FASTAPI_INTERNAL_AUTH_SECRET` | 与 web 一致，trusted headers 校验 |

### 启动命令

```bash
# 终端 1
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000

# 终端 2
cd web && npm run dev

# 终端 3
cd frontend && npm run dev
```

冒烟：

```bash
bash scripts/smoke-auth-stack.sh
```

---

## 3. 已完成（2026-06-22 前本会话）

| 提交 | 问题 | 修复要点 |
|------|------|----------|
| `6881dee` | 本地 COS / logo 卡死 | `NO_PROXY`、COS 客户端禁用代理；非 production 优先本地 logo；`/api/logos` 走线程池 |
| `8c99c63` | 前端首屏一直 loading | BetterAuth session 8s 超时 + `finally` 解除 loading；BetterAuth 启用时跳过 legacy JWT `/api/auth/me`；web PG 连接超时 5s |
| `c9fa4ca` | PDF 导入「服务器内部错误」 | `upload_resume_pdf` 的 `print(flush=True)` 改 `logger`（修 BrokenPipeError→500）；全局处理 BrokenPipeError；前端流式错误展示 detail |

### 验收结论（本地）

- `5173` / `3000` / `9000` 三端口可同时访问
- PDF 上传经代理约 40–90s 返回 200（正常）
- health / session 多数时候毫秒级；远程 PG 偶发慢或断连

---

## 4. 登录模块：现状与计划（P0 优先）

> 详细流程见 `knowledge-base/specs/2026-06-21-auth-login-module.md`

### 4.1 已实现（本地可用）

| 能力 | 完成度 | 说明 |
|------|--------|------|
| BetterAuth 邮箱 / Google 登录 | ~90% | `web/src/lib/auth.ts` + `AuthPanel` |
| `/account` 用户中心（中文） | ~85% | Profile / Plan / Usage / Billing 展示 |
| Vite ↔ Next 会话桥接 | ~85% | `auth-bridge/session`、`returnTo`、proxy |
| FastAPI 统一鉴权 | ~80% | trusted headers → JWT → BetterAuth Bearer |
| Legacy JWT 并行 | 兼容 | 未设 `VITE_AUTH_WEB_URL` 时仍可用 |

### 4.2 登录闭环定义（P0 完成标准）

用户在**生产域名**完成登录后，无需手工改配置，可稳定：

1. 访问 `https://auth.resumegenkk.xyz/account` 看到权益
2. 回跳 `https://resumegenkk.xyz/workspace`
3. 经 proxy 调用受保护 API（保存简历、上传、PDF）
4. 登出后会话清除

**不依赖支付。**

### 4.3 P0 任务清单（待做）

#### 部署

- [ ] Nginx：`auth.resumegenkk.xyz` → Next.js `web/`（PM2 或 Docker）
- [ ] SSL 证书
- [ ] `cd web && npm run build` 生产启动

#### 环境变量（生产）

| 组件 | 变量 | 生产值 |
|------|------|--------|
| web | `BETTER_AUTH_URL` | `https://auth.resumegenkk.xyz` |
| web | `AUTH_PROXY_ALLOWED_ORIGINS` | `https://resumegenkk.xyz` |
| web | `AUTH_DEFAULT_RETURN_TO` | `https://resumegenkk.xyz/workspace` |
| frontend | `VITE_AUTH_WEB_URL` | `https://auth.resumegenkk.xyz` |
| frontend | `VITE_API_VIA_AUTH_WEB` | `true` |
| backend | `BETTER_AUTH_INTERNAL_URL` | `https://auth.resumegenkk.xyz` |
| backend | `FASTAPI_INTERNAL_AUTH_SECRET` | 与 web 一致 |

#### 代码改动（生产前必做）

- [ ] `web/src/lib/return-to.ts` — `ALLOWED_RETURN_HOSTS` 增加 `resumegenkk.xyz`
- [ ] `web/src/lib/cors.ts` / 环境变量 — 允许生产 Vite Origin
- [ ] Google Cloud 添加回调：`https://auth.resumegenkk.xyz/api/auth/callback/google`
- [ ] 验证跨域 Cookie（`auth.*` ↔ 主站）策略
- [ ] 扩展 `scripts/smoke-auth-stack.sh` 支持生产 URL 参数

#### P0 验收冒烟

- [ ] 未登录受保护 API → 401
- [ ] Google / 邮箱登录 → account → workspace
- [ ] 保存简历、上传照片、PDF 导出
- [ ] 登出后会话清除

### 4.4 登录相关已知缺口（本地已暴露）

| 问题 | 现象 | 计划修复 |
|------|------|----------|
| 远程 PG 慢 | session 曾卡 70s+，首屏 loading | 本地开发改用本地 PG 或连接池；生产 PG 同区域部署 |
| BetterAuth 前端 `id: 0` | `mapBetterAuthUser` 写死 `id: 0` | 登录后调 FastAPI 解析 legacy user，回填真实 `user.id` |
| Agent `user_id=0` | `cv_editor_agent` 持久化失败 | 同上：trusted handoff 后统一用 legacy `User.id` |
| Admin 权限 | 纯 BetterAuth 可能进不了 `/admin` | 按 email 映射 legacy role，或单独 admin 白名单 |
| Legacy 与 BetterAuth 未统一合并 | 同邮箱可能有两套 id | 明确合并策略文档 + 一次性迁移脚本（P0 后） |

---

## 5. PDF 预览防抖（计划做）

### 5.1 现状

| 场景 | 防抖 | 机制 |
|------|------|------|
| 工作台 v2 `index.tsx` | ✅ 2s | `PDF_RENDER_DEBOUNCE_MS = 2000` + pending 合并 |
| LaTeX 工作台 `latex/index.tsx` | ✅ 2s | 同上 + 数据 fingerprint |
| Agent 对话 `SophiaChat.tsx` | ❌ | 仅 in-flight 锁 + blob 缓存 |

Agent 侧每次 `resume_patch` / `resume_updated` 会：

1. 清空 `blob`
2. 更新 `loadedResumes` → `selectedLoadedResume` 引用变化
3. `useEffect` **立即**调用 `renderResumePdfPreview`（`trigger=auto-effect`）

日志表现为大量并发 `POST /api/pdf/render/stream`，单次 5–35s，容易把后端打满。

### 5.2 计划实现（对齐工作台）

文件：`frontend/src/pages/AgentChat/SophiaChat.tsx`

- [ ] 增加 `PDF_RENDER_DEBOUNCE_MS = 2000` 与 `renderTimerRef`
- [ ] `selectedLoadedResume` 变化时走 `scheduleRender`，而非立即渲染
- [ ] 增加 `lastRenderedDataRef`（JSON fingerprint）跳过无变化重渲染
- [ ] 渲染进行中继续 patch → `hasPendingRenderRef`，结束后补一次
- [ ] 从 `renderResumePdfPreview` 的 `useCallback` deps 移除 `resumePdfPreview`，减少 effect 误触发
- [ ] 手动「重新渲染」仍走 `force=true` 绕过防抖

### 5.3 验收

- Agent 连续 patch 10 次 → 2s 空闲后最多触发 1–2 次 render
- 后端日志 `SophiaChat.renderResumePdfPreview` 频率明显下降
- 手动重试仍即时生效

---

## 6. 其他待办（按优先级）

### P0+（与登录并行或紧随其后）

| 项 | 说明 |
|----|------|
| `db_conversation_storage.py` 用户改动 | 工作区有未提交修改，需确认是否与 `user_id` 映射相关后单独提交 |
| PDF `render/stream` 偶发 500 | 需结合 `X-PDF-Trace-*` 日志定位 LaTeX / 字体 / 超时 |
| COS logo 8s 超时 | 已有本地 fallback；生产需确认 COS 网络或 CDN |

### P1（支付与额度，已暂停）

> 见 `knowledge-base/reviews/2026-06-20-payment-provider-evaluation-pause.md`

- Creem / Paddle checkout + webhook
- `better_auth_entitlements` 扣减、注册赠 credits
- `/terms` `/privacy` `/refund` `/pricing`

### P2（体验与架构）

- 自然语言简历重构（`knowledge-base/plans/2026-03-24-nl-resume-refactor.md`）
- 简历评分（`knowledge-base/plans/2026-05-20-resume-scoring-plan.md`）
- Vite 复杂页面向 Next 渐进迁移（非紧急）

---

## 7. 推荐实施顺序

```text
① P0 登录生产闭环（部署 + 白名单 + OAuth + 冒烟）
        ↓
② BetterAuth → legacy User.id 回填（修 Agent 持久化 + 前端 id:0）
        ↓
③ SophiaChat PDF 预览 2s 防抖
        ↓
④ PDF render 500 / COS 稳定性排查
        ↓
⑤ P1 支付与额度（MoR 审核通过后）
```

---

## 8. 核心文件索引

| 路径 | 说明 |
|------|------|
| `knowledge-base/specs/2026-06-21-auth-login-module.md` | 登录模块现状与 P0 细则 |
| `knowledge-base/plans/2026-06-20-auth-commercialization-roadmap.md` | 认证商业化总路线图 |
| `frontend/src/contexts/AuthContext.tsx` | Vite 登录态、`id:0` 映射点 |
| `frontend/src/pages/AgentChat/SophiaChat.tsx` | Agent PDF 预览（待加防抖） |
| `frontend/src/pages/Workspace/v2/index.tsx` | 工作台 PDF 防抖参考实现 |
| `web/src/lib/return-to.ts` | 登录回跳白名单（待加生产域名） |
| `backend/middleware/auth.py` | FastAPI 统一鉴权 |
| `backend/services/better_auth_users.py` | BetterAuth → legacy User |
| `scripts/smoke-auth-stack.sh` | 本地 / 生产冒烟 |

---

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-22 | 初版：汇总本地修复、登录 P0、PDF 防抖计划、BetterAuth 缺口与实施顺序 |