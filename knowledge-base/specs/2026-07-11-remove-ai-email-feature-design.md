# 移除「AI 发送简历到邮箱」功能 — 删除方案设计

- 日期：2026-07-11
- 分支：`feature/wy/20260711/01`（从 dev 切出）
- 性质：只读调研 + 方案设计（本文档是唯一产出，未改动任何源码，未 commit）
- 背景：产品要下线「AI 助手/Agent 通过对话把简历渲染成 PDF 发到（QQ）邮箱」这个功能。
  用户特别交代：**未来可能接入「QQ 邮箱登录」**，所以要甄别哪些是「AI 发邮件功能专属」（该删），
  哪些是「邮箱/加密/发送基础设施」（未来登录可能复用，该保留）。**不要为了删干净把未来登录要用的基础设施也删了。**

---

## 0. 甄别原则（本方案的分类标准）

- **该删**：直接服务「Agent 通过对话触发发送简历邮件」这一具体功能——工具定义、发送意图识别正则、
  邮件确认/润色/模板 UI、邮件专属 API 路由、邮件正文模板、这些的专属测试。
- **该保留（基础设施）**：通用能力，结构上与「发简历邮件」解耦、未来 QQ 登录/通知等可直接复用——
  通用加密（Fernet）、邮箱格式校验、通用运行时审批机制（`requires_approval` 协议）、SMTP 发送底层。
- **需确认**：归属取决于「未来 QQ 登录走哪种技术路线」或「是否要 drop 数据库表」等外部决策，本方案不擅自拍板。

---

## 1. 最容易踩的混淆陷阱（先读，避免误删）

### 1.1 两套「polish 润色」是不同功能，只删邮件那套
- **邮件正文润色（该删）**：`ApprovalCard.tsx` 里的 `PolishPopover` → 后端 `POST /api/agent/approval/polish`
  （`backend/agent/web/routes/approval.py`）。这是给「发简历邮件」的正文做润色。
- **简历字段润色（保留，勿碰）**：`frontend/src/pages/Workspace/v2/shared/PolishChatDialog.tsx` 及
  `RichEditor/index.tsx`、各 `EditPanel/*` 里所有 `polishPath` / `onPolish` / `handlePolish`。
  这是简历编辑器里对经历/项目/技能等字段的 AI 润色，走**完全不同的链路**，与邮件无关。
  grep `polish` 会大量命中这一套——**全部保留，一个都不要动**。

### 1.2 `approval` 有「通用机制」和「邮件专属实现」两层，分开处理
- **通用运行时审批协议（保留/休眠）**：`backend/agent/tool/base.py` 的 `requires_approval` 等属性、
  `backend/agent/agent/toolcall.py` 的 `_suspend_for_approval`/`_halt_for_pending_approval`、
  `backend/agent/approval.py` 的 pending 挂起表、前端 `StructuredCardRegistry` 的 `approval_request` 分发、
  `StreamingLane`/`MessageTimeline` 的 `hasApprovalCard`。这套是通用「工具执行前挂起等用户确认」能力。
- **唯一消费者是邮件**：目前系统里 `requires_approval = True` 的工具**只有** `send_resume_email`。
  删掉它后整条审批链路**没有任何消费者**，成为休眠代码，但它不是邮件专属，未来别的敏感工具可复用。
  → 本方案默认**保留通用机制**（见 §4 需确认项，可按需一并清理）。

### 1.3 `intent_router.py` 里发送守卫和复合请求守卫是两回事
- 该删：`_SEND_EMAIL_VERB_RE`、`_EMAIL_ADDR_RE`、`_has_send_email_intent`（发送邮件意图识别）。
- 保留：`_COMPOUND_CONJ_RE`、`_ACTION_VERB_RE`、`_looks_like_compound_request`（复合请求让权，与邮件无关）。
- `_rule_intent_yield_reason` 同时调用两者 → **部分删除**（只摘掉 `_has_send_email_intent` 分支）。

---

## 2. 完整文件清单（分类表）

### 2.1 后端 — 整个文件删除（邮件功能专属）

| 文件路径 | 分类 | 理由 |
|---|---|---|
| `backend/agent/tool/send_resume_email_tool.py` | 该删 | AI 发简历邮件工具本体：工具定义、限频、确认前校验、PDF 渲染、SMTP 编排。核心删除对象。 |
| `backend/routes/email_templates.py` | 该删 | 邮件正文模板 CRUD + 内置「简历优化邮件」岗位模板，纯邮件功能。 |
| `backend/tests/test_send_resume_email_tool.py` | 该删 | 上述工具的专属测试（approval/polish/rate_limit）。 |
| `backend/tests/test_email_templates_routes.py` | 该删 | 邮件模板路由测试。 |

### 2.2 后端 — 部分删除 / 清理引用点

| 文件路径 | 分类 | 处理 |
|---|---|---|
| `backend/agent/agent/manus.py` | 部分删 | 删 L19 `SendResumeEmailTool` import、L139-140 admin 注册 append、L56 注释提及；保留 `intent_router` 使用与 compound 处理（L520-535）。 |
| `backend/agent/tool/__init__.py` | 部分删 | 删 L15 import、L35 `"SendResumeEmailTool"` 导出。 |
| `backend/agent/agent/intent_router.py` | 部分删 | 删 `_SEND_EMAIL_VERB_RE`(L28)、`_EMAIL_ADDR_RE`(L29)、`_has_send_email_intent`(L32-34)，并从 `_rule_intent_yield_reason`(L57-64) 摘掉 `if _has_send_email_intent(...)` 分支及「发送语义」标注；保留复合请求逻辑。注意 `decide()` 里 `yield_reason == "发送语义"` 的日志/分支随之消失，需确认下游无人依赖该字符串。 |
| `backend/routes/__init__.py` | 部分删 | 删 L21 `email_templates` import、L59 `__all__` 条目（`email_credential` 去留见 §4）。 |
| `backend/main.py` | 部分删 | 删 L92 `email_templates_router` 赋值、L142 `include_router`（`email_credential` 去留见 §4）。 |
| `backend/tests/test_intent_router.py` | 部分删 | 删「发送语义」用例（L84 断言 `yield_reason == "发送语义"` 那个 test）；保留 greeting/LLM-first/compound/diagnosis 等用例。 |
| `backend/tests/test_intent_send_guard.py` | 部分删 | 删 `_has_send_email_intent` 相关 test（L26-54）；保留 `_looks_like_compound_request`/`_rule_intent_yield_reason` 的 compound 用例。文件可考虑改名去「send」语义。 |

### 2.3 前端 — 整个文件删除（邮件功能专属）

| 文件路径 | 分类 | 理由 |
|---|---|---|
| `frontend/src/components/agent-chat/ApprovalCard.tsx` | 该删 | 邮件确认卡：收件人/主题/正文编辑、模板浮窗、AI 润色浮窗、附件展示，整卡为邮件而生。 |
| `frontend/dist/assets/CocoChat-*.js` | 该删（构建产物） | 编译产物，随重新构建自然更新，不手工改；列出仅为说明命中来源。 |

### 2.4 前端 — 部分删除 / 清理引用点

| 文件路径 | 分类 | 处理 |
|---|---|---|
| `frontend/src/components/agent-chat/StructuredCardRegistry.tsx` | 部分删 | 删 L10 `ApprovalCard` import、L45 `approval_request: ApprovalCard`。删后 REGISTRY 变空对象（通用透传机制本身保留，见 §1.2）。 |
| `frontend/src/components/agent-chat/Composer.tsx` | 部分删 | 删 L9 `EmailConnectButton` import、L175 `<EmailConnectButton />`（EmailConnectButton 本体去留见 §4）。 |
| `frontend/src/components/agent-chat/StreamingLane.tsx` | 部分删/可留 | L119/L132 `hasApprovalCard`：审批卡渲染兜底逻辑，通用但唯一来源是邮件。可保留（休眠）或一并清理，建议随 §1.2 决策统一处理。 |
| `frontend/src/components/agent-chat/MessageTimeline.tsx` | 部分删/可留 | L192/L207 `hasApprovalCard`，同上。 |

### 2.5 前端 — 明确保留（勿碰）

| 文件路径 | 分类 | 理由 |
|---|---|---|
| `frontend/src/pages/Workspace/v2/shared/PolishChatDialog.tsx` 及 `RichEditor/*`、`EditPanel/*` 全部 `polish*` | 保留 | 简历字段编辑的 AI 润色，与邮件正文润色完全无关（见 §1.1）。 |

### 2.6 后端 — 保留（通用基础设施）

| 文件路径/代码块 | 分类 | 理由 |
|---|---|---|
| `backend/utils/crypto.py`（`encrypt_secret`/`decrypt_secret`） | 保留 | 通用 Fernet 加密，任何密钥/授权码/token 存储都能复用；未来 QQ 登录必然要用。 |
| `backend/agent/tool/base.py`（`requires_approval` 等属性、`validate_before_approval`、`approval_preview`） | 保留 | 通用工具审批协议基类字段，非邮件专属。 |
| `backend/agent/agent/toolcall.py`（`_suspend_for_approval`/`_halt_for_pending_approval`/requires_approval 处理） | 保留（休眠） | 通用运行时审批挂起机制，删邮件后无消费者但结构通用。 |
| `backend/agent/approval.py`（pending 挂起表） | 保留（休眠） | 通用挂起存储，同上。 |
| `backend/agent/web/session_manager.py`、`stream.py`（memory 回写通道 `get_active_agent`） | 保留 | 通用旁路端点回写 agent 记忆能力，非邮件专属。 |
| `backend/agent/agent/intent_router.py` 复合请求部分 | 保留 | 与邮件无关（见 §1.3）。 |
| `backend/tests/test_structured_passthrough.py` | 保留 | 测的是通用结构化透传机制，`approval_request` 只是它举的示例 payload；可保留，或把示例 type 换成非邮件字样。 |

---

## 3. 影响面 / 断链清单（Blast Radius，对齐 CLAUDE.md §2.1「影响范围枚举」）

**被删代码的所有 import / 注册 / 消费点（删除后须同步清理，避免断链）：**

- Agent 工具注册点：
  - `backend/agent/tool/__init__.py` L15 import + L35 export（`SendResumeEmailTool`）
  - `backend/agent/agent/manus.py` L19 import、L139-140 admin 注册
- 后端路由注册：
  - `backend/routes/__init__.py` L20-21 import、L58-59 `__all__`
  - `backend/main.py` L91-92 赋值、L141-142 `include_router`
  - `backend/agent/web/routes/__init__.py` L12 import、L19 include（`approval_router`——仅当决定删审批路由时）
- 审批链路调用点（通用机制，删邮件后成休眠，按 §4 决策）：
  - `backend/agent/agent/toolcall.py` L515-516 `requires_approval` 判断 → `_suspend_for_approval`
  - `backend/agent/web/routes/approval.py` `_build_tool` L57-64 对 `send_resume_email` 的硬映射，含**函数内惰性 import**（不是模块级，import 冒烟测不出来）——必须显式清理该分支，改为直接 `return None`，不能只依赖删文件后自然失效
- 意图路由消费点：
  - `backend/agent/agent/manus.py` L520 `decide()` 结果消费；`yield_reason == "发送语义"` 字符串下游依赖需确认无
- SSE / 结构化事件消费点（前端）：
  - `StructuredCardRegistry.tsx` L45 `approval_request` → `ApprovalCard`
  - `StreamingLane.tsx` L119/132、`MessageTimeline.tsx` L192/207 `hasApprovalCard`
  - 后端推 `approval_request` 事件源：`toolcall.py` `_suspend_for_approval`（结构化透传）
- 邮件凭证/模板前端调用点：
  - `Composer.tsx` L9/L175 → `EmailConnectButton.tsx` → `emailCredentialService.ts` → `/api/email/credential`
  - `ApprovalCard.tsx` → `/api/email/templates`、`/api/agent/approval/polish`
- 加密/DB 交叉引用（保留 crypto，但邮件是其消费者之一）：
  - `send_resume_email_tool.py` L166/187 `decrypt_secret`（随工具删除）
  - `email_credential.py` L18/70 `encrypt_secret`（随 credential 去留，见 §4）

**断链自检点：** 删除后确保没有残留 `import ... SendResumeEmailTool`、`import ApprovalCard`、
`email_templates_router`、`/approval/polish` 的悬空引用；`REGISTRY` 空对象合法但需确认前端无处 assert 非空。

---

## 4. 归属决策（用户已拍板，以下为最终结论）

| 项 | 涉及文件 | 最终决策 | 理由 |
|---|---|---|---|
| **A. SMTP 发送底层** | `backend/services/email_sender.py`、`backend/tests/test_email_sender.py` | **保留** | 用户确认未来 QQ 登录走「接收邮箱验证码」路线——系统需要主动发验证码邮件，正好复用这套 SMTP 发送能力。测试随之保留。 |
| **B. 邮箱凭证存储** | `backend/models.py` `EmailCredential`(L184-195)、`backend/routes/email_credential.py`、`backend/routes/__init__.py` L20/L58、`backend/main.py` L91/L141、`backend/tests/test_email_credential_routes.py`、前端 `EmailConnectButton.tsx` + `emailCredentialService.ts` | **删** | 存的是用户自己的 QQ SMTP **发信**授权码，与「登录时接收验证码」方向相反（后者是系统发信、用户回填验证码，不需要用户提供自己的发信凭证）。整套凭证栈用不上。 |
| **C. 邮箱格式校验** | `email_credential.py` L24 `QQ_EMAIL_RE`、`send_resume_email_tool.py` L24 `EMAIL_RE` | **保留，抽成公共 util** | 登录校验用户输入的邮箱格式要用。建议抽到 `backend/utils/` 下一个通用校验模块，随 B 的文件一起删除前先迁出。 |
| **D. 数据库表是否 drop** | `backend/alembic/versions/016_add_email_credentials.py`、`017_add_email_templates.py`、`backend/models.py` `EmailCredential`/`EmailTemplate` | **删**（表也 drop） | 用户确认。**不删除/修改已有的 016/017 迁移文件本身**（历史不改写），新增一支 down 迁移专门 drop `email_credentials`/`email_templates` 两张表；`models.py` 里的 `EmailCredential`/`EmailTemplate` 类定义一并删除。 |
| **E. 通用审批机制是否一并清理** | `toolcall.py` 审批段、`approval.py`、`base.py` 审批属性、前端 `hasApprovalCard`、`StructuredCardRegistry` 空 REGISTRY、`approval` 路由 | **保留** | 通用基础设施，非邮件专属，删邮件后休眠但未来任何敏感操作（含登录二次确认）可复用。 |
| **F. `/api/agent/approval` 路由整体** | `backend/agent/web/routes/approval.py`（`/approval` + `/approval/polish`）、`backend/agent/web/routes/__init__.py` | `/approval/polish` **删**，`/approval` **保留** | 邮件正文润色端点确定删；通用审批端点随 E 保留。 |

---

## 5. 执行步骤（建议顺序，先叶子后引用点，逐步验证不断链）

> §4 已全部拍板：A 保留 SMTP 底层，B 删凭证栈，C 抽成公共 util 保留，D 删表（新增 down 迁移），E 保留通用审批，F `/approval/polish` 删 `/approval` 保留。以下按此定案给出。

1. **删工具本体**：删除 `backend/agent/tool/send_resume_email_tool.py`；在 `backend/agent/tool/__init__.py` 删 import+export；在 `backend/agent/agent/manus.py` 删 import+admin 注册+注释。
2. **删发送意图守卫**：`backend/agent/agent/intent_router.py` 删 `_SEND_EMAIL_VERB_RE`/`_EMAIL_ADDR_RE`/`_has_send_email_intent` 及 `_rule_intent_yield_reason` 的 send 分支；保留复合请求逻辑。
3. **删邮件正文润色端点**：`backend/agent/web/routes/approval.py` 删 `/approval/polish` + `POLISH_SYSTEM_PROMPT` + polish 限频块；`/approval` 通用端点保留。**同时必须清理 `_build_tool()`（L54-64）里 `if tool_name == "send_resume_email": from backend.agent.tool.send_resume_email_tool import SendResumeEmailTool ...` 这个惰性 import 分支**——它是函数内部才执行的 import，模块级 import 冒烟测不出来，删掉工具文件后这里会残留一个指向不存在模块的悬空引用。清理后 `_build_tool` 直接 `return None`（`/approval` 端点变成永远返回"未知工具"的休眠端点，与 §4-E 保留通用机制一致）。
4. **删邮件模板路由**：删除 `backend/routes/email_templates.py`；清 `backend/routes/__init__.py` 与 `backend/main.py` 的 templates 注册。
5. **删前端邮件 UI**：删除 `ApprovalCard.tsx`；`StructuredCardRegistry.tsx` 去掉 import 与 `approval_request` 条目；`Composer.tsx` 去掉 `EmailConnectButton` 引用。
6. **抽邮箱格式校验到公共 util**（先做，避免删凭证文件时把正则一起删丢）：把 `QQ_EMAIL_RE`/`EMAIL_RE` 迁到 `backend/utils/` 下一个通用校验模块（比如 `email_validation.py`），供未来登录复用。
7. **删凭证栈**：`EmailConnectButton.tsx`、`emailCredentialService.ts`、`backend/routes/email_credential.py`、`models.py` 的 `EmailCredential`+`EmailTemplate` 类定义、`backend/routes/__init__.py`/`backend/main.py` 相关注册。
8. **数据库**：新增一支 alembic 迁移 `backend/alembic/versions/018_drop_email_tables.py`（`revision="018"`，`down_revision="017"`），`upgrade()` 里对两张表各做 `op.drop_index(...)` + `op.drop_table(...)`（先 drop index 再 drop table），`downgrade()` 镜像 016/017 的 `upgrade()` 重建两表；不改动/不删除 016/017 历史迁移文件本身。
9. **清测试**：删 `test_send_resume_email_tool.py`、`test_email_templates_routes.py`、`test_email_credential_routes.py`；`test_intent_router.py`/`test_intent_send_guard.py` 删发送相关用例保留 compound；`test_email_sender.py`/邮箱格式校验测试保留（随 A/C 迁移）。
10. **清孤儿 import / 注册 / 死渲染**：按 §3 清单逐项确认无悬空引用；前端 `hasApprovalCard`、`StructuredCardRegistry` 空 REGISTRY 保留（休眠，随 E）。
11. **验证**：后端 import 冒烟（不跑测试，按用户要求）；前端 build（`ApprovalCard`/`EmailConnectButton` 删除后无 TS 报错）；确认 Workspace 简历字段润色（§1.1 保留项）不受影响。

---

## 6. 「因未来 QQ 邮箱登录而保留」清单（明确列出）

以下**不随本次删除动**，理由：结构通用、未来 QQ 邮箱登录可直接复用：

1. `backend/utils/crypto.py`（`encrypt_secret` / `decrypt_secret`）— 通用 Fernet 加密，存 OAuth token / 授权码通用。**确定保留**。
2. `backend/services/email_sender.py` — QQ SMTP 发送底层（`smtp.qq.com:465` SSL + 授权码）。用户确认未来 QQ 登录走「接收邮箱验证码」路线，系统需要主动发验证码邮件，正好复用。**保留**。
3. 通用运行时审批机制：`backend/agent/tool/base.py` 审批属性、`backend/agent/agent/toolcall.py` 挂起段、`backend/agent/approval.py`、前端 `StructuredCardRegistry` 透传 —— 非邮件专属，未来任何敏感操作（含登录二次确认）可复用。**保留**。
4. 邮箱格式校验正则（`QQ_EMAIL_RE` / `EMAIL_RE`）—— 通用校验，登录输入 QQ 邮箱要用。**抽成公共 util 保留**（迁到 `backend/utils/email_validation.py` 之类）。

以下**确定不保留**（用户已拍板 B/D=删）：

5. `EmailCredential`/`EmailTemplate` 模型 + `email_credential.py` 凭证 CRUD + 前端凭证栈（`EmailConnectButton.tsx`/`emailCredentialService.ts`）——存的是用户自己的发信授权码，与「登录接收验证码」方向相反，用不上。**删**，含数据库表（新增 down 迁移 drop 表，不改 016/017 历史迁移文件）。

---

## 7. 涉及文件汇总统计

- **该删（整文件）**：6 个 —— `send_resume_email_tool.py`、`email_templates.py`、`ApprovalCard.tsx`、
  `test_send_resume_email_tool.py`、`test_email_templates_routes.py`、`/approval/polish` 端点（属 approval.py 部分）。
  （另 `frontend/dist/**` 构建产物不计。）
- **部分删除 / 清引用点**：约 11 处文件 —— `manus.py`、`tool/__init__.py`、`intent_router.py`、
  `routes/__init__.py`、`main.py`、`agent/web/routes/approval.py`、`agent/web/routes/__init__.py`、
  `StructuredCardRegistry.tsx`、`Composer.tsx`、`StreamingLane.tsx`、`MessageTimeline.tsx`、
  `test_intent_router.py`、`test_intent_send_guard.py`。
- **保留（通用基础设施）**：`crypto.py`、`base.py` 审批属性、`toolcall.py` 审批段、`approval.py`、
  `session_manager.py`/`stream.py` 回写、`intent_router.py` 复合逻辑、`test_structured_passthrough.py`、
  `email_sender.py`(+test)、邮箱格式校验正则（抽成公共 util）、
  以及**全部 Workspace 简历润色**（`PolishChatDialog.tsx` 等，最大混淆项）。
- **额外删除（凭证栈，用户已拍板）**：`EmailCredential`/`EmailTemplate` 模型、`email_credential.py`、
  前端 `EmailConnectButton.tsx`/`emailCredentialService.ts`、`test_email_credential_routes.py`，
  以及新增一支 alembic down 迁移 drop `email_credentials`/`email_templates` 两张表（不改 016/017 历史文件）。
