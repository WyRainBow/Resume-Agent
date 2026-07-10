# CLAUDE.md

> 本文件是每次研发任务的强制清单。动手前、编码中、完成前、收尾 四个阶段的条款都必须对照执行。

---

## 0. 基础约定

- 用中文和我交互
- 用户提产品 / 研发需求，Claude Code 负责理解、实现、验证和记录
- 当前项目是 Resume-Agent 单仓库，包含 `frontend/` 与 `backend/`
- 后端主服务端口默认 `9000`，前端 Vite 默认端口为 `5173`；`9000` 被占用时可换端口启动（见 §3.2 端口冲突回退规则）
- 核心约束：Agent 已合并进 `backend/agent/`，运行在主后端进程内；**没有独立 9100 端口 Agent 服务**
- `knowledge-base/` 是设计、计划、评审和操作记录的唯一主知识库
- `reference/` 是竞品调研与参考资料目录：`reference/docs/` 放调研文档（进 Git），`reference/projects/` 放 clone 的参考项目源码（被 Git 忽略）；**所有竞品调研文档都归档到 `reference/docs/`**，索引见 `reference/README.md`
- `knowledge/` 是本地旧目录，已被 Git 忽略，不作为项目长期记录位置
- `README.md` 在本仓库可能被忽略，不要只靠 Git 状态判断文档变化
- 不修改无关文件，不顺手重构，不移动或重命名文件，除非用户明确要求
- 保留用户已有改动；遇到不属于本次任务的变更，不回滚、不覆盖

---

## 1. 项目概述

**Resume-Agent** — 面向中文求职场景的 AI 简历系统，覆盖自然语言生成、PDF/文本解析、结构化编辑、AI 对话式修改、实时预览、简历质量分析和 PDF 导出。

### 1.1 技术栈

| 层 | 技术 | 版本 / 入口 | 备注 |
|---|---|---|---|
| 前端 | React + TypeScript + Vite | React 18 / `frontend/` | 开发端口 `5173` |
| UI | Tailwind CSS + lucide-react + Radix Slot + TipTap | | 工作台、富文本、对话和预览 |
| 后端 | FastAPI + Python | `backend/main.py` | 服务端口 `9000` |
| 数据库 | SQLAlchemy | `backend/database.py` | 默认 SQLite，可通过环境变量切换 |
| 认证 | JWT + passlib/bcrypt | `backend/routes/auth.py` | 前端配合 `AuthContext` / `authService` |
| Agent | Manus + Tool 系统 | `backend/agent/` | in-process，挂载到 `/api/agent` |
| PDF | LaTeX / XeLaTeX | `backend/routes/pdf.py`、`latex-resume-template/` | 后端流式渲染 |
| AI 模型 | DeepSeek / DashScope、智谱、豆包 | `.env`、`config.toml` | 按现有 provider 维护 |
| 存储 | 腾讯 COS + 本地缓存 + 数据库 | | logo、照片、简历数据 |
| 其它 | TTS、ASR、语义搜索、LeetCode | | 按已有模块维护 |

### 1.2 项目结构

```text
backend/
├── main.py              # FastAPI 应用入口，注册主后端路由和内嵌 Agent 路由
├── routes/              # API 路由：resume/pdf/auth/resumes/agent 等
├── services/            # PDF 解析、评分、嵌入、LeetCode 等业务服务
├── agent/               # Manus Agent、工具系统、SSE 事件和会话上下文
├── models.py            # Pydantic DTO + SQLAlchemy ORM 模型
├── database.py          # 数据库 URL、engine、SessionLocal、get_db
├── latex_*.py           # LaTeX 生成与编译
└── tests/               # 后端测试

frontend/
├── src/App.tsx          # 前端路由入口
├── src/pages/           # Landing、Workspace、AgentChat、Dashboard、LeetCode 等页面
├── src/pages/Workspace/ # 简历工作台，v2 是当前主工作台
├── src/services/        # API、存储、鉴权、TTS、PDF 配置等客户端服务
├── src/contexts/        # AuthContext、ResumeContext、EnvironmentContext
├── src/hooks/           # 通用 hooks 与 agent-chat hooks
├── src/components/      # 通用组件、聊天组件、PDFEditor 等
└── vite.config.ts       # Vite 配置，开发期 `/api` 代理到后端

latex-resume-template/   # LaTeX 简历模板资源

knowledge-base/
├── specs/               # 设计规格：YYYY-MM-DD-<topic>-design.md
├── plans/               # 实施计划：YYYY-MM-DD-<feature>.md
└── reviews/             # Review / 操作记录

reference/
├── README.md            # 参考资料索引
├── docs/                # 竞品调研文档（进 Git）
└── projects/            # clone 的参考项目源码（Git 忽略）
```

### 1.3 项目文档

| 文件 / 目录 | 说明 |
|---|---|
| `AGENTS.md` | 跨 Agent 的共享项目规则 |
| `CLAUDE.md` | Claude Code 项目规则，本文件 |
| `CODEX.md` | Codex 项目规则 |
| `.claude/rules/` | Claude 按路径加载的补充规则，如存在则优先检查 |
| `knowledge-base/specs/2026-03-23-nl-resume-refactor-design.md` | 当前自然语言简历重构设计 |
| `knowledge-base/plans/2026-03-24-nl-resume-refactor.md` | 当前自然语言简历重构计划 |
| `knowledge-base/specs/2026-05-20-resume-scoring-design.md` | 简历评分设计 |
| `knowledge-base/plans/2026-05-20-resume-scoring-plan.md` | 简历评分计划 |

### 1.4 默认账户

| 环境 | 账号 | 密码 | 说明 |
|---|---|---|---|
| 本项目规则不固定默认账户 | - | - | 如本地存在测试账号，以 seed、数据库或 `.env` 为准，不在规则文档写死密码 |

---

## 2. 研发任务四阶段强制流程

### 阶段一 · 动手前（理解 + 计划）

1. **需求不独断**
   - 假设要**显式说出来**，不确定就问
   - 多种解释存在 → 列出来让用户选，不静默选一个
   - 看到更简单的方案就指出，必要时对复杂方案提异议
   - 不清楚就**停下**，命名清楚在困惑什么再问

2. **新功能必调 `/brainstorming`**，做需求分析与方案探索

3. **复杂功能必调 `/writing-plans`**，写实施计划

4. **六角度思考框架**（复杂功能用）：
   第一性原理 → 理性逻辑推理 → 概率风险评估 → 迭代优化 → 逆向思维 → 批判性思维

5. **影响范围枚举**（新增页面 / 入口 / 路由 / Agent 工具类任务必做）：
   - 先 `rg` 一个现有同级路径或同类功能，查所有注册点，**按下列清单逐项对照修改**
   - 前端路由：`frontend/src/App.tsx`
   - 工作台布局：`frontend/src/pages/WorkspaceLayout/index.tsx`
   - 当前主工作台：`frontend/src/pages/Workspace/v2/index.tsx`
   - 前端 API：`frontend/src/services/api.ts`
   - 简历存储：`frontend/src/services/resumeStorage.ts`
   - 前端运行时配置：`frontend/src/lib/runtimeEnv.ts`
   - 后端应用入口：`backend/main.py`
   - 后端路由目录：`backend/routes/`
   - Agent 路由：`backend/agent/web/routes/`
   - Agent 主类：`backend/agent/agent/manus.py`
   - Agent 工具：`backend/agent/tool/`
   - PDF 主链路：`frontend/src/pages/Workspace/v2/utils/convertToBackend.ts` → `frontend/src/services/api.ts` → `backend/routes/pdf.py` → `backend/latex_generator.py`
   - 不要只看单个数组名或单个文件就以为入口完整，项目里前端路由、侧边栏、服务封装、事件消费常常是多处联动

### 阶段二 · 编码中（写代码的纪律）

#### 2.1 核心原则：只写主流逻辑

**不新增无意义降级 / 兜底 / 防御分支**。类型契约和数据契约能约束的问题，优先修主流逻辑，不包一层绕过。

禁止：
- ❌ `x ?? 默认值` / `x !== undefined ? ... : 默认` 覆盖“理论不会缺失”
- ❌ `try { ... } catch { return 默认 }` 吞异常走降级
- ❌ “A 不行回退 B” 的 plan B 分支
- ❌ 主流必然存在的字段用可选类型 `foo?: T`（应定 `foo: T`）

允许：
- ✅ 只在**系统边界**（用户请求体 / 上传文件 / 外部 AI 响应 / 数据库读取 / 跨服务响应）做校验——这是验证不是降级
- ✅ 保留项目已有的产品级 fallback，例如数据库写入失败后继续保留本地简历缓存；不要擅自删除，也不要把它扩散成新的绕路逻辑

#### 2.2 简单优先

- 只写解决当前问题的最小代码，不做推测性设计
- 不加未被要求的功能
- 不为单次使用场景引入抽象
- 不为理论不会发生的场景加错误处理
- 能用现有工具、现有 service、现有 hooks 解决，就不新增平行实现
- 判据：资深工程师会说这过度复杂吗？是就简化

#### 2.3 外科式修改

- 不**顺手**优化相邻代码、注释、格式
- 不重构没有坏的内容
- 匹配现有风格，即使自己偏好不同
- 发现不相关的死代码，**指出但不删除**
- 但**自己改动产生的孤儿**（unused import / var / function）必须清理
- 判据：每一处改动行都能直接追溯到用户需求

#### 2.4 技术规范

- **FastAPI / 后端**
  - 应用入口：`backend/main.py`
  - 启动命令：`python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000`
  - 新增路由先检查 `backend/routes/` 和 `backend/main.py` 的注册方式
  - 数据库会话使用 `get_db()`，不要绕开 `backend/database.py`
  - 模型集中在 `backend/models.py`，注意 `models` / `backend.models` 兼容别名，不要引入第二套 mapper
  - 修改鉴权接口时同步检查 `backend/auth.py`、`backend/middleware/auth.py`、前端 `AuthContext` 和 `authService`

- **Vite / 前端**
  - 前端入口：`frontend/src/App.tsx`
  - 当前主工作台：`frontend/src/pages/Workspace/v2/index.tsx`
  - API base 走 `frontend/src/lib/runtimeEnv.ts`；开发环境默认同源 `/api`，由 Vite 代理到 `127.0.0.1:9000`
  - 不要硬编码远程 API，除非当前功能明确需要远程环境
  - 简历存储通过 `frontend/src/services/resumeStorage.ts`，不要绕过本地 / 数据库双适配器
  - UI 改动要匹配现有布局、组件粒度和 Tailwind 风格，不引入全局视觉重写

- **Agent / Manus**
  - `Manus` 是 Python 类，不是独立服务，文件：`backend/agent/agent/manus.py`
  - Agent 路由默认走 `backend.agent.web.routes`，挂载到 `/api/agent`
  - `AGENT_BACKEND_BASE_URL` 在 `.env` 中应保持注释或不用，除非明确恢复外部 Agent 服务
  - 简历工具通过 `ResumeDataStore` 共享当前会话简历
  - 工具返回统一使用 `ToolResult`；需要给前端结构化数据时，放入 `ToolResult.system` JSON
  - SSE 事件如 `tool_result`、`resume_updated`、`resume_patch` 必须保持前后端一致
  - 不要破坏前端 `useToolEventRouter` 对 `show_resume`、`cv_reader_agent`、`cv_editor_agent`、`generate_resume`、`resume_updated` 的事件约定

- **PDF / LaTeX**
  - JSON 到 PDF 主链路：前端 ResumeData → `convertToBackendFormat` → `/api/pdf/render/stream` → `json_to_latex` → XeLaTeX
  - 修改 PDF 行为时必须关注 section order、HTML 富文本转 LaTeX、中文字体、照片和 logo
  - 不要把 PDF 渲染缓存、远程渲染或 admin 代理逻辑混入普通渲染链路，除非任务明确要求
  - 出错时保留 trace 信息，优先复用已有 `X-PDF-Trace-*` 头和日志格式

### 阶段三 · 完成前（验证闭环）

1. **UI 任务必须启 dev server 实测**
   - `npm run build` 只能证明构建通过，不能证明功能能用
   - 打开浏览器，真实走一遍用户路径：入口点得到 / 表单填得进 / 按钮响应正确 / 边界态覆盖 / 控制台无关键错误
   - 前端验证命令：`cd frontend && npm run build`

2. **后端改动必须三路测试**
   - golden path（正常流程）
   - 边界（空值 / 超限 / 非法类型）
   - 错误路径（鉴权失败 / DB 异常 / 外部依赖 down）
   - 后端优先跑目标测试；存在或新增测试时运行相关 `pytest`

3. **Agent / SSE 改动必须验证事件落地**
   - 不能只验证 LLM 文本回答
   - 要确认 `/api/agent/stream` 事件顺序、工具事件、`ResumeDataStore` 更新、前端本地简历替换和预览刷新
   - 涉及 `cv_editor_agent` / `generate_resume` 时，必须确认最终简历数据已进入前端状态或数据库

4. **PDF 改动必须验证真实渲染链路**
   - 至少覆盖前端调用、后端接口、LaTeX 生成和编译错误输出
   - 只看 JSON 或只看按钮点击不算完成

5. **必调 `/verification-before-completion`**——不是装饰，是强制

6. **不能声称“完成”的情况**
   - 测试没通过
   - 实现不完整
   - 遇到未解决的错误
   - 关键文件 / 依赖没找到
   - 只启动了进程，没有确认 HTTP 可访问或功能可用

### 阶段四 · 收尾（提交 + 记录）

1. **立即 commit**：代码改动完成后必须当次提交，不攒批；如果当前目录不是 Git 仓库、无提交权限或用户不要求提交，必须明确说明，不能假装已提交
2. **更新 `knowledge-base/`**：任务完成后，如涉及架构、接口、Agent 流程、PDF 链路或用户流程变化，追加设计 / 计划 / Review / 操作记录
3. **保持规则文档一致**：若修改了项目事实，必要时同步 `AGENTS.md`、`CLAUDE.md`、`CODEX.md`
4. **不 push**：除非用户明确要求
5. **部署前必更新版本与更新日志**：每次要 `git push origin main`（会触发服务器 cron 自动部署）前，维护 `frontend/src/data/changelog.ts` 的 `CHANGELOG` 数组——`version` 递增（补丁级 +0.0.1，如 `2.4.1` → `2.4.2`；较大功能可 +0.1.0）、`date` **只写日期（`YYYY-MM-DD`），绝不写时分**；**同一天多次部署合并为一条**（当天已有条目就把新内容并入该条目并把 version 抬到最新，而不是再加一条）、`added` / `fixed` 写**面向用户的简短中文**（不写技术 / 运维细节）。changelog 改动与本次发布代码一起提交再 push；上线后用户首次进入会自动弹「有什么新变化」（`ChangelogModal`，以 version 作已读标识）。

---

## 3. 环境与部署

### 3.1 环境变量（`.env` / `config.toml`）

| 变量 / 文件 | 说明 |
|---|---|
| `DATABASE_URL` | SQLAlchemy 数据库连接串 |
| `USE_POSTGRESQL` / `POSTGRESQL_URL` | PostgreSQL 切换配置 |
| `DASHSCOPE_API_KEY` | DeepSeek / DashScope 兼容接口 |
| `ZHIPU_API_KEY` | 智谱 OCR / 视觉模型 |
| `DOUBAO_API_KEY` | 豆包模型 |
| `COS_SECRET_ID` / `COS_SECRET_KEY` / `COS_REGION` / `COS_BUCKET` | 腾讯 COS 存储配置 |
| `JWT_SECRET_KEY` | JWT 签名密钥 |
| `AGENT_BACKEND_BASE_URL` | 默认应注释；只有恢复外部 Agent 服务时才启用 |
| `config.toml` | Agent LLM 默认配置 |

安全要求：

- 不在日志、文档、提交信息中暴露完整 API Key、JWT、数据库密码
- 需要展示配置状态时只显示前后少量字符

### 3.2 启动流程

```bash
uv pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
cd frontend && npm install
cd frontend && npm run dev
```

访问地址：

| 服务 | 地址 |
|---|---|
| 前端 | `http://127.0.0.1:5173` |
| 后端 | `http://127.0.0.1:9000` |
| OpenAPI | `http://127.0.0.1:9000/docs` |

**端口冲突时的回退规则**：后端默认 `9000`。如果 `9000` 被其它进程占用（例如别的项目的服务），**不要去杀不属于本项目的进程**，改用其它端口启动后端（如 `8000`），并让前端 `/api` 代理指向该端口——`vite.config.ts` 的代理目标是环境变量驱动的，无需改配置文件：

```bash
# 后端换端口启动（示例 8000）
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
# 前端 dev 时把 /api 代理指到该端口（VITE_DEV_PROXY_TARGET 覆盖默认 9000，不落盘、不提交）
cd frontend && VITE_DEV_PROXY_TARGET=http://127.0.0.1:8000 npm run dev
```

验证代理已通：`curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5173/api/agent/history/sessions/list` 返回 `401`（到达后端、需鉴权）即正常，`502` 说明没连上后端。

### 3.3 验证命令

```bash
cd frontend && npm run build
pytest backend/tests/<target_test>.py
```

后端测试按任务范围优先跑目标测试；没有相关测试时，至少用 HTTP 请求验证接口。

### 3.4 简历数据全局口径

简历数据在前端、后端、Agent 和 PDF 链路中有不同形态，修改时必须按下表统一口径：

| 场景 | 主入口 | 说明 |
|---|---|---|
| 前端编辑态 | `frontend/src/pages/Workspace/v2/` | 用户看到和编辑的 ResumeData |
| 前端存储 | `frontend/src/services/resumeStorage.ts` | 本地缓存 / 数据库双适配 |
| 前端转后端 | `frontend/src/pages/Workspace/v2/utils/convertToBackend.ts` | PDF 渲染前的数据格式转换 |
| PDF 渲染 | `backend/routes/pdf.py`、`backend/latex_generator.py` | 后端 JSON → LaTeX → PDF |
| Agent 会话态 | `backend/agent/tool/resume_data_store.py` | 当前会话简历共享状态 |
| Agent 工具 | `backend/agent/tool/*_tool.py` | 读取、展示、分析、编辑、生成简历 |
| 前端 Agent 事件 | `frontend/src/hooks/agent-chat/useToolEventRouter.ts` | 消费工具事件并刷新状态 |

全局规则：

- 简历字段映射不要在调用点临时手写一份，优先复用现有转换函数
- Agent 修改简历后必须同步 `ResumeDataStore`，并通过 SSE 推给前端
- PDF 渲染使用后端格式，不要直接把前端编辑态当成 LaTeX 输入
- section order、富文本、照片、logo 是 PDF 链路高风险点，改动时必须验证

---

## 4. Skill 速查

### 4.0 标准开发流程（主线 · 非平凡改动必走）

任何非平凡的功能 / 改动，按下面三段走，不跳步。每段产出落到 `knowledge-base/` 与领域文档，供跨会话 / 跨终端接续。

**① 设计对齐 · `/brainstorming`** —— 写任何代码前必走
探清需求 → 给 2–3 个方案 → 逐段呈现设计并等用户批准 → 把 spec 写到 `knowledge-base/specs/YYYY-MM-DD-<主题>-design.md` 并 commit。
（覆盖 brainstorming 默认的 `docs/superpowers/specs/`：本项目 spec 一律进 `knowledge-base/`。）

**② 压测 + 沉淀 · `/grill-with-docs`** —— 设计成型后，或实施中概念开始打架时
对方案往死里追问、逐个锁死决策；同时把领域术语落成 `CONTEXT.md`、把关键决策落成 `docs/adr/NNNN-*.md`（见 §4.4）。
> 触发信号（命中任一立刻切，别硬着头皮往下写）：同一个词指代不清 / 某个决策反复动摇 / 跨模块概念对不齐。ResumeAgent 概念多（简历 · Agent · 工具 · 评分 · 对话），这一步专防用词漂移和返工。

**③ 实施 + 验证**
`/writing-plans` 拆实施计划（存 `knowledge-base/plans/`）→ 按计划实现（独立子任务可 `/subagent-driven-development` 并行）→ 实测 → `/verification-before-completion` → `/commit`。

### 4.1 强制节点

| 时机 | 命令 |
|---|---|
| 新功能开发前（设计对齐） | `/brainstorming` |
| 设计压测 + 领域沉淀 | `/grill-with-docs` |
| 复杂功能立项（拆计划） | `/writing-plans` |
| 声称完成前 | `/verification-before-completion` |
| Bug 排查 | `/systematic-debugging` |

### 4.2 场景流程链

| 场景 | 流程 |
|---|---|
| 新功能 | `brainstorming` → `writing-plans` → `feature-dev` → 实测 → `commit` |
| 新页面 / 新组件 | `brainstorming` → `frontend-design` + `react-best-practices` → `web-design-guidelines` 审查 → `webapp-testing` → `commit` |
| 修 Bug | `systematic-debugging` → `bug-fix` → `verification-before-completion` → `commit` |
| Agent 工具 | `brainstorming` → `writing-plans` → 后端工具实现 → SSE 实测 → `verification-before-completion` → `commit` |
| PDF / LaTeX | `systematic-debugging` 或 `writing-plans` → 渲染链路验证 → `verification-before-completion` → `commit` |
| 重构 | `writing-plans` → `simplify` / `clean-code` → `code-review` → `commit` |
| 生成文档 | `/docx` / `/xlsx` / `/pptx` / `/pdf` |

### 4.3 其它常用 Skill

| 命令 | 场景 |
|---|---|
| `/feature-dev` | 引导式功能开发 |
| `/frontend-design` | 新页面 / 组件快速原型 |
| `/ui-ux-pro-max` | 专业配色 / 字体 / 风格决策 |
| `react-best-practices` | 写 React 组件自动参考 |
| `web-design-guidelines` | 前端审查自动参考 |
| `/code-review` | 功能完成后、提交前审查 |
| `/simplify` | 代码简化优化 |
| `/webapp-testing` | Playwright 端到端测试 |
| `/gstack` | 快速无头浏览器 QA、站点验证、截图取证 |
| `/commit` | 规范 Git 提交 |
| `/context7` | 查询第三方库最新文档 |
| `/bug-fix` | 结构化 Bug 修复流程 |
| `/subagent-driven-development` | 并行开发多个独立子任务 |

### 4.4 工程 Skills 配置（mattpocock）

`triage` / `to-tickets` / `to-spec` / `domain-modeling` / `improve-codebase-architecture` 等 skill 依赖下列配置，细节见对应文件：

| 配置项 | 取值 | 详情 |
|---|---|---|
| Issue tracker | GitHub Issues（`WyRainBow/Resume-Agent`），PR 暂不作为 triage 入口 | `docs/agents/issue-tracker.md` |
| Triage 标签 | 默认五个：`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix` | `docs/agents/triage-labels.md` |
| 领域文档 | single-context，`CONTEXT.md` + `docs/adr/`（尚未创建，`domain-modeling` 首次用到时再建） | `docs/agents/domain.md` |

---

## 5. 待开发功能

### 5.1 自然语言简历重构

> 开发前必须调用 `/brainstorming`

- 设计文档：`knowledge-base/specs/2026-03-23-nl-resume-refactor-design.md`
- 实施计划：`knowledge-base/plans/2026-03-24-nl-resume-refactor.md`
- 核心目标：用户用自然语言驱动简历读取、展示、分析、编辑和生成
- 关键链路：`Manus` → 简历工具 → `ResumeDataStore` → SSE → 前端工作台 / 预览

### 5.2 简历评分与分析

> 开发前必须调用 `/brainstorming`

- 设计文档：`knowledge-base/specs/2026-05-20-resume-scoring-design.md`
- 实施计划：`knowledge-base/plans/2026-05-20-resume-scoring-plan.md`
- 核心目标：围绕 JD 匹配、内容完整性、表达质量和结构化建议输出可解释评分

---

## 6. 文档有效性判据

本文件“每次任务都应用”的目标达成时应该看到：

- diff 里没有和需求无关的“顺手优化”
- 没有因过度设计而返工
- 疑问出现在实现前（而不是实现后）
- 新页面第一次上线就有路由、入口和工作台集成，不需要用户提醒补
- 新 Agent 工具第一次上线就有后端注册、SSE 事件和前端消费，不需要用户提醒补
- PDF 功能声称完成前有真实渲染链路验证痕迹
- UI 功能声称完成前都有浏览器实测痕迹
- Skill 强制节点没有被跳过，尤其是 `brainstorming`、`writing-plans`、`verification-before-completion`
- 设计、计划、评审和操作记录进入 `knowledge-base/`，而不是散落到临时目录
