# Resume-Matcher「AI 构建简历 / Resume Wizard」功能深度探究

- **日期**：2026-07-08
- **目的**：实机走完 AI Wizard（Build with AI wizard）全流程，记录每轮用户输入 + AI 响应，深挖底层实现 + prompt，**并实测发现一个严重 bug**
- **环境**：RM 前端 `localhost:4000` / 后端 `127.0.0.1:4100`，LLM = qwen-plus-latest
- **截图**：`assets/rm-wizard-demo/01-wizard-entry.png`
- **原始数据**：7 轮 API 响应完整保存在 `/tmp/wizard-rounds/round-{0..7,review}.json` + `final-resume.json`

---

## 一、这是什么功能

用户在 dashboard 选「Build with AI wizard」（另一选项是 Upload Resume），进入**对话式简历创建**：AI 逐步提问（intro → contact → summary → workExperience → ...），用户回答，AI 基于回答累积组装出一份 master resume。

与 Enhance Resume（无 JD 内容补全）、Improve/Tailor（JD 定制）完全不同——Wizard 是**从零创建**简历。

---

## 二、实测全流程实录（7 轮 + 发现 bug）

我用一个真实求职者人设（张明，前端应届生）走完全流程。每轮通过 API 调 `/resume-wizard/turn`，完整记录请求与响应。

### 初始状态（action=start）

**AI 第一问** [intro]：
> Hi — I'll help you build your master resume. What's your name, and what kind of role are you going for?

### 第 1 轮：用户报上基本信息

**👤 用户输入**：`我叫张明，大四在读，计算机科学与技术专业，想找前端开发工程师的工作。`

**🤖 AI 响应**：
- 写入：`name=张明`, `title=前端开发工程师（应届）` ✅
- inferred_skills: `['HTML', 'CSS', 'JavaScript']`（从"计算机科学"推断）
- 下一问 [internships]：`你是否有过实习经历？如果有，请提供公司名称、职位、起止时间和主要工作内容。`

### 第 2 轮：用户给联系方式

**👤 用户输入**：`邮箱 zhangming@example.com，电话 13800138000，在深圳，GitHub 是 github.com/zhangming-dev`

**🤖 AI 响应**：
- ❌ **email/phone/location/github 全部没写入！**（review 时报"contact 全空"）
- 下一问仍 [internships]：`请提供你最近一次实习的公司名称、职位名称和实习起止时间`

### 第 3 轮：用户给自我评价

**👤 用户输入**：`熟悉 React/TypeScript 的前端开发，有实习和项目经验，注重用户体验和工程化实践。`

**🤖 AI 响应**：
- ❌ **summary 没写入！**
- inferred_skills: `['React', 'TypeScript']`
- 下一问仍 [internships]

### 第 4 轮：用户给完整实习经历

**👤 用户输入**：`在腾讯 PCG 前端实习了 3 个月（2025.3-2025.6），做的是 QQ 浏览器的活动页面开发，用 React + TypeScript，独立完成 3 个活动页，页面首屏加载从 2.1s 优化到 0.8s。`

**🤖 AI 响应**：
- ❌ **workExperience 没写入！**（信息明明很完整：公司/时间/技术栈/成果都有）
- 下一问 [internships]：`请提供腾讯实习期间的职位名称（例如：前端开发实习生）？` —— **AI 认为缺职位 title，所以没写**

### 第 5 轮：用户给项目经历

**👤 用户输入**：`实习之前在校期间做过一个校园二手交易小程序，微信小程序 + 云开发，有 500 多注册用户，日活 50 左右，我负责前端全部开发和部分云函数。`

**🤖 AI 响应**：
- ❌ **personalProjects 没写入！**
- inferred_skills: `['微信小程序', '云开发', 'JavaScript']`
- 下一问仍 [internships]：`请提供实习经历的具体信息：公司名称、实习岗位、起止时间...` —— **AI 卡在 internships 反复要实习信息**

### 第 6 轮：用户给教育背景

**👤 用户输入**：`深圳大学，计算机科学与技术，本科，2022.9 - 2026.6，GPA 3.6/4.0。`

**🤖 AI 响应**：
- ❌ **education 没写入！**
- 下一问仍 [internships]

### 第 7 轮：用户给技能

**👤 用户输入**：`React、TypeScript、Vue3、微信小程序、Webpack、Vite、Node.js、Git。英语 CET-6。`

**🤖 AI 响应**：
- ❌ **skills 没写入！**
- inferred_skills: `['React', 'TypeScript', 'Vue3', '微信小程序', 'Webpack', 'Vite', 'Node.js', 'Git', '英语 CET-6']`（这个倒是认了）
- 下一问仍 [internships]

### review 阶段：warnings 暴露问题

**⚠️ warnings**：
- `Add at least one contact method (email, phone, or a link).`
- `Add at least one experience, internship, or project.`
- `Education is empty — skip only if that's intentional.`
- `Skills are empty — add tools or technologies you've used.`

### 最终生成的简历

```json
{
  "personalInfo": {"name": "张明", "title": "前端开发工程师（应届）", "email": "", "phone": "", ...},
  "summary": "",
  "workExperience": [],
  "education": [],
  "personalProjects": [],
  "additional": {"technicalSkills": [], ...}
}
```

**只有 name 和 title 被写入，其余全空。**

---

## 三、🔥 实测发现的严重 Bug

### 现象
用户给了完整信息（联系方式/自我评价/实习/项目/教育/技能），AI **几乎全部丢弃**，只写入了第 1 轮的 name 和 title。

### 根因分析

**Bug 1：AI 卡在 internships section 反复追问，不切到其他 section**

从第 2 轮开始，AI 的 `next_question.section` 一直是 `internships`，连续 6 轮没变。即使用户第 4 轮给了完整腾讯实习、第 5 轮给了项目、第 6 轮给了教育、第 7 轮给了技能，AI 仍在问 internships。

根因：第 4 轮用户说"在腾讯 PCG 前端实习"，AI 认为缺职位 title 就不写 workExperience，反而追问 title。用户后续回答（项目/教育/技能）因为 AI 的 section 没切换，被 `_merge_section` 的"只动当前 section"逻辑丢弃了——**这是防擦除 merge 的副作用**：用户答非所问（AI 问 internships，用户答了 education），merge 层把答案当 internships 处理，但 LLM 又没输出 internships 数据，所以全空。

**Bug 2：contact/summary 的数据丢失**

第 2 轮用户给了完整联系方式，但 AI 当前 section 是 internships（不是 contact），所以 merge 层按 internships 处理这些答案——联系方式字段在 internships 的 merge 里根本不被读取，丢失。同理第 3 轮 summary。

**Bug 3：LLM 对"信息完整度"判断过严**

用户第 4 轮"在腾讯 PCG 前端实习了 3 个月...用 React + TypeScript，独立完成 3 个活动页"——这已经足够写一条 workExperience（title 可推断为"前端开发实习生"，从"前端实习"得出）。但 LLM 遵循 prompt 的 `If a needed fact is missing or vague, do NOT guess — ask for it`，认为缺 title 就不写。

### 教训（对 ResumeAgent）

1. **"只动当前 section"的 merge 机制是把双刃剑**——防擦除的同时，当用户"答非所问"（AI 问 A 用户答 B）时会丢数据。RM 这里没有"用户答案跨 section 识别"能力
2. **AI 的 section 切换逻辑要更主动**——检测到当前 section 已有足够信息就该切下一个，而不是无限追问细节
3. **prompt 的"不猜"规则要加例外**——像"前端实习"→"前端开发实习生"这种合理推断应该允许
4. **review 的 warnings 是好的兜底**——至少告诉用户"啥都没填"，避免静默失败。但应该在前端实时检测并提示，而不是等 review

---

## 四、底层代码实现

### 4.1 文件清单

| 层 | 文件 | 行数 |
|---|---|---|
| 后端 service | `apps/backend/app/services/resume_wizard.py` | 447 |
| 后端 router | `apps/backend/app/routers/resume_wizard.py` | 123 |
| 后端 prompt | `apps/backend/app/prompts/resume_wizard.py` | 52 |
| 后端 schema | `apps/backend/app/schemas/resume_wizard.py` | 115 |
| 前端 page | `apps/frontend/components/resume-wizard/resume-wizard-page.tsx` | 309 |
| 前端 live preview | `apps/frontend/components/resume-wizard/live-preview.tsx` | 145 |

### 4.2 状态机（state 整体 round-trip，无 session id）

```python
class ResumeWizardState(BaseModel):
    step: "intro" | "question" | "review" | "complete"
    resume_data: ResumeData              # 累积的简历草稿
    current_question: {text, section}    # 当前问的问题
    history: [{question, answer, resume_data_before, section}]  # 回滚用快照
    asked_count: int                     # 已问次数（成本上限计数）
    inferred_skills: [str]               # 上一轮推断的技能（绿色高亮）
    is_complete: bool                    # AI 的"够了"信号（仅提示）
    progress: {current, total}           # 服务端算，不信 LLM
    warnings: [str]                      # review 步骤提醒
```

**设计**：state 每轮 request/response 整体来回，无服务端 session 存储。客户端 localStorage 自动草稿。

### 4.3 两个端点

- `POST /resume-wizard/turn`：单轮推进。action = start/answer/skip/back/review
- `POST /resume-wizard/finalize`：转 master resume。409 检查（已有 master）、atomic 创建、title 同次设定、创建后 is_master 失败立即删除

### 4.4 `run_ai_turn()` 单轮 7 步

1. 算 section + 序列化草稿 JSON
2. 清洗答案：`_scrub_secrets(_sanitize_user_input(answer))`（先去注入再脱敏 key）
3. 拼 prompt + 调 `complete_json(max_tokens=8192, schema_type="resume")`
4. 解析 + `_merge_section`（只动当前 section，entry 按签名 union）
5. intro 兜底抽名字（`extract_intro_name` 正则）
6. `_assign_entry_ids`（LLM 不返回 id，按位置补）
7. 组装下一 state（asked_count++、push history、`_next_question`）

### 4.5 防擦除 merge（最精巧，但也是 bug 根源）

**`_merge_section`（service 230-306）**：只动当前 section，其余 `existing.model_copy(deep=True)` 原样。

**`_merge_entries`（183-207）**：列表型 entry 按内容签名 union（不按 id，因为 wizard id 默认 0）：
- 签名函数：`_experience_key = (title.casefold(), company.casefold(), years.casefold())`
- LLM 没提的已有 entry 保留，同签名替换，新签名追加

**问题（实测验证）**：当 AI section 卡在 internships 但用户答了 education/skills，merge 层按 internships 处理，education/skills 数据被丢弃。

---

## 五、Prompt 全文（52 行，无省略）

文件：`apps/backend/app/prompts/resume_wizard.py`

```
You are a truthful resume-writing assistant guiding a user through building a general
master resume, ONE question at a time.

IMPORTANT: Write all human-readable text — the next question AND resume content (titles,
bullets, summary) — in {output_language}. But keep STRUCTURAL values in their original form:
"next_question.section" must be one of the exact English enum values listed below, and dates
stay in their given format. Do NOT translate section keys or dates.

You are working on this section right now: {current_section}

TRUTHFULNESS RULES (non-negotiable):
1. Never invent employers, job titles, dates, degrees, certifications, awards, metrics, tools, or skills.
2. Turn the user's OWN facts into strong, concise resume content. Do not add facts they did not give.
3. If a needed fact is missing or vague, do NOT guess — ask for it in "next_question".
4. Preserve existing draft data unless the user clearly changes it.
5. Build a GENERAL master resume, not a job-specific tailored one.

CONTENT SHAPE:
- Work and internship entries: aim for 3 bullets when enough facts exist.
- Project entries: aim for 2 bullets when enough facts exist.
- Skills come only from facts the user gave or existing draft data.

ADAPTIVE FLOW:
- Read the CURRENT DRAFT and the user's ANSWER. Update ONLY the {current_section} part of the resume.
- Then choose the most useful NEXT question and set "next_question.section" to the section it belongs to.
- Valid section values: intro, contact, summary, workExperience, internships, education, personalProjects, skills, review.
- Set "is_complete" to true ONLY when the resume is a solid general master resume (name + at least one
  substantive experience or project + some skills).

CURRENT DRAFT JSON:
{resume_json}

USER ANSWER:
{answer_text}

Output ONLY this JSON object and nothing else:
{
  "resume_data": {
    "personalInfo": {"name": "", "title": "", "email": "", "phone": "", "location": "", "website": "", "linkedin": "", "github": ""},
    "summary": "",
    "workExperience": [],
    "education": [],
    "personalProjects": [],
    "additional": {"technicalSkills": [], "languages": [], "certificationsTraining": [], "awards": []},
    "sectionMeta": [],
    "customSections": {}
  },
  "next_question": {"text": "Your next concise question", "section": "workExperience"},
  "inferred_skills": ["Skill"],
  "is_complete": false
}
```

### Prompt 设计要点

1. **"ONE question at a time"**：强制每轮只问一个
2. **"Update ONLY the {current_section} part"**：配合 merge 只动当前 section
3. **5 条 TRUTHFULNESS RULES**：不编造/只用用户事实/缺了就问/保留已有/通用简历非定制
4. **CONTENT SHAPE**：工作 3 bullets、项目 2 bullets（"when enough facts exist"）
5. **`is_complete` 判据**：name + ≥1 substantive experience/project + some skills
6. **多语言**：`{output_language}` 用全称（"Chinese (Simplified)"），section key/日期不翻译

### Prompt 的弱点（实测暴露）

- 规则 3 "If a needed fact is missing, do NOT guess — ask" **过严**——"前端实习"推断"前端开发实习生"算合理推断不算 guess，但 LLM 死板执行导致死循环
- "Update ONLY the {current_section}" 配合 merge 层导致**跨 section 信息丢失**——用户一次性给多 section 信息时，非当前 section 的部分被丢弃
- 没有"检测到信息已充足就主动切 section"的指令——LLM 倾向于在当前 section 死磕细节

---

## 六、前端关键设计

### 实时预览 + inferred_skills 绿色高亮

`live-preview.tsx`：
- `skills = dedupeSkills([...technicalSkills, ...inferredSkills])`
- inferred_skills 用 `text-green-700 border-green-700` + `✓` 高亮
- 去重用 `toLowerCase()` 对齐后端 `casefold()`

### 每轮只问一个问题

`question-card.tsx`：一次显示一个文本框 + Continue/Skip/Review/Back 按钮。section 是元数据（这一问属于哪个区域），不是 UI 步骤。

### localStorage 草稿

`resume_wizard_draft` key，每次 state 变化写盘。`normalizeDraftResumeData` 防御性 coercion 防止旧版草稿 schema 漂移导致崩溃。

---

## 七、对 ResumeAgent 的参考价值

### ResumeAgent 当前没有这个功能
搜索 `next_question`/`inferred_skills`/`run_ai_turn`/`wizard` 全部 0 命中。现有简历能力（`cv_reader_tool`/`cv_editor_agent_tool`/`generate_resume_tool`）都是对**已有**简历操作，没有从零对话式构建。

### 值得借鉴（P0 必须借鉴）

1. **防擦除 merge 机制**——但**要修复 RM 的 bug**：当用户答案包含非当前 section 的信息时，应该让 LLM 跨 section 提取，或在前端提示"你答的内容属于别的区域"
2. **绝不信任 LLM 状态**——progress 服务端算、section 用 `valid_section()` 钳制、id 服务端补、next_question 有 gap 兜底
3. **state round-trip 在客户端**——无 session 存储，简单可水平扩展
4. **成本护栏**——硬上限 15 问，超了跳 review

### 必须避免的坑（RM 实测暴露）

1. **不要让 AI 卡在一个 section 死循环**——加"连续 N 问同一 section 就强制切换"的兜底
2. **prompt 的"不猜"规则要放宽**——允许合理推断（"前端实习"→"前端开发实习生"）
3. **merge 不能只看当前 section**——用户答案可能跨 section，要么让 LLM 提取全部，要么前端拆分
4. **review warnings 要前置**——别等用户走完 7 轮才发现啥都没存

### Prompt 可复用部分

- 5 条 TRUTHFULNESS RULES（但规则 3 需放宽）
- "ONE question at a time"、"GENERAL master resume, not job-specific"
- `is_complete` 判据
- schema 示例

---

## 八、协议说明

截图与 API 数据来自本地运行的 Resume-Matcher（Apache-2.0），仅内部调研。Prompt 全文引用属合理使用，已标注来源。
