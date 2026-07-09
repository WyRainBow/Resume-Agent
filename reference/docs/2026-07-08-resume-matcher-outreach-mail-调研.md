# Resume-Matcher「OUTREACH MAIL / 发邮件」功能调研

- **日期**:2026-07-08
- **缘起**:Builder 顶部 tab 里有 `OUTREACH MAIL`(截图),目前是禁用态占位;调研 RM 原版这个功能到底是什么,判断我方是否要做、怎么接。
- **结论先行**:**它不是真发邮件系统,而是「AI 生成一段冷启动求职外联短信/邮件文案」——生成 → 编辑 → 复制,用户自己拿去 LinkedIn / 邮箱发。不涉及任何 SMTP / 收件人 / 发信基础设施。**
- **关联**:[[2026-07-07-resume-matcher模板调研与模板市场方案]]、Builder 交接文档 P2-3(四个 tab 需求未定)

---

## 一、它在产品里的位置

RM 的 Builder(`/builder`)顶部有一排预览 tab:`RESUME / COVER LETTER / OUTREACH MAIL / INTERVIEW PREP / JD MATCH`。
Outreach Mail 与 Cover Letter 是**同一套机制的姊妹功能**,都属于「针对某个 JD 定制简历」之后的下游衍生产物。

| | 求职信 Cover Letter | 外联邮件 Outreach Mail |
|---|---|---|
| 输出 | 正式求职信(较长,max_tokens 2048) | 冷启动外联短信(70-100 字,max_tokens 1024) |
| 语气 | 正式、职业 | 像给老同事发消息,不像陌生人 |
| 用途 | 随简历投递 | LinkedIn / 邮件主动搭讪招聘方 |
| system prompt | "professional career coach and resume writer" | "professional networking coach" |

---

## 二、完整链路(3 个部件)

### 1. 输入:简历 JSON + JD 文本
- **强依赖 JD**(职位描述)。它是「JD 定制流程」的下游:先有一份针对某岗位的简历 + 那段 JD,才能生成外联文案。
- 语言跟随 `content language`(en/es/zh/ja/pt)。

### 2. 后端生成(纯文案,无发信)
- 文件:`apps/backend/app/services/cover_letter.py::generate_outreach_message(resume_data, job_description, language)`
- 流程:取 `OUTREACH_MESSAGE_PROMPT`(可被 `config.json` 的 `outreach_message_prompt` 自定义覆盖)→ `.format(job_description, resume_data=json, output_language)` → `llm.complete(...)` → 返回一段 **纯文本**(`.strip()`)。
- Prompt 写死的规则(`app/prompts/templates.py::OUTREACH_MESSAGE_PROMPT`):
  - 70-100 字,比求职信短
  - 首句引用 JD 里的具体细节(团队/产品/技术挑战),禁止用 "I'm reaching out" / "I saw your posting" 开头
  - 一句话讲最匹配的资历 + 尽量带量化指标
  - 结尾低压力邀约:"Worth a quick chat?" 而非 "I'd love the opportunity to discuss"
  - 禁 "excited about"/"passionate about"、禁占位方括号、禁破折号 `—`
  - 输出纯文本,不要 JSON / markdown

### 3. 前端:一个 textarea + 保存 + 复制
- 文件:`apps/frontend/components/builder/outreach-editor.tsx`(整文件才 106 行)
- UI:头部标题 + 字数统计 + 「保存」+「复制」;主体一个 `<textarea>`;底部一句 tip。
- **没有任何真实发信、没有收件人字段、不连邮箱**。AI 生成的文案填进 textarea,用户可改,一键复制走。

### 数据存储
- 生成结果作为 `outreach_message` 字段挂在那份简历上(`resumes` 表)。
- `PATCH /resumes/{id}` 保存;`resumes.py` 有按需 `generate` 端点重新生成。

---

## 三、对我方(ResumeAgent)的意义与决策点

1. **它是文案生成器,不是邮件系统**——招牌是「AI 写外联话术」,零发信基础设施,落地成本低。
2. **强依赖 JD**:我方 Builder 目前**没有 JD 输入环节**。要做,得先决定 JD 从哪来:
   - 用户手动粘贴一段 JD,还是
   - 接我方已有的「JD 匹配」能力(工作台里已有 JD 分析链路)
3. **不该照抄 RM 后端**:RM 是独立的 `cover_letter.py` 服务 + 独立 prompt 常量。我方已有 **Coco Agent**,更合理的做法是让 Coco 用一个工具/prompt 生成外联文案,而不是新起一套并行后端。这正是 Builder 交接文档 P2-3 标注「四个 tab 需求未定,不要自行发挥」的原因。
4. **姊妹功能一起考虑**:Cover Letter / Outreach / Interview Prep 是同一套「简历 + JD → LLM → 文本/结构化结果」的模式(Interview Prep 输出的是结构化 JSON:role_fit / resume_questions / project_follow_ups / skill_gaps)。若要做,建议一次性想清楚这一族功能的入口与 JD 来源,而不是单点补 Outreach。

---

## 四、关键文件索引(RM 侧,便于将来实现时对照)

| 用途 | 路径 |
|---|---|
| 外联编辑器 UI(textarea+复制) | `apps/frontend/components/builder/outreach-editor.tsx` |
| 外联预览 | `apps/frontend/components/builder/outreach-preview.tsx` |
| 生成服务(cover letter/outreach/title 三合一) | `apps/backend/app/services/cover_letter.py` |
| Prompt 常量 | `apps/backend/app/prompts/templates.py`(`OUTREACH_MESSAGE_PROMPT` / `COVER_LETTER_PROMPT` / `INTERVIEW_PREP_PROMPT`) |
| 路由(生成/保存) | `apps/backend/app/routers/resumes.py`(cover-letter/outreach/title PATCH + on-demand generate) |
| 自定义 prompt 覆盖机制 | `config.json` 的 `outreach_message_prompt` + `PUT /config/feature-prompts`(校验必须含 `{job_description}`/`{resume_data}`/`{output_language}`) |

---

## 五、本轮状态

**仅调研,未动任何代码。** 是否做、怎么接(独立端点 vs 接 Coco、JD 从哪来)属产品决策,待定。
