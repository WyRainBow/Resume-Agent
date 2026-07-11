# 接入「QQ 邮箱验证码登录」— 技术方案设计

- 日期：2026-07-11
- 分支：`feature/wy/20260711/01`（承接 commit `ee974a2f`「移除 AI 发邮件功能」清理，该清理特意保留了 SMTP 底层与邮箱校验正则给本次用）
- 发起人：产品
- 性质：只读调研 + 方案设计（本文档是唯一产出，未改动任何源码，未 commit）
- 需求界定：**邮箱验证码登录**——用户输入邮箱 → 系统发一封带验证码的邮件 → 用户回填验证码完成登录/注册。**不是** OAuth 第三方登录，**不是**「用户绑定自己的发信授权码」。
- 交付要求（遵循本仓库 CLAUDE.md §4.0 brainstorming）：探清现状 → 给 2-3 个方案 → 关键决策点留给用户拍板，不擅自定死强推。

---

## 0. 结论速览（先读）

- 当前是**「用户名 + 密码」体系**（legacy JWT），且并行还挂着一套 **BetterAuth**（Next.js auth-web，cookie session + trusted headers）。
- `User.email` 字段虽然存在且 `unique NOT NULL`，但**注册时被写成了 `email = username`**（见 `backend/routes/auth.py` L82），所以 email 列现在装的**不是真实邮箱**。这是本次整合最大的坑（见 §2.3）。
- `email_sender.py` 的 `send_resume_email(...)` **强制带 PDF 附件、且每次调用要传发件人自己的授权码**，直接拿来发验证码文本邮件**不顺手**，建议做一次小重构抽出通用发信函数（见 §3）。
- `email_validation.py` 的 `EMAIL_RE` / `QQ_EMAIL_RE` **拿来即用、无需改**。
- Redis **不是本仓库的运行时依赖**（`requirements.txt` 无 redis，仅 agent 内有一个 optional import 的 fallback 存储类，未启用）。所以引入 Redis = 新增中间件 = 对当前单实例部署而言偏「过度设计」（见 §4.1）。
- 两个最需要用户拍板的决策点：**① 验证码存哪（内存 / DB / Redis）**、**② 和现有账号体系怎么整合（首次验证即注册 / 必须先有账号 / 新建轻量账号）**。见 §7 决策留痕表。

---

## 1. 现有登录系统现状

### 1.1 后端登录/注册接口 — `backend/routes/auth.py`
- 前缀 `/api/auth`，三个端点：`POST /register`、`POST /login`、`GET /me`。
- 请求体 `RegisterRequest` / `LoginRequest` 都是 `{username, password}`，**没有邮箱字段、没有验证码字段**。
- 注册逻辑（L46-136）：校验 username（≥2 位）、password（≥4 位）→ 查重 username → `hash_password` → **`User(username=username, email=username, password_hash=...)`** → 存库 → 签 JWT。
  - 注意 L81-82 注释「email 字段保留兼容：默认与 username 相同」——**email 列被塞进了 username 的值**。
- 登录逻辑（L149-226）：入参名义叫 `username` 但**已经兼容邮箱形态**——L169 `if "@" in login_identifier:` 优先按 `User.email` 查，否则按 `User.username` 查（带一次 DB 断连重试）→ `verify_password` → 记录 `last_login_ip` → 签 JWT。
  - 也就是说「按邮箱查用户」这条路**后端已经通了**，缺的是「邮箱里存的是真实邮箱」+「验证码校验」这两块。

### 1.2 JWT 签发/校验 — `backend/auth.py` + `backend/middleware/auth.py`
- `backend/auth.py`：`hash_password`/`verify_password`（passlib bcrypt，失败降级 pbkdf2）、`create_access_token`（HS256，默认 168h 过期）、`decode_access_token`。验证码登录成功后**复用 `create_access_token` 即可**，签发逻辑无需改。
- `backend/middleware/auth.py` `get_current_user`：三条认证来源——① trusted headers（BetterAuth 经内部密钥透传）② JWT Bearer ③ BetterAuth Bearer token。验证码登录走**①/②里的 JWT 这条**，与现有链路完全一致，中间件不用动。

### 1.3 User 模型 — `backend/models.py` L111-135
| 字段 | 定义 | 对本次的意义 |
|---|---|---|
| `username` | `String(255) unique NOT NULL index` | 现主登录标识 |
| `email` | `String(255) **unique NOT NULL** index` | 关键：唯一且非空，但当前存的是 username 值 |
| `password_hash` | `String(255) NOT NULL` | 验证码登录的新账号**没有密码**，与 NOT NULL 冲突（见 §2.3） |
| `role` / `api_quota` / `last_login_ip` / `pdf_download_count` | 管理字段 | 新账号需给默认值 |

- 另有 `BetterAuthEntitlement`（BetterAuth 用户的权益表，email 可空）——说明系统里「邮箱」概念已存在于 BetterAuth 侧。

### 1.4 前端登录 UI 与状态 — `AuthContext.tsx` / `authService.ts`
- `authService.ts`：`register(username,password)` / `login(username,password)` / `getCurrentUser()`，axios 打 `/api/auth/*`，`setAuthToken` 挂 `Authorization: Bearer`。**没有任何验证码相关方法**。
- `AuthContext.tsx`：`login/register` 只接受 `(username, password)`；`localStorage` 存 `auth_token`/`auth_user`；**当 `isAuthWebEnabled()` 为真时，`openModal` 直接重定向到 Next.js auth-web**，legacy 弹窗（`AuthModal.tsx`）只在未启用 auth-web 时用。
  - 含义：加「验证码登录」要考虑**它落在 legacy 弹窗侧还是 BetterAuth/auth-web 侧**。本方案默认落在 **legacy `/api/auth` 侧**（改动集中、与现有 JWT 链路一致），但若产品统一入口是 auth-web，则需在 Next.js 侧另做（超出本仓库范围，见 §6 备注）。

### 1.5 现状判定
- **本质是「用户名 + 密码」体系**，email 列目前是「username 的镜像」而非真实邮箱。
- 登录查询已兼容邮箱形态，但没有真实邮箱数据、也没有验证码通道。
- 所以「邮箱验证码登录」**不是纯新增一条旁路**，而是**要和 email 列的语义、以及 password_hash NOT NULL 约束做整合**——这正是 §2.3 和决策点②的核心。

---

## 2. 关键整合陷阱（先读，避免方案落地翻车）

### 2.1 email 列现在装的是 username，不是真实邮箱
注册 `email=username`，导致：若引入验证码登录并把「真实邮箱」也写进 `email` 列，会和「老用户 email=某个 username 字符串」抢 `unique` 约束。需要决定：真实邮箱存 `email` 列（复用唯一约束，但要清洗/迁移老数据），还是**新增独立列/独立表**存验证码登录的真实邮箱。

### 2.2 `password_hash` NOT NULL 与「无密码的验证码账号」冲突
若「首次验证即注册」创建只有邮箱的轻量账号，该账号**没有密码**，但 `password_hash` 是 `NOT NULL`。三种解法：给验证码账号写一个随机不可用的 hash 占位 / 把 `password_hash` 改 nullable（需迁移）/ 强制验证码账号也设初始密码（体验差）。推荐随决策点②一起定。

### 2.3 username 唯一约束与「只有邮箱的账号」
`username` 也是 `unique NOT NULL`。轻量账号得给 username 一个值（如取邮箱 `@` 前缀，冲突则加随机后缀，或直接用完整邮箱当 username）。

> 这三条都指向同一个根因：**现有表结构是为「用户名+密码」设计的，验证码登录要么迁就它（塞占位值），要么给它松绑（改 nullable / 加列 / 加表）**。这决定了要不要出数据库迁移，见 §6。

---

## 3. `email_sender.py` / `email_validation.py` 复用评估

### 3.1 `backend/services/email_sender.py` — 需小重构
现签名：
```python
def send_resume_email(from_email, auth_code, to_email, subject, body, pdf_bytes, filename) -> None
```
- **可复用的核心**：`smtplib.SMTP_SSL("smtp.qq.com", 465)` + `server.login` + `sendmail` 这套 QQ SSL 发信底座**完全可用**。
- **不顺手的点**：
  1. **强制带 PDF 附件**（`pdf_bytes`/`filename` 是必填位置参数，函数体无条件 `msg.attach(attachment)`）。发验证码是纯文本邮件，硬塞会带一个空 PDF 附件，很怪。
  2. **每次调用要传 `from_email` + `auth_code`**（原设计是「用发件人自己的 QQ 授权码发简历」）。验证码登录应由**一个系统级固定发件账号**发出，凭证该从环境变量读，而不是每次调用传参。
- **建议**：小重构，抽一层通用发信 —— 新增
  ```python
  def send_email(to_email, subject, body, *, attachment: tuple[bytes,str] | None = None) -> None
  ```
  内部从 `os.getenv("SMTP_SENDER_EMAIL")` / `os.getenv("SMTP_AUTH_CODE")` 读系统发件凭证，`attachment=None` 时不 attach。原 `send_resume_email` 可保留或改为调用 `send_email(..., attachment=(pdf_bytes, filename))`。改动量小（约 15 行），不引入新依赖。
- 结论：**能复用底层，但需要一个 15 行级别的小重构**，不是「直接调用即可」。

### 3.2 `backend/utils/email_validation.py` — 拿来即用
```python
EMAIL_RE      # 宽松通用邮箱
QQ_EMAIL_RE   # ^...@(qq\.com|foxmail\.com)$
```
- 校验用户输入邮箱格式**直接调用即可，零改动**。
- 决策点：产品说「QQ 邮箱登录」——若严格只收 QQ/Foxmail 用 `QQ_EMAIL_RE`；若想留口子收任意邮箱用 `EMAIL_RE`。建议**先 `QQ_EMAIL_RE` 收严**（契合需求 + 降低被滥用面），未来放开只改一行。

---

## 4. 技术方案对比（每个决策点给 2-3 个选项）

### 4.1 决策点①：验证码存储方式

| 方案 | 做法 | 优点 | 缺点 | 适用 |
|---|---|---|---|---|
| **A. 纯内存字典** | 进程内 `dict[email] = (code, expire_at, attempts)` + 简单锁 | 零依赖、零迁移、实现最快 | 进程重启丢失；**多实例/多 worker 不共享**（uvicorn 多 worker 直接失效）；需自己写过期清理 | 单实例单 worker 的 MVP / 内部灰度 |
| **B. 数据库表**（推荐默认） | 新增 `email_verification_codes` 表存 code_hash + expire_at + attempts + ip | 不引入新中间件；天然多实例共享；可审计/限频统计；重启不丢 | 要出一支 alembic 迁移；要处理过期清理（定时任务或查询时惰性删）；比内存多一次 DB 往返 | 与本仓库现状最贴合（已有 alembic + DB） |
| **C. Redis** | `SETEX code:{email} 300 <code>` | 业界标准；TTL 自动过期免清理；限频/计数原生支持；多实例天然共享 | **本仓库当前无 Redis**（requirements 无、未部署），引入 = 新增运维中间件；对现单实例部署属过度设计 | 未来确定要多实例 / 高并发 / 已有 Redis 时 |

- **倾向**：若近期是单实例，A 够用但有多 worker 隐患；**B（DB 表）综合最稳且不增运维**，是本仓库现状下的推荐默认；C 待有 Redis 需求再上。**此点必须用户拍板**（尤其是否已计划上 Redis / 多实例）。
- 无论哪种，**验证码入库/入存都应存 hash 而非明文**（防存储侧泄露）。

### 4.2 决策点②：与现有账号体系的整合方式

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A. 首次验证即注册**（多数产品做法，推荐候选） | 输入邮箱→发码→校验通过：若该邮箱无账号则**自动建号**（轻量账号，无密码），有则直接登录 | 用户零门槛、体验最顺；一个端点搞定登录+注册 | 撞 §2.2 password_hash NOT NULL、§2.3 username 唯一：需给占位值或改表；要防「验证码轰炸即建号」刷库 |
| **B. 必须先有账号，验证码只是登录手段之一** | 只有已存在（且已绑定真实邮箱）的账号能用验证码登录，否则提示先注册 | 不产生垃圾账号；与现有「用户名+密码」账号一一对应；改表最小 | 需要老用户先「绑定真实邮箱」的迁移路径（当前 email=username 不是真邮箱）；新用户仍得先走密码注册，体验割裂 |
| **C. 新建独立的「邮箱账号」体系** | 验证码登录建的是一类只有 email 的新账号，与 username 账号并存不合并 | 隔离清晰、改动集中 | 同一个人可能有两个账号（密码账号 + 邮箱账号）无法合并，长期账号体系分裂，最不推荐 |

- **核心纠结点**：同一个邮箱，既能密码登录又能验证码登录时**要不要合并成同一账号**。
  - 选 A/B 倾向「合并」（同邮箱=同账号）；选 C 是「不合并」。
- **倾向**：**A（首次验证即注册）** 体验最好、最符合「QQ 邮箱登录」的产品直觉，代价是要处理 §2.2/§2.3 的表约束（推荐配合决策点①-B 的表方案，并把 `password_hash` 改 nullable 或写占位 hash）。**此点必须用户拍板**。

### 4.3 决策点③：安全设计（建议值，可微调）

| 项 | 建议 | 理由 |
|---|---|---|
| 验证码有效期 | **5 分钟**（300s） | 行业惯例，够用户切到邮箱回填，又不给暴力破解太多窗口 |
| 验证码长度/复杂度 | **6 位纯数字** | 邮箱验证码惯例；配合有效期+失败次数限制，6 位数字熵足够 |
| 发送频率限制（防邮件轰炸他人） | **同一邮箱 60s 内只能发 1 次**、**单邮箱每日 ≤ 5~10 次**、**同一 IP 每小时 ≤ N 次** | 邮箱验证码最大风险是被当「免费邮件轰炸机」轰炸受害者邮箱，必须按邮箱+IP 双维度限频（`login` 已有 `_client_ip` 取 IP 的现成工具可复用） |
| 失败重试次数 | **同一验证码错 5 次即作废**，需重新发 | 防在线暴力破解 6 位码 |
| 验证码一次性 | 校验成功后立即失效；新码发出后旧码作废 | 防重放 |
| 存储 | 存 **hash**，不存明文 | 防存储侧泄露 |
| 枚举防护 | 「邮箱不存在」与「已发送」返回**统一话术**（若走 B 方案需权衡；A 方案天然无此问题） | 防邮箱是否注册被枚举 |

### 4.4 决策点④：前端交互形态

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A. 登录页加「验证码登录」Tab**（推荐） | `AuthModal` 里「密码登录 / 验证码登录」两个 tab，验证码 tab = 邮箱输入框 + 「获取验证码」按钮（60s 倒计时重发）+ 验证码输入框 | 入口清晰、主流；和 A 方案「首次验证即注册」天然契合 | 弹窗要改；若统一入口在 auth-web 则需在 Next.js 侧做（见 §6） |
| **B. 只在「忘记密码/找回」场景用** | 不做独立登录方式，仅作为找回密码/验证身份的一环 | 改动最小 | 不满足「邮箱验证码**登录**」的原始需求，基本偏题 |

- 通用交互细节（无论 A/B）：**60s 倒计时重发按钮**（倒计时中禁用）、发送后 toast「验证码已发送至 xxx@qq.com」、验证码输入框自动聚焦、错误明确回显剩余次数。
- **倾向**：**A（登录页加 Tab）**。此点用户拍板前需先确认前端入口是 legacy 弹窗还是 auth-web（决定改哪一侧）。

---

## 5. 端到端流程（以推荐组合「决策①-B 表 + 决策②-A 首次验证即注册」为例）

1. 用户在验证码 tab 输入 QQ 邮箱 → 点「获取验证码」。
2. 前端 `POST /api/auth/email-code/send { email }`。
3. 后端：`QQ_EMAIL_RE` 校验格式 → 按邮箱+IP 查限频（60s / 每日上限）→ 生成 6 位码 → 存 `email_verification_codes`（存 hash + expire_at=now+5min + attempts=0 + ip）→ 调 `email_sender.send_email(email, "登录验证码", body)` 发信 → 返回统一成功话术。
4. 用户回填验证码 → 前端 `POST /api/auth/email-code/verify { email, code }`。
5. 后端：查该邮箱最新未过期码 → 比对 hash（错则 attempts+1，≥5 作废）→ 通过后：查 `User.email==email`，无则**自动建号**（username=邮箱前缀去重，password_hash=占位/nullable，email=真实邮箱，role="user"）→ 作废该码 → `create_access_token` 签 JWT → 返回 `TokenResponse`（复用现有结构）。
6. 前端拿到和密码登录**完全一样**的 `TokenResponse`，走现有 `AuthContext.login` 后续（存 localStorage、setAuthToken、延迟 sync），零差异。

---

## 6. 对本仓库的具体落地建议（结合现状，非通用八股）

> 以下按「推荐组合」列出；换其他决策组合时，差异见备注。

### 6.1 后端新增/修改文件
- **改** `backend/services/email_sender.py`：抽出通用 `send_email(to_email, subject, body, *, attachment=None)`，从 env 读 `SMTP_SENDER_EMAIL`/`SMTP_AUTH_CODE`（约 15 行，§3.1）。
- **新增** `backend/services/verification_code.py`（若走决策①-A 内存）或直接在路由内操作表（决策①-B）：封装「生成/存储/校验/限频」逻辑，集中安全策略（§4.3）。
- **改** `backend/routes/auth.py`：新增两个端点
  - `POST /api/auth/email-code/send`：入参 `{email}`，校验+限频+发码。
  - `POST /api/auth/email-code/verify`：入参 `{email, code}`，校验+（按决策②）建号/登录，返回现有 `TokenResponse`。
  - 复用现有 `create_access_token`、`_client_ip`、`UserResponse`/`TokenResponse`。
- **复用** `backend/utils/email_validation.py`：`QQ_EMAIL_RE`（零改动）。
- **JWT / 中间件**：`backend/auth.py`、`backend/middleware/auth.py` **无需改**（签发/校验完全复用）。

### 6.2 数据库迁移
- **决策①-B（表方案，推荐）**：新增 `backend/alembic/versions/019_add_email_verification_codes.py`（`revision="019"`, `down_revision="018"`），建表 `email_verification_codes`（`id, email(index), code_hash, expire_at, attempts, ip, created_at`）。迁移文件格式照抄 016 的模板（`op.create_table` + `op.create_index`）。
- **决策②-A（首次验证即注册）连带**：`password_hash` 与「无密码账号」冲突（§2.2）。二选一：
  - 给验证码账号写**随机占位 hash**（`hash_password(secrets.token_urlsafe())`）——**零迁移**，最省事，推荐。
  - 或新增 `020` 迁移把 `users.password_hash` 改 `nullable=True`（更干净但要动主表，谨慎）。
- **决策①-A（内存方案）**：**不需要任何迁移**。

### 6.3 API 端点设计（汇总）
| 方法 | 路径 | 入参 | 出参 | 说明 |
|---|---|---|---|---|
| POST | `/api/auth/email-code/send` | `{email}` | `{sent: true}`（统一话术） | 校验格式+限频+发码 |
| POST | `/api/auth/email-code/verify` | `{email, code}` | `TokenResponse`（复用） | 校验+登录/建号+签 JWT |

### 6.4 前端新增/修改
- **改** `frontend/src/services/authService.ts`：加 `sendEmailCode(email)` / `loginByEmailCode(email, code)` 两个方法（照 `login`/`register` 的 axios + `buildAuthError` 模式）。
- **改** `frontend/src/contexts/AuthContext.tsx`：加 `loginByEmailCode`，成功后复用现有 `login` 的落库逻辑（存 token/user、setAuthToken、延迟 sync）。
- **改** `frontend/src/components/AuthModal.tsx`：加「验证码登录」tab + 60s 倒计时重发按钮（§4.4）。
- **前置确认**：若 `isAuthWebEnabled()` 生产为真，登录入口在 Next.js auth-web，则上述前端改动**不在本仓库**，需在 auth-web 侧另做；本仓库后端端点仍可复用。**这点要先跟用户确认部署形态。**

### 6.5 配置/环境变量
- 新增 env：`SMTP_SENDER_EMAIL`（系统发件 QQ 邮箱）、`SMTP_AUTH_CODE`（其授权码）。放 `.env`，`email_sender.py` 读取。
- 可选：验证码有效期、限频阈值做成 env 便于调参。

---

## 7. 决策留痕表（关键项留给用户拍板，本方案不擅自定死）

| 决策点 | 选项 | 本方案倾向 | 用户最终决策 | 理由/备注 |
|---|---|---|---|---|
| **① 验证码存储** | A 内存 / B DB表 / C Redis | **B（DB表）** —— 单实例现状下不增运维、天然多实例安全 | _（待拍板）_ | 关键看：近期是否单实例？是否已计划上 Redis/多实例？ |
| **② 账号整合** | A 首次验证即注册 / B 必须先有账号 / C 独立邮箱账号 | **A** —— 体验最顺、契合「QQ 邮箱登录」直觉 | _（待拍板）_ | 关键看：同邮箱要不要合并密码账号与验证码账号？（A/B=合并，C=不合并） |
| ③ 邮箱范围 | `QQ_EMAIL_RE` 严格 / `EMAIL_RE` 宽松 | QQ_EMAIL_RE 收严 | _（待拍板）_ | 未来放开只改一行 |
| ③ 有效期/长度/限频/重试 | 见 §4.3 | 5min / 6位数字 / 60s+每日上限+IP限 / 错5次作废 | _（待拍板）_ | 建议值，可微调 |
| ④ 前端形态 | A 登录页加Tab / B 仅找回密码 | A（加Tab）+ 60s倒计时重发 | _（待拍板）_ | 先确认入口是 legacy 弹窗还是 auth-web |
| 无密码账号如何满足 password_hash NOT NULL | 占位随机hash / 改列nullable / 强制设密码 | **占位随机hash（零迁移）** | _（待拍板）_ | 仅当决策②=A/C 时需要 |
| email_sender 是否重构 | 抽通用 `send_email` / 硬用 `send_resume_email` | 抽通用（约15行） | _（待拍板）_ | 硬用会带空PDF附件 |
| 部署形态 | 单实例 / 多实例·多worker | —— | _（待拍板）_ | 直接决定①能否选内存 |

---

## 8. 一句话总结
后端签发/校验/邮箱查询/SMTP 底座/邮箱校验正则**都已就位或可小改复用**，本次真正的工作量集中在 **①验证码存储怎么选** 和 **②怎么和「email 列现装 username、password_hash 非空」的现有表结构整合**——这两点是必须用户拍板的岔路口，其余（安全参数、前端 Tab）按 §4.3/§4.4 建议值落地即可。
