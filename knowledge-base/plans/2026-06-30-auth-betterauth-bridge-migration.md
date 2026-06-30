# BetterAuth 桥接迁移实施计划（保留 users 表）

> **状态**：待执行　**分支**：`feature/06-30/01`　**日期**：2026-06-30
> **关联设计**：`knowledge-base/specs/2026-06-28-auth-unification-decision.md`
> **执行原则**：每阶段独立可验证、可回滚；阶段 0 全库备份是动手前置条件。

**Goal**：把 Resume-Agent 认证从「JWT + BetterAuth 混合」统一为「纯 BetterAuth 邮箱/Google」，role/quota/pdf 迁到外键关联 BetterAuth 的 `user_profiles` 表，删除 JWT 代码——**不删 `users` 表，不动任何共用业务表**。

**Architecture**：BetterAuth `user`（身份）→ `user_profiles`（业务字段 role/quota/pdf + `legacy_user_id` 桥接）→ `users.id`（保留，34 张共用表继续用）。登录后用 `user_profiles.legacy_user_id` 解析出 `user_id` 读写简历等数据。

**Tech Stack**：FastAPI / SQLAlchemy / PostgreSQL / BetterAuth(Next.js) / React(Vite)

---

## 关键决策（2026-06-30 已确认）

| # | 决策 |
|---|---|
| 数据 | **保留全部数据**，`users` 表**不删**（合同 883 / 知识库 541 / 订单等 34 张表共用） |
| 表结构 | 建独立 `user_profiles`（FK→`"user".id`），含 `legacy_user_id` 桥接列 |
| 字段迁移 | role / api_quota / pdf_download_count / last_login_ip 从 `users` → `user_profiles` |
| 认证 | 纯 BetterAuth：邮箱注册（**无邮件验证**，格式校验即可）+ Google；删 JWT |
| 邮箱 | `requireEmailVerification: false` → 任意合法格式邮箱可注册（`xxx@qq.com` 即可），密码 ≥6 位 |
| 孤儿简历 | `users` 保留 → 简历 `user_id` 不失效、数据不丢；无 BetterAuth 账号的旧用户登录不了，其简历由 **admin（coco yu）后台可见** |
| 执行环境 | 直接在生产做，**阶段 0 必须先 `pg_dump` 全库** |

## 数据现状快照（2026-06-30）

- BetterAuth `"user"`：8（含 coco yu=admin，email 重叠仅此 1 条）
- legacy `users`：38（coco-yu id=56 role=admin）
- resumes：85（user_id=9 唐涛 10 份等大多属无 BetterAuth 账号的旧用户）
- `"user"` 表列：id/name/email/emailVerified/image/createdAt/updatedAt（**无 role**）
- 共用 user_id 的表：34 张（contracts/knowledge_bases/orders/... **本次完全不动**）

---

## 阶段 0：全库备份（动手前置，不可跳过）

- [ ] **0.1** 服务器 `pg_dump` 全库到带时间戳文件

```bash
ssh -i ~/.ssh/resume_deploy -p 2222 root@106.53.113.137 \
  'cd /tmp && PGPASSWORD=$(grep -oP "(?<=:)[^:@]+(?=@)" <<< "$(cd /www/wwwroot/Resume-Agent && venv/bin/python -c "from backend.database import DATABASE_URL;print(DATABASE_URL)")") \
   pg_dump "$(cd /www/wwwroot/Resume-Agent && venv/bin/python -c "from backend.database import DATABASE_URL;print(DATABASE_URL)")" \
   -Fc -f /tmp/resume_db_backup_20260630.dump && ls -lh /tmp/resume_db_backup_20260630.dump'
```

- [ ] **0.2** 备份 scp 下载到本地 `~/Downloads/`（异地留存）

```bash
scp -i ~/.ssh/resume_deploy -P 2222 root@106.53.113.137:/tmp/resume_db_backup_20260630.dump ~/Downloads/
```

- [ ] **0.3** 验证备份可读：`pg_restore --list ~/Downloads/resume_db_backup_20260630.dump | head`

**回滚锚点**：任何后续阶段出问题 → `pg_restore -c -d <db> resume_db_backup_20260630.dump`。

---

## 阶段 1：建 `user_profiles` 表 + 回填（纯加表，不破坏现有逻辑）

**Files**：仅数据库（SQL 通过 `venv/bin/python` + SQLAlchemy text 执行）

- [ ] **1.1** 建表

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
    better_auth_user_id  TEXT        PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    legacy_user_id       INTEGER     UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    role                 VARCHAR(32) NOT NULL DEFAULT 'user',
    api_quota            INTEGER,
    pdf_download_count   INTEGER     NOT NULL DEFAULT 0,
    last_login_ip        VARCHAR(45),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **1.2** 回填：email 能对上的 BetterAuth 用户，带 legacy role/quota/pdf（只有 coco yu 命中）

```sql
INSERT INTO user_profiles (better_auth_user_id, legacy_user_id, role, api_quota, pdf_download_count, last_login_ip)
SELECT bu.id, u.id, COALESCE(u.role,'user'), u.api_quota, COALESCE(u.pdf_download_count,0), u.last_login_ip
FROM "user" bu JOIN users u ON LOWER(bu.email)=LOWER(u.email)
ON CONFLICT (better_auth_user_id) DO NOTHING;
```

- [ ] **1.3** 回填：其余 BetterAuth 用户（无 legacy 对应）建默认 profile

```sql
INSERT INTO user_profiles (better_auth_user_id, role)
SELECT bu.id, 'user' FROM "user" bu
LEFT JOIN user_profiles up ON up.better_auth_user_id = bu.id
WHERE up.better_auth_user_id IS NULL;
```

- [ ] **1.4** 验证：`SELECT count(*) FROM user_profiles`（应=8）；`SELECT * FROM user_profiles WHERE role='admin'`（应含 coco yu）

**回滚**：`DROP TABLE user_profiles;`（不影响任何现有逻辑，因为后端还没读它）。

---

## 阶段 2：后端代码切到 user_profiles（先加新路径，保留旧路径过渡）

**Files**：
- Create：`backend/models.py` 内新增 `UserProfile` ORM（与 `User` 并存）
- Modify：`backend/middleware/auth.py`（190 行，函数 `_load_user_by_id` / `_resolve_trusted_better_auth_user` / `get_current_user` / `require_admin_only` / `require_admin_or_member`）
- Modify：`backend/services/better_auth_users.py`（`resolve_legacy_user`）
- 暂不删：`backend/auth.py` / `backend/routes/auth.py`（阶段 5 再删）

- [ ] **2.1** `models.py` 加 `UserProfile`（执行时对照 `User` 风格，字段同 1.1 建表）。`get_current_user` 返回对象需同时暴露 `role`、`pdf_download_count`、`api_quota` 和 `legacy_user_id`（业务代码用后者当 `user.id` 读简历）。
- [ ] **2.2** `resolve_legacy_user()` 改造：BetterAuth 用户登录 → 先查/建 `user_profiles`；`legacy_user_id` 为空时按 email 找 `users` 命中则关联，否则新建一条 `users` 记录并写回 `user_profiles.legacy_user_id`（保证业务表 user_id 有效）。
- [ ] **2.3** `get_current_user` 改造：trusted headers 路径与 Bearer 路径都最终返回「带 profile 的用户对象」，`role` 取 `user_profiles.role`。**保留** JWT decode 分支（过渡，阶段 5 删）。
- [ ] **2.4** `require_admin_only` / `require_admin_or_member`：判断改为读 `user_profiles.role`。
- [ ] **2.5** 验证：本地起后端 → BetterAuth 登录态请求 `/api/auth/me` 与 `/api/admin/users`，确认 coco yu 仍 admin、role 来自 user_profiles。

**回滚**：git revert 本阶段提交；`user_profiles` 表保留无害。

---

## 阶段 3：PDF 额度 / 简历归属读 profile

**Files**：
- Modify：`backend/services/pdf_download_quota.py`（pdf_download_count 读写改 `user_profiles`）
- Modify：`backend/routes/pdf.py`、`backend/routes/resumes.py`（`user.id` → `user.legacy_user_id` 读写简历）
- Modify：`backend/routes/admin.py`（`/api/admin/users` 列表 JOIN user_profiles 显示 role）

- [ ] **3.1** `pdf_download_quota.py`：计数/上限改 `UserProfile.pdf_download_count` / `api_quota`。
- [ ] **3.2** 简历读写：确认所有 `current_user.id` 用作 `resumes.user_id` 的点改成 `current_user.legacy_user_id`。`rg "current_user.id" backend/routes` 逐点核对。
- [ ] **3.3** 孤儿简历归 admin：admin 后台简历视图不按 user_id 过滤（admin 可见全部 85 份）。
- [ ] **3.4** 验证：PDF 下载计数 +1 落到 user_profiles；简历列表正确；admin 能看全部。

**回滚**：git revert。

---

## 阶段 4：BetterAuth 邮箱注册 + 登录 UI

**Files**：
- Modify：`web/src/lib/auth.ts`
- Modify：`web/src/components/auth-panel.tsx`

> ⚠️ `web/AGENTS.md`：这是改过的 Next.js，写代码前读 `web/node_modules/next/dist/docs/` 对应指南。

- [ ] **4.1** `auth.ts` 的 `emailAndPassword` 加配置：

```typescript
emailAndPassword: {
  enabled: true,
  requireEmailVerification: false,
  minPasswordLength: 6,
  maxPasswordLength: 128,
},
```

- [ ] **4.2** `auth-panel.tsx`：账号/密码表单改为 BetterAuth 原生 `signUp.email` / `signIn.email`（移除直调 FastAPI `/api/auth/login` 的 legacy 分支），前端补邮箱格式校验 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`。
- [ ] **4.3** 验证：本地 web 用 `aaa@qq.com` / 6 位密码注册成功 → BetterAuth `"user"` 新增 → user_profiles 自动建 → 登录进 Vite 前端。

**回滚**：git revert（auth.ts 配置回退即恢复）。

---

## 阶段 5：删除 JWT 代码（确认阶段 2-4 稳定后）

**Files**（删除 / 简化）：
- Delete：`backend/auth.py`、`backend/routes/auth.py`、`frontend/src/services/authService.ts`
- Modify：`backend/main.py`（移除 auth_router 注册）
- Modify：`backend/middleware/auth.py`（删 JWT decode 分支 + `_load_user_by_id` 的 JWT 路径）
- Modify：`frontend/src/contexts/AuthContext.tsx`（移除 JWT 初始化分支）
- Modify：`frontend/src/lib/authHeaders.ts`（移除 Bearer JWT 逻辑）
- Modify：`frontend/src/components/AuthModal.tsx`（仅保留 BetterAuth 重定向）

- [ ] **5.1** 后端删 auth.py / routes/auth.py，main.py 去注册，middleware 去 JWT 分支。
- [ ] **5.2** 前端删 authService.ts，AuthContext/authHeaders/AuthModal 去 JWT。
- [ ] **5.3** `rg "auth_token|authService|decode_access_token|create_access_token" frontend/src backend` 确认无残留引用。
- [ ] **5.4** 验证：`/api/auth/login`、`/api/auth/register` → 404；前端 build 通过；登录全程仅 BetterAuth。

**回滚**：git revert 本阶段（删除是 git 跟踪的，可恢复）。

---

## 阶段 6：迁移后验证清单

- [ ] Google 登录 → user_profiles 自动建 → role=user
- [ ] 邮箱注册（`xxx@qq.com` / 6 位）→ 格式校验生效 → user_profiles 自动建
- [ ] coco yu 登录 → role=admin（profile 回填）→ 进 /admin
- [ ] PDF 下载 → user_profiles.pdf_download_count +1
- [ ] 简历列表/保存正确（经 legacy_user_id）
- [ ] admin 后台可见全部 85 份简历
- [ ] `users` 表与 34 张共用业务表数据量不变（contracts 仍 883 等）
- [ ] 旧 `/api/auth/login|register` → 404；localStorage 无 auth_token
- [ ] 前端 `npm run build` 通过；后端目标 pytest 通过

---

## 执行顺序与提交节奏

每阶段独立提交（c2 工程作者），阶段间在本地/远程验证通过再进下一阶段：
`0 备份 → 1 建表回填 → 2 中间件 → 3 业务读 profile → 4 邮箱登录 → 5 删 JWT → 6 验证`

**生产策略**：阶段 1（建表回填）幂等、纯加表，可直接生产执行；阶段 2-5 代码改动先本地连生产库验证（或本地库灰度），通过后合 main 由 cron 部署。每阶段 git 可回滚 + 阶段 0 全库 dump 兜底。
