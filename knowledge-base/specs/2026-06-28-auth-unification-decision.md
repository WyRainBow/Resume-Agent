# 认证系统统一决策：Legacy JWT → BetterAuth 迁移方案

> 日期：2026-06-28
> 分支：`feature/06-23/01`
> 状态：**待 Review**
> 关联：`knowledge-base/specs/2026-06-21-auth-login-module.md`

---

## 背景

项目当前存在两套认证系统并存：

| 系统 | 技术栈 | 标识字段 | 密码限制 | 用户存储 |
|------|--------|---------|---------|---------|
| Legacy JWT | FastAPI `backend/auth.py` + `backend/routes/auth.py` | `username`（任意字符串） | 最少 4 位 | `users` 表（整数 ID，31 条历史用户） |
| BetterAuth | Next.js `web/` + BetterAuth PostgreSQL | `email`（强制邮箱格式） | 最少 8 位（BetterAuth 默认） | BetterAuth `user` 表（字符串 UUID） |

当前混合模式下，Vite 前端的登录入口会跳转到 Next.js `/account` 页面，Google 登录走 BetterAuth OAuth，账号/密码走 Legacy JWT（通过 `auth-panel.tsx` 直接调 FastAPI `/api/auth/login`）。

---

## 核心矛盾

BetterAuth 的 `emailAndPassword` 插件**强制要求 email 格式**，不支持纯用户名注册。这导致无法直接把 Legacy JWT 的"用户名 + 密码"迁移到 BetterAuth 而不改变用户体验。

### 具体冲突点

```
Legacy JWT 注册流程（当前可用）：
  POST /api/auth/register { username: "张三", password: "1234" }
  → User(username="张三", email="张三", password_hash=bcrypt(...))
  → 返回 JWT token

BetterAuth 注册流程：
  signUp.email({ email: "user@example.com", password: "password123" })
  → BetterAuth user 表（email 必须是有效邮箱格式）
  → 返回 session cookie
```

### 受影响的历史用户

`users` 表中约 31 条记录使用 `username` 作为标识，`email` 字段默认等于 `username`（非邮箱格式）。这些用户如果迁移到 BetterAuth，邮箱格式不合法。

---

## 方案对比

### 方案 A：改回邮箱注册，彻底移除 Legacy JWT

**思路**：BetterAuth 已经支持 `emailAndPassword`，直接用它统一所有认证。

| 项 | 说明 |
|----|------|
| 注册字段 | 邮箱 + 密码（不再用纯用户名） |
| 密码限制 | BetterAuth 默认 8 位（可配置降低） |
| 后端改动 | 移除 `backend/routes/auth.py`、`backend/auth.py`；`middleware/auth.py` 仅保留 BetterAuth 验证 |
| 前端改动 | `auth-panel.tsx` 改回 `signIn.email` / `signUp.email`；移除 `AuthModal.tsx` 独立表单 |
| 历史用户 | 需要迁移脚本：把 `users.username` 映射为 `username@resume.local` 伪邮箱，或要求用户重新设置邮箱 |
| 优点 | 认证体系统一，代码大幅简化，BetterAuth 管理密码重置/会话/安全策略 |
| 缺点 | 旧用户名注册的用户需要迁移或重置 |

**迁移脚本草案**：
```python
# 把旧用户迁到 BetterAuth user 表
for user in db.query(User).all():
    fake_email = f"{user.username}@resume.local"
    # 调用 BetterAuth API 或直接写表创建 user + password 映射
    # BetterAuth session 通过 resolve_legacy_user 桥接回整数 ID
```

---

### 方案 B：保留用户名，用伪邮箱绕过

**思路**：前端输入"账号"，后端包装成 `username@resume.local` 存入 BetterAuth。

| 项 | 说明 |
|----|------|
| 注册字段 | 账号 + 密码（UI 不变） |
| 后端改动 | `auth-panel.tsx` 调 BetterAuth `signUp.email`，email 包装为 `username@resume.local` |
| 密码限制 | 可配置 BetterAuth `minPasswordLength: 4` |
| 优点 | 用户体验完全不变 |
| 缺点 | 伪邮箱收不到密码重置邮件；BetterAuth 的邮箱验证功能失效；长期维护成本高 |

**BetterAuth 密码长度配置**：
```typescript
// web/src/lib/auth.ts
emailAndPassword: {
  enabled: true,
  minPasswordLength: 4,  // 可降低
  maxPasswordLength: 128,
},
```

---

### 方案 C（当前）：混合模式，两套并存

**思路**：Google 登录走 BetterAuth，账号/密码走 Legacy JWT，回跳时通过 URL 传递 JWT。

| 项 | 说明 |
|----|------|
| 优点 | 不需要迁移历史用户，两种登录方式独立 |
| 缺点 | 两套认证代码永久维护；`middleware/auth.py` 需同时处理 JWT + BetterAuth；回跳传 token 有安全隐患（URL 泄露） |

---

## 待 Review 决策点

1. **是否强制新用户使用邮箱注册？**
   - 如果是 → 方案 A
   - 如果否 → 方案 B 或 C

2. **31 条历史用户如何处理？**
   - 保留 Legacy 端点仅供旧用户过渡，新用户走 BetterAuth？
   - 写迁移脚本把旧用户搬到 BetterAuth（伪邮箱）？
   - 要求旧用户重新注册？

3. **密码最短长度最终定多少？**
   - 当前 Legacy：4 位
   - BetterAuth 默认：8 位
   - 建议：至少 6 位

4. **Legacy JWT 代码何时可以安全移除？**
   - `backend/auth.py`（JWT 工具）
   - `backend/routes/auth.py`（register/login/me 端点）
   - `frontend/src/services/authService.ts`（login/register/logout）
   - `frontend/src/components/AuthModal.tsx`（独立表单）
   - `frontend/src/contexts/AuthContext.tsx`（双模式初始化逻辑）

---

## 相关文件清单

### BetterAuth 侧（Next.js `web/`）

| 文件 | 职责 |
|------|------|
| `web/src/lib/auth.ts` | BetterAuth 服务端配置（emailAndPassword + Google） |
| `web/src/lib/auth-client.ts` | BetterAuth 客户端（signIn/signUp/useSession） |
| `web/src/components/auth-panel.tsx` | 统一登录 UI（Google + 账号/密码） |
| `web/src/app/account/page.tsx` | `/account` 登录页入口 |
| `web/src/lib/fastapi.ts` | 客户端调 FastAPI 的 fetch 封装 |
| `web/src/lib/fastapi-server.ts` | 服务端 trusted headers 注入 |

### Legacy JWT 侧（FastAPI `backend/`）

| 文件 | 职责 |
|------|------|
| `backend/auth.py` | JWT 生成/验证、bcrypt 密码哈希 |
| `backend/routes/auth.py` | `/api/auth/register`、`/api/auth/login`、`/api/auth/me` |
| `backend/middleware/auth.py` | 统一鉴权（JWT + BetterAuth 双模式） |
| `backend/services/better_auth_users.py` | BetterAuth → Legacy User 桥接 |
| `backend/models.py` | `User` 表定义（username/email/password_hash） |

### 前端 Vite（`frontend/`）

| 文件 | 职责 |
|------|------|
| `frontend/src/contexts/AuthContext.tsx` | 认证状态管理（双模式初始化） |
| `frontend/src/components/AuthModal.tsx` | 登录弹窗（当前为重定向过渡态） |
| `frontend/src/services/authService.ts` | Legacy JWT login/register/getCurrentUser |
| `frontend/src/lib/authHeaders.ts` | 请求头注入（Bearer JWT 或空） |
| `frontend/src/lib/runtimeEnv.ts` | BetterAuth 开关 + 角色读取 |

---

## 推荐路径

**短期（当前）**：方案 C 混合模式已可用，不阻塞业务开发。

**中期推荐**：方案 A——改回邮箱注册，写迁移脚本处理 31 条历史用户，彻底移除 Legacy JWT。理由：
1. BetterAuth 自带密码重置、邮箱验证、会话管理，自维护成本远低于 JWT
2. `middleware/auth.py` 可简化 60%+ 代码（移除 JWT decode 分支）
3. 生产环境安全性更好（不通过 URL 传 token）

---

## 方案 D（推荐落地）：外键关联统一角色表

### 现状数据画像

当前两张 user 表的关联全靠 `email` 字段软关联（`resolve_legacy_user` 按 email 匹配），问题：

| 维度 | BetterAuth `"user"` | Legacy `users` | 关联方式 |
|------|---------------------|----------------|---------|
| 主键 | `text`（UUID 字符串） | `integer`（自增） | 无外键 |
| 字段 | id/email/name/image/createdAt/updatedAt | id/username/email/role/password_hash/pdf_download_count/... | email 软匹配 |
| role | **没有** | 有 | 只在 legacy 表 |
| 数据量 | 8 条 | 37 条 | 仅 1 条重叠（coco yu） |
| 伪邮箱 | — | 3 条 `@better-auth.local` | Google 用户自动创建 |

**核心问题**：legacy `users` 表有 36 条记录无对应 BetterAuth user（含大量 `restored_user_*` 测试数据），role 没有统一归属。

### 设计：`user_profiles` 桥接表 + 外键

不再让 `users` 表独立维护 role，而是建一张 `user_profiles` 表，**外键指向 BetterAuth `"user".id`**，存放所有业务字段：

```sql
CREATE TABLE user_profiles (
    better_auth_user_id  TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    legacy_user_id       INTEGER     UNIQUE,  -- 迁移过渡期保留，最终移除
    role                 VARCHAR(32) NOT NULL DEFAULT 'user',
    api_quota            INTEGER,
    pdf_download_count   INTEGER     NOT NULL DEFAULT 0,
    last_login_ip        VARCHAR(45),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (better_auth_user_id)
);
```

### 架构变化

```
迁移前（当前）：
  BetterAuth "user" (id TEXT, email, name, ...)
         ↕ email 软匹配（无约束）
  legacy users (id INT, email, role, password_hash, ...)
         ↓ FK
  resumes.user_id → users.id
  agent_conversations.user_id → users.id

迁移后：
  BetterAuth "user" (id TEXT, email, name, ...)  ← 唯一身份来源
         ↓ FK (ON DELETE CASCADE)
  user_profiles (better_auth_user_id TEXT PK, role, pdf_quota, ...)
         ↓ FK
  resumes.user_id → users.id（过渡期，最终改为指向 better_auth_user_id）
```

### 迁移步骤

#### Phase 1：建表 + 回填（不破坏现有逻辑）

```sql
-- 1. 创建 user_profiles 表
CREATE TABLE user_profiles (
    better_auth_user_id  TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    legacy_user_id       INTEGER     UNIQUE,
    role                 VARCHAR(32) NOT NULL DEFAULT 'user',
    api_quota            INTEGER,
    pdf_download_count   INTEGER     NOT NULL DEFAULT 0,
    last_login_ip        VARCHAR(45),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (better_auth_user_id)
);

-- 2. 回填：已有关联的 BetterAuth 用户（通过 email JOIN）
INSERT INTO user_profiles (better_auth_user_id, legacy_user_id, role, pdf_download_count, last_login_ip)
SELECT bu.id, u.id, u.role, u.pdf_download_count, u.last_login_ip
FROM "user" bu
JOIN users u ON LOWER(bu.email) = LOWER(u.email);

-- 3. 回填：BetterAuth 用户但无 legacy 记录的（Google 登录自动创建的）
INSERT INTO user_profiles (better_auth_user_id, role)
SELECT bu.id, 'user'
FROM "user" bu
LEFT JOIN user_profiles up ON up.better_auth_user_id = bu.id
WHERE up.better_auth_user_id IS NULL;
```

#### Phase 2：后端代码切换

```python
# backend/middleware/auth.py — 改造前
def get_current_user(...):
    # JWT decode → users 表
    # BetterAuth verify → resolve_legacy_user(users) 按 email 查

# 改造后
def get_current_user(...):
    better_user = await verify_better_auth_token(token)
    # 直接 JOIN user_profiles，不再需要 email 软匹配
    profile = db.query(UserProfile).filter(
        UserProfile.better_auth_user_id == better_user.id
    ).first()
    if not profile:
        profile = create_default_profile(db, better_user)
    return profile
```

#### Phase 3：清理 legacy users 表（可延后）

37 条 legacy 记录中：
- **1 条**（coco yu）有真实 BetterAuth 关联 → 已迁移
- **3 条** Google 用户自动创建的 `@better-auth.local` → 已迁移
- **33 条** 测试/历史数据（`restored_user_*`、`cocoyu`、`lzfan` 等）→ 可保留只读或清理

### 优势对比

| | 方案 C（当前） | 方案 D（外键关联） |
|---|---|---|
| 数据一致性 | email 软匹配，无约束 | 外键强制保证 |
| role 来源 | legacy `users.role` | `user_profiles.role` |
| 删用户 | 需手动删两张表 | CASCADE 自动删除 |
| 查询复杂度 | `WHERE email = ...` + `WHERE username = ...` | `WHERE better_auth_user_id = ...` |
| 测试数据 | 33 条废弃数据混在业务表 | 干净隔离 |
| 迁移风险 | — | Phase 1 不破坏现有逻辑，可灰度 |

### 待确认

1. **`restored_user_*` 的 33 条测试数据是否可以直接清理？** 如果可以，legacy `users` 表从 37 条降到 4 条，迁移更干净。
2. **`resumes.user_id`（外键指向 `users.id`）何时改为指向 `user_profiles.better_auth_user_id`？** 这需要同步迁移 resumes 表的数据，建议 Phase 2 之后单独处理。
3. **`user_profiles` 是否用 SQLAlchemy ORM 定义在 `backend/models.py`？** 建议是，与现有 `User` 模型并存过渡。

---

## 附录 A：数据库真实数据快照（2026-06-28）

### BetterAuth `"user"` 表（8 条）

| id | email | name |
|----|-------|------|
| `Ofw1zEv25h9dMLXkZz1d9GvWK0crsal0` | weiyu9484@gmail.com | coco yu |
| *(其余 7 条为 Google 登录用户)* | | |

> BetterAuth `"user"` 表**没有 role 列**，所有业务字段（role、quota）需桥接到 legacy 表。

### Legacy `users` 表（37 条）分类

| 分类 | 数量 | 示例 | 说明 |
|------|------|------|------|
| 有 BetterAuth 关联 | 1 | `#56 coco-yu (weiyu9484@gmail.com) role=admin` | 唯一一条真实重叠 |
| 伪邮箱 `@better-auth.local` | 3 | `#59 user-1`, `#60 user-1-1`, `#61 user-1-2` | Google 用户自动创建 |
| 纯用户名 JWT 用户 | 2 | `#3 cocoyu role=admin`, `#4 lzfan role=user` | 无邮箱格式 |
| `restored_user_*` 测试数据 | 29 | `#9~#42` 不连续 | 非真实用户 |
| 手机号用户 | 2 | `#55 15267549646`, `#57 1557361279`, `#58 13501539730` | 无邮箱格式 |
| email=NULL | 1 | `#54 admin` | 特殊记录 |

### 当前 email 关联路径

```python
# backend/services/better_auth_users.py — resolve_legacy_user()
# BetterAuth 用户登录后，按 email 软匹配 legacy users 表：
existing = db.query(User).filter(User.email == email).first()
# 如果匹配到 → 返回 legacy User（含 role）
# 如果没匹配到 → 自动创建新 legacy User（role="user"）
```

**问题**：如果用户改了 BetterAuth 邮箱，legacy 表的 email 不会同步，软匹配断裂。

---

## 附录 B：当前认证代码执行路径

### 路径 1：Legacy JWT 登录（账号/密码）

```
Next.js auth-panel.tsx
  → fetch('http://127.0.0.1:9000/api/auth/login', { username, password })
  → FastAPI backend/routes/auth.py:login()
    → users 表 WHERE username=? OR email=?
    → verify_password(plain, hash)  # bcrypt
    → create_access_token()         # python-jose JWT
    → 返回 { access_token, user }
  → 把 token 拼到回跳 URL: ?legacy_token=xxx&legacy_user=xxx
  → window.location.assign(returnTo + token)

Vite frontend
  → AuthContext.init()
  → 从 URL 读 legacy_token → localStorage.setItem('auth_token')
  → 后续请求: Authorization: Bearer <jwt>

FastAPI middleware/auth.py:get_current_user()
  → decode_access_token(jwt) → payload.sub → users 表 WHERE id=?
```

### 路径 2：BetterAuth Google 登录

```
Next.js auth-panel.tsx
  → signIn.social({ provider: "google" })
  → BetterAuth OAuth → session cookie 种到 localhost:3000
  → redirect returnTo (Vite app)

Vite frontend
  → AuthContext.init()
  → fetchBetterAuthSession() → GET localhost:3000/api/auth-bridge/session (cookie)
  → 拿到 BetterAuth user → setUser()
  → fetchLegacyUserInfo() → GET localhost:3000/api/auth/me (经 Next 代理)
    → Next 注入 trusted headers → FastAPI middleware 读 headers
    → resolve_legacy_user() → users 表 WHERE email=?

FastAPI（经 Next 代理的请求）
  → middleware/auth.py:get_current_user()
  → 读 X-Internal-Auth-Secret / X-Better-Auth-User-Id headers
  → resolve_legacy_user(db, better_user)
```

### 路径 3：Vite 前端直接调 FastAPI（不经过 Next 代理）

```
当 VITE_API_VIA_AUTH_WEB=false 时：
  → getAuthHeaders() 从 localStorage 读 auth_token
  → 如果 token === 'better-auth-session' → 返回空 headers（BetterAuth 用户无 JWT）
  → 否则返回 Authorization: Bearer <jwt>
  → BetterAuth 用户在此路径下**无法鉴权**（cookie 只在 localhost:3000 域有效）
```

> **注意**：这是当前的一个潜在问题。BetterAuth 用户如果直连 FastAPI（不经过 Next 代理），没有有效凭证。

---

## 附录 C：`middleware/auth.py` 当前完整逻辑

```python
# backend/middleware/auth.py — get_current_user() 简化版

async def get_current_user(authorization, x_internal_auth_secret,
                           x_better_auth_user_id, x_better_auth_user_email,
                           ..., db):
    # 优先级 1: trusted headers（Next 代理注入）
    if x_internal_auth_secret == FASTAPI_INTERNAL_AUTH_SECRET:
        return resolve_legacy_user(db, BetterAuthUser(id=x_better_auth_user_id, ...))

    # 优先级 2: Bearer token
    token = authorization.split(' ')[1]

    # 尝试 JWT decode
    payload = decode_access_token(token)
    if payload and 'sub' in payload:
        return users 表 WHERE id=payload.sub

    # 尝试 BetterAuth verify
    better_user = await verify_better_auth_token(token)  # HTTP 调 Next
    return resolve_legacy_user(db, better_user)
```

**方案 D 改造后**：

```python
async def get_current_user(authorization, ..., db):
    if x_internal_auth_secret == FASTAPI_INTERNAL_AUTH_SECRET:
        # trusted headers 路径：直接查 user_profiles
        return db.query(UserProfile).filter(
            UserProfile.better_auth_user_id == x_better_auth_user_id
        ).first()

    token = authorization.split(' ')[1]

    # 唯一路径：BetterAuth verify → user_profiles
    better_user = await verify_better_auth_token(token)
    return db.query(UserProfile).filter(
        UserProfile.better_auth_user_id == better_user.id
    ).first()
```

**移除项**：`decode_access_token()`、`resolve_legacy_user()`、JWT 分支、email 软匹配。

---

## 附录 D：Claude Review 指引

请重点 Review 以下问题：

1. **方案 D 的 `user_profiles` 表设计是否合理？**
   - PK 用 `better_auth_user_id TEXT` 是否合适？是否需要加 `legacy_user_id` 做过渡？
   - `ON DELETE CASCADE` 是否安全？删 BetterAuth 用户时级联删 profile 会不会误删？
   - 是否需要把 `role` 独立成 `roles` 表做 RBAC？当前只有 `user/admin/member` 三种。

2. **Phase 2 代码切换的风险**
   - `resolve_legacy_user()` 被 `middleware/auth.py` 和 `routes/better_auth.py` 共用，切换时是否遗漏？
   - `User` 模型（ORM）被 `resumes`、`agent_conversations` 等表 FK 引用，改 PK 类型（INT→TEXT）的影响面？
   - 是否需要保持 `User.id`（INT）不变，只在 `user_profiles` 中做映射？

3. **`resumes.user_id` 外键迁移策略**
   - 当前 `resumes.user_id → users.id`（INT），如果 `users` 表最终废弃，所有引用 `users.id` 的 FK 都要改。
   - 涉及表：`resumes`、`agent_conversations`、`agent_messages`、`api_request_logs`、`resume_embeddings`、`score_results`、`permission_audit_logs`
   - 建议方案：保持 `users.id`（INT）不变，`user_profiles.legacy_user_id` 做桥，逐步废弃而非一刀切。

4. **33 条 `restored_user_*` 数据是否影响迁移？**
   - 这些记录是否有关联的 `resumes` / `agent_conversations` 数据？如果有，删除会级联。
   - 建议迁移前先查 `SELECT count(*) FROM resumes WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'restored_%')`。

5. **BetterAuth `user` 表是否应该加 `role` 列？**
   - 方案 D 是建独立 `user_profiles` 表。另一种做法是直接在 BetterAuth `"user"` 表加 `role` 列。
   - 但 BetterAuth 升级时可能覆盖表结构，自定义列不安全。`user_profiles` 外键关联更稳妥。

---

## 最终执行计划（已确认，简化版）

> 用户决策（2026-06-28）：
> - 不做过渡表，不建 `user_profiles` 桥接
> - 保持现状让用户用 JWT 登录下载 PDF
> - 然后一次性迁移：删旧表 + 建 BetterAuth 新表 + 改邮箱登录

### 整体思路

```
阶段 1（当前，无代码改动）
  └─ 保持现状：JWT + BetterAuth 并存
  └─ 通知旧用户登录并下载简历 PDF
  └─ 确认所有需要保留的用户已迁移

阶段 2（一次性全量迁移）
  ├─ 删除 legacy users 表
  ├─ 创建 BetterAuth 业务扩展表（role、quota 等）
  ├─ 所有认证改为邮箱 + 密码（BetterAuth emailAndPassword）
  ├─ 邮箱注册需通过格式校验
  ├─ 删除 Legacy JWT 全部代码
  └─ 业务表 FK 从 users.id(INT) 改为 better_auth_user_id(TEXT)
```

---

### 阶段 1：保持现状 + 通知用户（无代码改动）

**操作**：
1. 部署当前代码（JWT + BetterAuth 混合模式已可用）
2. 通知旧用户用账号密码登录，下载简历 PDF
3. 设置截止日期（建议 1-2 周）

**导出需通知的旧用户**：
```sql
SELECT username, email FROM users
WHERE email NOT LIKE '%@better-auth.local'
  AND email NOT LIKE 'restored_%'
  AND email IS NOT NULL
  AND email != username;  -- 排除纯用户名
```

**截止后检查**：
```sql
-- 还有多少旧用户未迁移到 BetterAuth
SELECT count(*) FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM "user" bu WHERE LOWER(bu.email) = LOWER(u.email)
);
```

---

### 阶段 2：全量迁移（一次性完成）

#### 2.1 数据库：创建 BetterAuth 业务扩展表

把 legacy `users` 表中的业务字段搬到一个新表，外键关联 BetterAuth `"user".id`：

```sql
CREATE TABLE user_profiles (
    better_auth_user_id  TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role                 VARCHAR(32) NOT NULL DEFAULT 'user',
    api_quota            INTEGER,
    pdf_download_count   INTEGER     NOT NULL DEFAULT 0,
    last_login_ip        VARCHAR(45),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (better_auth_user_id)
);

-- 回填已有 BetterAuth 用户（通过 email JOIN，保留 role 等数据）
INSERT INTO user_profiles (better_auth_user_id, role, pdf_download_count, last_login_ip)
SELECT bu.id,
       COALESCE(u.role, 'user'),
       COALESCE(u.pdf_download_count, 0),
       u.last_login_ip
FROM "user" bu
LEFT JOIN users u ON LOWER(bu.email) = LOWER(u.email);

-- 为没有 profile 的 BetterAuth 用户创建默认 profile
INSERT INTO user_profiles (better_auth_user_id, role)
SELECT bu.id, 'user'
FROM "user" bu
LEFT JOIN user_profiles up ON up.better_auth_user_id = bu.id
WHERE up.better_auth_user_id IS NULL;
```

#### 2.2 数据库：业务表 FK 迁移

```sql
-- 以 resumes 为例，其他表同理
ALTER TABLE resumes ADD COLUMN better_auth_user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE;

UPDATE resumes r
SET better_auth_user_id = up.better_auth_user_id
FROM user_profiles up, users u
WHERE r.user_id = u.id
  AND up.better_auth_user_id IN (
      SELECT bu.id FROM "user" bu WHERE LOWER(bu.email) = LOWER(u.email)
  );

ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_user_id_fkey;
ALTER TABLE resumes ALTER COLUMN better_auth_user_id SET NOT NULL;

-- 需要同样处理的表：
-- agent_conversations, agent_messages, api_request_logs,
-- resume_embeddings, score_results, permission_audit_logs
```

#### 2.3 数据库：删除 legacy users 表

```sql
-- 确认无业务表引用后
DROP TABLE IF EXISTS users CASCADE;
```

#### 2.4 BetterAuth 配置：邮箱校验 + 密码长度

```typescript
// web/src/lib/auth.ts
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,  // 不强制邮件验证（无 SMTP），但做格式校验
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },
  // ... 其余不变
});
```

#### 2.5 登录 UI：邮箱 + 密码（BetterAuth 原生）

```typescript
// web/src/components/auth-panel.tsx
// 改回 BetterAuth 原生 signIn.email / signUp.email
const submitEmail = () => {
  startTransition(async () => {
    const result = mode === "signin"
      ? await signIn.email({ email, password })
      : await signUp.email({ email, password, name: name || email });
    // ...
  });
};
```

邮箱格式校验由 BetterAuth 内置处理，前端补充校验：
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  setMessage("请输入有效的邮箱地址");
  return;
}
```

#### 2.6 后端代码删除清单

| 文件 | 操作 |
|------|------|
| `backend/auth.py` | **删除** |
| `backend/routes/auth.py` | **删除** |
| `backend/services/better_auth_users.py` | **删除** |
| `backend/middleware/auth.py` | **改写**：只保留 BetterAuth verify + user_profiles 查询 |
| `backend/models.py` | **改写**：删除 `User` 模型，新增 `UserProfile` 模型 |
| `backend/services/pdf_download_quota.py` | **改写**：`User` → `UserProfile` |
| `backend/routes/pdf.py` | **改写**：依赖注入改 `UserProfile` |
| `backend/routes/resumes.py` | **改写**：`user.id` → `user_profile.better_auth_user_id` |
| `backend/routes/admin.py` | **改写**：`require_admin_only` 判断 `UserProfile.role` |
| `backend/main.py` | **改写**：移除 `auth_router` |

#### 2.7 前端代码删除清单（Vite）

| 文件 | 操作 |
|------|------|
| `frontend/src/services/authService.ts` | **删除** |
| `frontend/src/components/AuthModal.tsx` | **简化**：只保留 BetterAuth 重定向 |
| `frontend/src/contexts/AuthContext.tsx` | **改写**：移除 JWT 分支 |
| `frontend/src/lib/authHeaders.ts` | **简化**：移除 JWT Bearer 逻辑 |

#### 2.8 `middleware/auth.py` 最终形态

```python
async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_internal_auth_secret: Optional[str] = Header(default=None),
    x_better_auth_user_id: Optional[str] = Header(default=None),
    ...,  # 其他 trusted headers
    db: Session = Depends(get_db),
) -> UserProfile:
    # 优先级 1: trusted headers（Next 代理注入）
    if x_internal_auth_secret:
        internal_secret = os.getenv("FASTAPI_INTERNAL_AUTH_SECRET", "").strip()
        if internal_secret and x_internal_auth_user_id:
            profile = db.query(UserProfile).filter(
                UserProfile.better_auth_user_id == x_better_auth_user_id
            ).first()
            if profile:
                return profile
            return _create_profile(db, x_better_auth_user_id)

    # 优先级 2: Bearer token → BetterAuth verify
    token = authorization.split(" ", 1)[1].strip()
    better_user = await verify_better_auth_token(token)

    profile = db.query(UserProfile).filter(
        UserProfile.better_auth_user_id == better_user.id
    ).first()
    return profile or _create_profile(db, better_user.id)
```

---

### 迁移后验证清单

- [ ] Google 登录 → user_profiles 自动创建 → role=user
- [ ] 邮箱注册 → 邮箱格式校验生效
- [ ] 邮箱注册 → user_profiles 自动创建 → role=user
- [ ] coco yu 登录 → user_profiles.role=admin（已回填）
- [ ] PDF 下载 → 读 UserProfile.pdf_download_count
- [ ] Admin 面板 → UserProfile.role == "admin"
- [ ] 简历保存 → resumes.better_auth_user_id 关联正确
- [ ] Agent 对话 → agent_conversations 关联正确
- [ ] 旧 /api/auth/login → 404
- [ ] 旧 /api/auth/register → 404
- [ ] localStorage 无 auth_token 残留
- [ ] legacy users 表已删除

---

## 任务时间线

| 阶段 | 内容 | 预估 | 状态 |
|------|------|------|------|
| 阶段 1 | 保持现状 + 通知用户下载 PDF | 1-2 周窗口期 | 待执行 |
| 阶段 2 | 全量迁移（删旧表 + 建新表 + 改代码） | 2 天 | 待执行 |
