# Coco 对话内接入 QQ 邮箱发送简历 —— 设计方案

- 日期：2026-07-09
- 状态：待用户审阅
- 关联分支：待创建（建议 `feature/coco-email-send`）

## 1. 背景与目标

用户希望在 Coco 的 AI 对话里，能直接说"把简历发到 xxx@qq.com"，由 Coco 把当前简历生成 PDF 并通过用户自己的 QQ 邮箱账号发送出去。

参考交互形态是 Manus 式的"Connect an app"：输入框旁一个入口图标，点开是可连接应用的列表，每个应用有 Connected / Not connected 状态和 Connect / Disconnect 按钮，另有一个更完整的 Settings → Connections 页面。

三张参考图见 `assets/2026-07-09-qq邮箱接入参考/`：

1. `01-composer输入框图标.png` — 输入框工具栏右侧的 "+12" 快捷图标，旁边有"Connected: GitHub"标识
2. `02-connect-an-app弹窗.png` — 点开图标后的弹窗，网格列出所有可连接应用（Gmail、Slack、Notion...），每个卡片右侧是 Connect/Disconnect 按钮
3. `03-connections设置页.png` — Settings 侧边栏里的完整"Connections"页面，同样是应用列表 + 状态 + 按钮，是弹窗"more"之后的完整版

**当前项目的范围裁剪**：我们只有"邮箱（QQ邮箱）"一种可连接应用，不需要网格 + 完整设置页两级结构，做成一级的轻量弹窗即可——点开图标直接是"邮箱"这一行的连接状态和操作，不需要单独的 Connections 设置页。

**权限范围**：这是"管理员摸鱼工具"，不面向普通用户。入口图标、弹窗、后端路由、Agent 工具全部只对 `role=admin` 生效。

## 2. 前端设计

### 2.1 入口位置

在 `frontend/src/components/agent-chat/Composer.tsx` 现有底部工具栏（第 138~172 行，`Plus` 附件按钮和"展示简历"按钮所在的 `flex items-center gap-2` 容器）里，新增一个图标按钮，仅管理员可见（`canUseAdminFeature()` 判断，包裹整个按钮，非管理员该按钮和后面的弹窗逻辑都不渲染）。

- 图标：`Mail`（lucide-react），视觉上完全复用现有 `Plus` 按钮的 class（`size-8 rounded-none border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px]` 等），保持新野兽派风格一致
- 按钮上叠加一个小圆点角标表示"已连接"状态（邮箱凭证已配置时显示，未配置不显示），复用参考图 1 里"Connected: ✓"的意图，但做成按钮角标而不是文字

### 2.2 弹窗内容（新增组件 `EmailConnectPanel.tsx`）

点击图标，用 `PortalDropdown.tsx` 同款 `createPortal` 弹层样式（`border-2 border-black shadow-[3px_3px_0px_0px_#000000] rounded-none bg-white`）弹出一个面板，仅一行内容：

```
┌─────────────────────────────────┐
│  邮箱          [●已连接 / 未连接] │
│  xxx@qq.com                      │
│                    [断开] / [连接]│
└─────────────────────────────────┘
```

- 未连接：点击"连接"在面板内展开成表单（QQ 邮箱地址 + 授权码两个输入框 + 一行"如何获取 QQ 邮箱授权码"的说明链接 + 保存按钮）
- 已连接：显示脱敏后的邮箱地址（如 `xxx***@qq.com`），提供"断开"按钮（调用 DELETE 接口清除凭证）
- 保存/断开成功后面板内状态即时刷新，不需要额外弹 toast（沿用项目里其它表单的即时反馈风格）

### 2.3 组件与状态

- 新建 `frontend/src/services/emailCredentialService.ts`：封装 `GET/PUT/DELETE /api/email/credential` 三个请求
- `EmailConnectPanel` 内部用 `useState` 管理 表单展开/收起、加载态、错误提示，模式与现有 `ModelSelector.tsx` 对 `PortalDropdown` 的封装方式一致

## 3. 后端设计

### 3.1 凭证存储

新表 `email_credentials`：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | Integer PK | |
| user_id | Integer FK → users.id，唯一 | 一人一份凭证 |
| email_address | String(255) | QQ 邮箱地址 |
| encrypted_auth_code | String(512) | Fernet 加密后的授权码 |
| created_at / updated_at | DateTime | |

新增 alembic migration。

新增 `backend/utils/crypto.py`：

```python
from cryptography.fernet import Fernet
# 密钥来自环境变量 EMAIL_CREDENTIAL_ENC_KEY（新增，.env 补充说明，不落到日志里）
def encrypt_secret(plain: str) -> str: ...
def decrypt_secret(token: str) -> str: ...
```

`python-jose[cryptography]` 已经依赖 `cryptography`，不需要新增 pip 包。

新路由 `backend/routes/email_credential.py`：

- `GET /api/email/credential` → 仅管理员；返回 `{configured: bool, masked_email: str | null}`，从不回传解密后的授权码
- `PUT /api/email/credential` → 仅管理员；body 为 `{email_address, auth_code}`，加密后 upsert
- `DELETE /api/email/credential` → 仅管理员；删除该用户的凭证行

三个路由都在 `backend/main.py` 里像其它 `routes/*.py` 一样注册；权限校验复用现有 `get_current_user` + 角色判断（参照 `backend/agent/web/routes/stream.py` 里已有的 `_is_admin(user)` 写法）。

### 3.2 发信能力

新增 `backend/services/email_sender.py`：

```python
def send_resume_email(from_email: str, auth_code: str, to_email: str,
                       subject: str, body: str, pdf_bytes: bytes, filename: str) -> None:
    # smtplib.SMTP_SSL("smtp.qq.com", 465)，login(from_email, auth_code)，发送带附件邮件
    # 认证失败 / 连接失败都要抛出明确异常，不吞
```

### 3.3 Agent 工具：`send_resume_email`

新增 `backend/agent/tool/send_resume_email_tool.py`：

- 参数：`to_email`（必填）、`subject`（可选）、`message`（可选留言）、`confirm`（bool，默认 `false`）
- **确认发送流程**（和现有 `ask_human` 一样走"非阻塞、靠对话轮次确认"）：
  1. 第一次调用（`confirm` 缺省 `false`）→ 不发送，只返回确认文案："即将发送《{简历标题}》PDF 到 {to_email}，主题：{subject}。确认发送吗？"
  2. 系统提示词要求模型：必须等用户在下一轮明确回复"确认/发送吧/是"之后，才能带 `confirm=true` 重新调用
  3. 第二次调用（`confirm=true`）→ 校验凭证是否配置、频率限制、收件地址格式 → 通过 `ResumeDataStore` 取当前简历 → 复用 `backend/routes/pdf.py` 里的 `_compile_pdf_bytes` 生成 PDF → 解密凭证 → 调 `email_sender.send_resume_email` → 返回成功/失败文案
- 未配置凭证 → 明确提示"请先在对话框旁的邮箱图标里连接你的 QQ 邮箱"，不静默失败
- 频率限制：同一用户每小时最多 5 次发送尝试（成功或失败都计数，防止靠失败重试绕过），超限返回明确提示

### 3.4 工具注册（仅管理员可见的硬隔离）

`backend/agent/agent/manus.py` 的 `Manus` 增加构造参数 `is_admin: bool = False`；`_build_tool_collection()` 只有在 `is_admin=True` 时才把 `SendResumeEmailTool()` 加入 `domain_tools`。

`backend/agent/web/routes/stream.py` 里构造 `Manus(session_id=conversation_id)` 的地方（第 136 行）改为 `Manus(session_id=conversation_id, is_admin=_is_admin(user))`——`_is_admin` 该文件里已经存在（第 62 行），直接复用。

这样非管理员的会话里，Coco 的工具列表根本不包含这个工具，模型无法调用；管理员会话才会加载。工具内部执行时再做一次 DB 角色校验（查 `user_id` 对应的 `User.role`），双重保险，和深色模式那次的处理方式一致。

## 4. 数据流

```
管理员点击 Composer 邮箱图标 → 弹窗填邮箱+授权码 → PUT /api/email/credential（Fernet 加密存库）
                                                              │
对话里说"发到 xxx@qq.com" → Manus（is_admin=True，工具集含 send_resume_email）
        → 工具第一次调用（confirm=false）→ 返回确认文案 → 用户下一轮说"确认"
        → 工具第二次调用（confirm=true）
            → 查 email_credentials 解密
            → ResumeDataStore 取当前简历 → _compile_pdf_bytes 生成 PDF
            → email_sender.send_resume_email（smtp.qq.com:465 SSL）
            → 结果通过已有 tool_result SSE 事件回显到聊天气泡（无需新事件类型，非特殊工具名走默认文本渲染）
```

## 5. 错误处理

- 未配置凭证 → 提示去连接邮箱，不静默失败
- 授权码失效/认证失败 → 捕获 `smtplib.SMTPAuthenticationError`，返回"QQ 邮箱授权码可能已失效，请重新连接"
- 收件地址格式非法 → 发送前正则校验，拒绝并提示
- 超过频率限制 → 明确提示"发送太频繁，请 1 小时后再试"
- SMTP 连接失败/超时 → 捕获并提示"邮件服务暂时不可用，请稍后再试"

## 6. 测试计划

- 后端：`crypto.py` 加解密 round-trip 单测；`email_sender` mock `smtplib` 覆盖成功/认证失败/连接失败三路径；`email_credential` 路由 golden path + 非管理员 403 + 未登录 401；`send_resume_email` 工具 mock 掉真实 SMTP，验证无凭证/有凭证/超限三种分支，以及 `confirm=false→true` 两段式确认逻辑
- Agent 工具集：验证 `is_admin=False` 的 `Manus` 实例工具列表里确实不含 `send_resume_email`
- 前端：手动过一遍 Composer 图标（非管理员不可见、管理员可见）→ 连接表单保存/断开 → 对话里触发发送确认 → 确认后收到真实邮件（需要提供一个测试用 QQ 邮箱 + 授权码，我不会代为获取真实凭证，需你自己在 UI 里填）

## 7. 影响范围清单（对照 CLAUDE.md §2.5）

- 新文件：`backend/utils/crypto.py`、`backend/services/email_sender.py`、`backend/routes/email_credential.py`、`backend/agent/tool/send_resume_email_tool.py`、新 alembic migration、`frontend/src/services/emailCredentialService.ts`、`frontend/src/components/agent-chat/EmailConnectPanel.tsx`
- 修改文件：`backend/main.py`（注册新路由）、`backend/agent/agent/manus.py`（`is_admin` 参数 + 工具集条件注册）、`backend/agent/web/routes/stream.py`（构造 `Manus` 时传 `is_admin`）、`backend/models.py`（新增 `EmailCredential` ORM）、`frontend/src/components/agent-chat/Composer.tsx`（新增图标入口）
- `.env` 补充：新增 `EMAIL_CREDENTIAL_ENC_KEY` 说明（安全要求：不写死示例真实密钥）
