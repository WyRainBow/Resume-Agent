# CODEX.md

用中文与我交互。

## 项目概览

**Resume-Agent** 是一个面向中文求职场景的 AI 简历生成、编辑、分析与导出系统。

- 仓库形态：`frontend/` + `backend/` 单仓库
- 后端入口：`backend/main.py`
- 前端入口：`frontend/`
- 核心约束：Agent 已合并进 `backend/agent/`，运行在主后端进程内，默认没有独立 `9100` 端口 Agent 服务
- 主服务端口：后端 `9000`，前端 Vite 默认 `5173`
- 主要用户：产品、研发、测试、简历编辑和求职场景使用者
- 交互语言：中文

在开始任何较大任务前，先通过仓库事实理解当前实现，不要凭空假设。`AGENTS.md` 是跨 Agent 的共享基线；本文件是 Codex 的执行规则。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + lucide-react + Radix Slot + TipTap |
| 后端 | Python + FastAPI |
| 数据层 | SQLAlchemy，默认 SQLite，可通过环境变量切换数据库 |
| 认证 | JWT + passlib/bcrypt |
| Agent | Manus + `backend/agent/` 工具系统 + SSE |
| PDF | LaTeX / XeLaTeX + `latex-resume-template/` |
| AI 能力 | DeepSeek / DashScope、智谱、豆包等现有 provider |
| 存储 | 数据库、本地缓存、腾讯 COS |
| 其它 | TTS、ASR、语义搜索、LeetCode 等现有模块 |

新增依赖或调整技术选型前，必须先确认仓库里是否已有等价实现。

## 项目结构

```text
backend/
  main.py              FastAPI 应用入口，注册主后端路由和内嵌 Agent 路由
  routes/              API 路由：resume、pdf、auth、resumes、agent 等
  services/            PDF 解析、评分、嵌入、LeetCode 等业务服务
  agent/               Manus Agent、工具系统、SSE 事件和会话上下文
  models.py            Pydantic DTO + SQLAlchemy ORM 模型
  database.py          数据库 URL、engine、SessionLocal、get_db
  latex_*.py           LaTeX 生成与编译
  tests/               后端测试

frontend/
  src/App.tsx          前端路由入口
  src/pages/           Landing、Workspace、AgentChat、Dashboard、LeetCode 等页面
  src/pages/Workspace/ 简历工作台，v2 是当前主工作台
  src/services/        API、存储、鉴权、TTS、PDF 配置等客户端服务
  src/contexts/        AuthContext、ResumeContext、EnvironmentContext
  src/hooks/           通用 hooks 与 agent-chat hooks
  src/components/      通用组件、聊天组件、PDFEditor 等
  vite.config.ts       Vite 配置，开发期 `/api` 代理到后端

latex-resume-template/ LaTeX 简历模板资源

knowledge-base/
  specs/               设计规格：YYYY-MM-DD-<topic>-design.md
  plans/               实施计划：YYYY-MM-DD-<feature>.md
  reviews/             Review / 操作记录
```

## 工作原则

### 1. 先看仓库，再做决定

- 先读相关入口、类型、文档、脚本，再决定实现方式
- 搜索优先使用 `rg` / `rg --files`
- 能从仓库中确认的事实，不要问用户
- 只在高风险且无法从仓库中推断时，才向用户确认
- 新增页面、路由、Agent 工具、PDF 行为时，先找一个同类实现作为参照

### 2. 主路径优先

- 优先修正主路径逻辑，不要堆叠兜底分支掩盖问题
- 必填数据在类型或 schema 上就定义为必填，不要滥用可选字段
- 只在系统边界做输入校验，例如请求体、上传文件、外部 AI 响应、数据库读取、跨服务响应
- 已存在的产品级 fallback 要尊重，例如 `resumeStorage` 的本地缓存兜底；不要把它扩散成新的绕路系统

### 3. 最小改动，完整闭环

- 以完成用户目标为导向，不做无关重构
- 改动要覆盖实现、验证、必要文档更新
- 不移动、不重命名文件，除非任务明确要求
- 若发现与当前任务冲突的未知改动，先停下并说明冲突点

### 4. 证据优先

- 结论尽量基于代码、命令结果、测试、截图或文档事实
- 区分“已验证事实”和“推断”
- 审查、排障、发版判断都要给出依据
- 能运行的验证要运行；不能运行时说明具体原因

## 新增研发规范

以下规范作为默认研发行为准则，与项目既有约束一起生效。权衡取向偏谨慎而非偏速度；若任务非常简单，可自行判断是否简化执行。

### 1. 编码前先思考

不要想当然，不要掩饰不确定性，要明确说出假设与取舍。

- 实现前先明确说明自己的假设；如果不确定，就先确认
- 若需求存在多种解释，先列出解释，不要静默选一种
- 如果存在更简单的方案，要直接指出；必要时要对复杂方案提出异议
- 如果有不清楚的地方，就停下来说明疑点，不带着模糊理解直接实现

### 2. 简单优先

只写解决当前问题所需的最小代码，不做推测性设计。

- 不添加未被要求的功能
- 不为单次使用场景引入抽象
- 不加入未被要求的“灵活性”或“可配置性”
- 不为理论上不会发生的情况补无意义的错误处理
- 优先复用现有 service、hooks、工具、路由和数据转换函数

判断标准：如果一个资深工程师会认为实现过度复杂，就继续简化。

### 3. 外科手术式修改

只改必须改的部分，只清理自己改动带来的影响。

- 不顺手“优化”相邻代码、注释或格式
- 不重构没有坏掉的内容
- 尽量匹配现有风格，即使自己有不同偏好
- 如果发现与当前任务无关的死代码，可以提，但不要擅自删除
- 如果自己的改动产生了未使用的导入、变量或函数，要一并移除
- 不删除原本就存在、但与本次任务无关的死代码，除非用户明确要求

判断标准：每一行变更都应能直接追溯到用户当前请求。

### 4. 目标驱动执行

先定义可验证的成功标准，再围绕标准实现和验证。

- “增加校验”应转化为“先明确非法输入和期望响应，再让检查通过”
- “修复 bug”应转化为“先复现问题，再让复现路径通过”
- “重构 X”应转化为“确认重构前后关键行为一致”

多步骤任务使用以下格式先给出简要计划：

```text
1. [步骤] -> verify: [检查方式]
2. [步骤] -> verify: [检查方式]
3. [步骤] -> verify: [检查方式]
```

强成功标准意味着可以自主闭环推进；弱成功标准只会让实现不断返工。

## 编码与修改约束

### FastAPI / 后端

- 应用入口是 `backend/main.py`
- 启动命令：`python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000`
- 新增路由前先检查 `backend/routes/`、`backend/routes/__init__.py` 和 `backend/main.py`
- 数据库会话使用 `get_db()`，不要绕开 `backend/database.py`
- 模型集中在 `backend/models.py`，注意 `models` / `backend.models` 的兼容别名，不要引入第二套 mapper
- 修改鉴权接口时同步检查 `backend/auth.py`、`backend/middleware/auth.py`、前端 `AuthContext` 和 `authService`

### React / Vite 前端

- 保持现有 React + TypeScript + Vite + Tailwind 体系，除非用户明确要求改风格
- 前端入口是 `frontend/src/App.tsx`
- 当前主工作台是 `frontend/src/pages/Workspace/v2/index.tsx`
- API base 走 `frontend/src/lib/runtimeEnv.ts`；开发环境默认同源 `/api`，由 Vite 代理到 `127.0.0.1:9000`
- 简历存储通过 `frontend/src/services/resumeStorage.ts`，不要绕过本地 / 数据库双适配器
- 新页面和新组件优先复用现有布局、表单、工作台和状态管理模式
- 注意移动端、可访问性、加载态、空态、错误态和文本溢出

### Agent / Manus

- `Manus` 是 Python 类，不是独立服务，文件：`backend/agent/agent/manus.py`
- Agent 路由默认走 `backend.agent.web.routes`，挂载到 `/api/agent`
- `AGENT_BACKEND_BASE_URL` 在 `.env` 中应保持注释或不用，除非明确恢复外部 Agent 服务
- 简历工具通过 `ResumeDataStore` 共享当前会话简历
- 工具返回统一使用 `ToolResult`；需要给前端结构化数据时，放入 `ToolResult.system` JSON
- SSE 事件如 `tool_result`、`resume_updated`、`resume_patch` 必须保持前后端一致
- 不要破坏前端 `useToolEventRouter` 对 `show_resume`、`cv_reader_agent`、`cv_editor_agent`、`generate_resume`、`resume_updated` 的事件约定

### PDF / LaTeX

- JSON 到 PDF 主链路：前端 ResumeData -> `convertToBackendFormat` -> `/api/pdf/render/stream` -> `json_to_latex` -> XeLaTeX
- 修改 PDF 行为时必须关注 section order、HTML 富文本转 LaTeX、中文字体、照片和 logo
- 不要把 PDF 渲染缓存、远程渲染或 admin 代理逻辑混入普通渲染链路，除非任务明确要求
- 出错时保留 trace 信息，优先复用已有 `X-PDF-Trace-*` 头和日志格式

### 编辑方式

- 搜索优先用 `rg`
- 手工改文件使用 `apply_patch`
- 小范围人工改动保持精确，不要顺手改无关内容
- 不要覆盖或回退用户未要求处理的现有改动
- 不运行破坏性 Git 命令，例如 `git reset --hard` 或 `git checkout --`，除非用户明确要求

## 输出规范

### 计划类请求

- 先做非破坏性探索
- 产出 decision-complete 的计划
- 用 `<proposed_plan>` 包裹最终计划
- 计划要包含验证方式，不只列实现步骤

### Review 类请求

- Findings first
- 先列问题，再写简短总结
- 每条问题尽量带文件位置和触发场景
- 重点关注 bug、回归风险、接口契约、缺失测试和数据流断点

### 实施类请求

- 默认直接执行，不只停留在建议
- 先说明要做什么，再改文件
- 改完后说明结果、验证情况、剩余风险
- 如果验证无法运行，说明具体原因

### QA / 发版类请求

- 分清楚哪些已经验证，哪些还没验证
- 不要把“推测可用”写成“已经可用”
- 对前端、后端、Agent、PDF 四类链路分别说明覆盖情况

## 仓库文档

优先参考这些文件和目录：

- `AGENTS.md`：跨 Agent 共享项目规则
- `CLAUDE.md`：Claude Code 项目规则
- `CODEX.md`：Codex 项目规则
- `knowledge-base/specs/`：设计规格
- `knowledge-base/plans/`：实施计划
- `knowledge-base/reviews/`：评审和操作记录

仓库约定：

- `knowledge-base/` 是项目设计、计划、评审和操作记录的主要位置
- `knowledge/` 是本地旧目录，已被 Git 忽略，不作为主要项目文档库
- `docs/` 不是本项目本地知识沉淀的主位置
- 根目录 `README.md` 可能被忽略，不要仅凭 Git 状态判断文档是否被跟踪

当实现影响架构、接口、Agent 流程、PDF 链路或用户流程时，同步更新 `knowledge-base/`。

## Codex Skills

本仓库当前没有 `.codex/skills/` 目录；Codex 使用当前会话可用的 Skills。若后续新增仓库级 `.codex/skills/`，优先读取仓库内说明。

默认路由：

- 新需求、范围讨论、价值判断：`idea-refine` / `spec-driven-development`
- 实施前的落地方案：`planning-and-task-breakdown` / `incremental-implementation`
- 页面、交互、视觉、体验问题：`frontend-ui-engineering`
- 浏览器验证和前端实测：`browser-testing-with-devtools`
- 代码审查、合并风险：`code-review-and-quality`
- 测试、回归、验收：`test-driven-development`
- Bug、异常、根因分析：`debugging-and-error-recovery`
- API 契约、模块边界：`api-and-interface-design`
- 安全、鉴权、密钥、外部输入：`security-and-hardening`
- 项目规则、上下文、长期记录：`context-engineering` / `documentation-and-adrs`
- 上线前检查、发版结论：`shipping-and-launch`

进一步说明见：

- `AGENTS.md`
- `CLAUDE.md`
- `knowledge-base/specs/`
- `knowledge-base/plans/`

## 与 Claude 体系的关系

- `CLAUDE.md` 保留给 Claude Code 使用
- `CODEX.md` 保留给 Codex 使用
- `AGENTS.md` 是共享底线，项目事实必须和两者保持一致
- 可以复用 Claude skill 的思路、清单、领域知识
- 不要在 Codex 中直接照搬 Claude 专属 preamble、命令习惯或运行时注入逻辑

## 常见工作流

### 新功能

`idea-refine` / `spec-driven-development` -> `planning-and-task-breakdown` -> 实现 -> 相关测试 / 构建 -> 必要时更新 `knowledge-base/`

### UI / UX 调整

`frontend-ui-engineering` -> 实现 -> `cd frontend && npm run build` -> 浏览器实测

### Bug 修复

`debugging-and-error-recovery` -> 复现 / 定位根因 -> 实现 -> 针对性验证

### Agent 工具

读 `backend/agent/agent/manus.py` + `backend/agent/tool/` + `backend/agent/web/routes/` -> 实现 -> 验证 SSE 事件 -> 检查前端 `useToolEventRouter`

### PDF 导出

读 `convertToBackendFormat` -> `renderPDFStream` -> `backend/routes/pdf.py` -> `json_to_latex` -> 实现 -> 验证真实渲染链路

### 合并前审查

`code-review-and-quality`

### 上线前检查

`shipping-and-launch`

## 提交与风险控制

- 除非用户明确要求，不要主动做破坏性 git 操作
- 不要用 `git reset --hard`、`git checkout --` 回退用户改动
- 不修改无关文件，不移动或重命名文件
- 不把密钥、token、Cookie、私有 URL 写入文档或代码
- 若需要提交，提交信息应直接描述结果，不写空泛措辞
- 如果当前目录不是 Git 仓库，要明确说明无法给出 Git diff / commit

## 默认质量门槛

完成任务前，至少确认：

- 需求是否真的落到了代码或文档上
- 关键路径是否经过验证
- 是否引入了新的类型、权限、状态、Agent 事件或部署风险
- 是否影响简历数据流、PDF 链路、登录态或缓存策略
- 是否需要补充设计文档、实施计划、评审记录或操作记录
- 是否保持了 `AGENTS.md`、`CLAUDE.md`、`CODEX.md` 中项目事实一致
