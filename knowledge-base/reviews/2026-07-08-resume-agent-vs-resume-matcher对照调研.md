# ResumeAgent × Resume-Matcher 对照调研与借鉴清单

- **日期**：2026-07-08
- **状态**：调研完成，第一批借鉴（🔥 高价值低难度）已实施
- **分支**：`feature/template-market`（Builder 模板市场所在分支）
- **关联**：
  - [2026-07-07-resume-matcher模板调研与模板市场方案.md](../plans/2026-07-07-resume-matcher模板调研与模板市场方案.md)
  - [2026-07-07-模板市场builder实施计划.md](../plans/2026-07-07-模板市场builder实施计划.md)

---

## 一、当前进度速览（feature/template-market 分支）

### 已落地

| 模块 | 状态 | 位置 |
|---|---|---|
| Builder 子站（/builder + dashboard + settings） | ✅ | `frontend/src/pages/Builder/` |
| 5 套 RM 风模板（swiss-single/modern/latex/clean/vivid） | ✅ | `Builder/templates/` |
| CSS 逐字节对齐 RM | ✅ | `Builder/templates/styles/` |
| 数据适配器（v2 ↔ BuilderResumeData） | ✅ | `Builder/adapter.ts` |
| Swiss/neo-brutalism 换皮（Workspace/编辑区/SidePanel/导入弹窗/my-resumes） | ✅ | 多处 |
| 预览工具栏复刻（缩放/边距/页数 + ghost 按钮 + 真实虚线参考线） | ✅ | `PreviewPanel/index.tsx` |
| 格式控制面板（边距/间距/字号/强调色滑块） | ✅ | `Builder/components/FormattingControls` |
| **分页 CSS（break-inside avoid + break-after avoid + 标题首条目绑定）** | ✅ **已完整** | `Builder/templates/styles/_base.module.css:278-309` |
| window.print 下载 + @page 边距注入 | ✅ | `Builder/index.tsx:166-185` |

### 待做

| 模块 | 状态 | 文档 |
|---|---|---|
| Workspace 接入 Builder 5 套模板（/workspace/html 换 html2pdf → window.print） | ⏳ 设计完成，4 checklist 未勾 | `specs/2026-07-08-workspace接入builder模板系统-design.md` |
| 邮箱发送简历（Gmail + PDF 附件） | ⏳ 仅设计 | `specs/2026-07-08-邮箱发送简历功能-design.md` |

---

## 二、两项目核心架构对照

| 维度 | ResumeAgent | Resume-Matcher |
|---|---|---|
| **后端** | FastAPI（`backend/main.py`，17 router + Agent 反代/直挂） | FastAPI（`apps/backend/app/main.py`，7 router） |
| **前端** | React + Vite（`frontend/`） | Next.js App Router（`apps/frontend/`） |
| **Agent** | Manus in-process（`backend/agent/`，含简历工具链） | 无独立 agent，AI 走服务层 |
| **PDF 渲染** | LaTeX（XeLaTeX 编译）+ HTML（html2pdf，将换 window.print） | **Playwright headless Chromium** |
| **边距处理** | LaTeX 参数 / HTML @page | **Playwright `page.pdf(margin=)` 每页一致** |
| **模板数** | 5 套（Builder，已去双栏两套） | 7 套（含双栏） |
| **LLM** | 直调 DashScope（OpenAI SDK） | **LiteLLM Router（8 provider + 能力探测 + 加密 key）** |
| **简历导入** | glm-ocr + qwen-plus-latest（视觉 OCR + 分段并行） | MarkItDown/pdfminer + LLM（**无 OCR**） |
| **i18n** | 无 | 自研 6 语言（content/UI language 分离） |
| **设计文档** | knowledge-base（plans/specs/reviews） | docs/portable/swiss-design-system（**含 ai-prompt.md**） |

---

## 三、借鉴清单（按价值×可行性排序）

### 🔥 第一梯队：高价值、低难度（本批已实施 ✅）

| # | 借鉴什么 | RM 来源 | ResumeAgent 落点 | 状态 |
|---|---|---|---|---|
| 1 | **Swiss design system ai-prompt**（让 AI 生成 Swiss UI 的系统提示词） | `docs/portable/swiss-design-system/ai-prompt.md` | `knowledge-base/guides/swiss-design-ai-prompt.md`（中文化+项目适配） | ✅ |
| 2 | **分页 CSS 规则**（`.resume-item break-inside avoid` 等） | `globals.css:194-273`、`_base.module.css` print 段 | `Builder/templates/styles/_base.module.css:278-309`（**核查发现已完整**） | ✅ 已存在 |
| 3 | **AI 短语黑名单**（去 AI 味词） | `app/prompts/refinement.py:12-110`（~80 英文词 + 替换映射） | `backend/prompt_templates.py` 两个 rewrite prompt + 新增 `backend/ai_phrase_blacklist.py`（含中文黑名单） | ✅ |

### ⭐ 第二梯队：高价值、中难度（后续做）

| # | 借鉴什么 | RM 来源 | 价值 | 难度 |
|---|---|---|---|---|
| 4 | **边距"每页一致"方案**（Playwright margin 而非 HTML padding） | `app/pdf.py:71-79,291` | 当前 window.print 用 @page，多页边距一致性待验证 | 中 |
| 5 | **LiteLLM 多 provider 封装**（Router 缓存 + 能力探测 + 重试 + secret scrub） | `app/llm.py`（1228 行） | 比裸调 OpenAI SDK 健壮，支持 8 provider | 中 |
| 6 | **加密 API key 存储**（Fernet 加密存 DB） | `app/crypto.py`、`database.py:686` | 比明文 .env 安全 | 中 |
| 7 | **格式控制面板细节**（实时显示生效值 + 紧凑模式倍数精修） | `formatting-controls.tsx` | 用户可视化调密度 | 中 |
| 8 | **模板缩略图**（纯 div 画布局，区分单/双栏/强调色/箭头） | `template-selector.tsx:94-292` | 模板市场预览体验 | 中 |
| 9 | **i18n 轻量方案**（自研无依赖 + content/UI 分离 + parity 测试） | `lib/i18n/*` | 国际化基础 | 中 |

### 第三梯队：按需借鉴

| # | 借鉴什么 | RM 来源 | 价值 |
|---|---|---|---|
| 10 | **对话式 AI 简历向导**（状态机 + 只 merge 当前 section + 进度服务端算） | `services/resume_wizard.py` | 降低冷启动门槛 |
| 11 | **diff-based 简历改进**（生成差分→apply→verify） | `services/improver.py` | 用户可见改动、可回退 |
| 12 | **Kanban 申请追踪**（7 列 + dnd-kit + 列内 renumber） | `components/tracker/` | 求职管理 |
| 13 | **ATS 评分（纯本地）**（keyword + skills + section 加权） | `services/ats.py` | 不烧 token 的评分 |
| 14 | **JSON 容错 coercion**（Pydantic field_validator 规整 LLM 脏输出） | `schemas/models.py:24-108` | LLM 输出防御 |
| 15 | **可视化设计文档体系**（可移植设计系统 + 单模板 spec） | `docs/portable/swiss-design-system/` | 协作与 AI 辅助 |

---

## 四、避坑点（RM 注释明确写明的教训）

1. **PDF 渲染不要用 `wait_until:"networkidle"`**（`pdf.py:145`）：Next.js dev server HMR 会让它永不触发，hang 到超时
2. **边距不能只用 HTML padding**（`pdf.py:291`）：只在第一页生效，必须用 Playwright `page.pdf(margin=)` 或 window.print 的 `@page margin`
3. **三层超时必须对齐**（backend wait_for / next proxyTimeout / client AbortController）：最短的先 abort，只改一层会静默失败
4. **API key 不能泄漏到本地服务器**（`llm.py:318`）：openai_compatible/ollama 跳过 env 默认 key
5. **wizard 不能让 LLM 整体覆盖 resume_data**（`resume_wizard.py:230`）：只 merge 当前 section，防 LLM 擦除已有数据
6. **Swiss 风格 commit light only**（`globals.css:128`）：别搞半成品 dark mode

---

## 五、本批实施记录（🔥 第一梯队）

### 5.1 Swiss design ai-prompt 移植

- **来源**：`reference/projects/Resume-Matcher/docs/portable/swiss-design-system/ai-prompt.md`（Apache-2.0）
- **落点**：`knowledge-base/guides/swiss-design-ai-prompt.md`
- **改造**：中文化 + 适配 ResumeAgent 实际用色（Hyper Blue 已用 / Canvas #F0F0E8 已用）+ 加"何时用"说明
- **用途**：后续让 AI 生成 Swiss/Brutalist 风格组件时作为系统提示词，保证风格一致

### 5.2 分页 CSS 核查

- **结论**：`Builder/templates/styles/_base.module.css:278-309` 已完整覆盖——`.resume-item break-inside: avoid !important`、`.resume-section-title break-after: avoid`、标题+首条目 `break-before: avoid`
- **无需改动**，此项已由 Builder 初始移植时一并抄入

### 5.3 AI 短语黑名单

- **英文部分**：直接移植 RM `refinement.py` 的 `AI_PHRASE_BLACKLIST`（~80 词）+ `AI_PHRASE_REPLACEMENTS`（替换映射）
- **中文扩充**（RM 没有，本项目自加）：~30 个中文 AI 味词（"赋能/抓手/闭环/对标/链路/降本增效/协同/打通/沉淀/复用…"）+ 替换建议
- **落点**：新建 `backend/ai_phrase_blacklist.py`（集中管理），在 `prompt_templates.py` 两个 rewrite prompt 末尾追加"避开 AI 味词"规则块
- **生效路径**：划词润色（`/api/resume/rewrite-text/stream`）+ 字段润色（`/api/resume/rewrite`）都走这两个 prompt，自动生效
- **注意**：已存数据库的自定义 prompt（`backend/data/prompt_templates.json`）不会自动更新，默认模板（首次启动写入）才含黑名单规则。已有用户若改过 prompt，需在后台手动追加

---

## 六、协议说明

Resume-Matcher 采用 **Apache License 2.0**（宽松协议），允许：
- ✅ 商用、修改、分发、闭源
- ✅ 抄录代码与设计到 ResumeAgent

义务（仅 2 条）：
1. 保留 LICENSE 副本与版权声明（抄代码时带上）
2. 注明修改的文件（分发时）

不授予商标权（不可用 "Resume-Matcher" 名号宣传）。

本批借鉴（ai-prompt 文档、AI 黑名单）均为**设计配方/词表**，非可执行代码原样抄录，已在中文化与项目适配后落点。后续若抄录 RM 源码片段（如 LiteLLM 封装、PDF 链路），会在文件头标注来源与协议。
