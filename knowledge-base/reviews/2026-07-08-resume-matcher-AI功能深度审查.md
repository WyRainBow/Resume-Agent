# Resume-Matcher AI 功能深度审查与借鉴清单

- **日期**：2026-07-08
- **状态**：审查完成，借鉴清单已排序
- **范围**：只读审查 RM 全部 AI 功能，提炼对 ResumeAgent 的参考价值
- **关联**：[2026-07-08-resume-agent-vs-resume-matcher对照调研.md](2026-07-08-resume-agent-vs-resume-matcher对照调研.md)（架构对照）

---

## 一、RM AI 功能全景

| 功能 | 实现文件 | 核心机制 | ResumeAgent 现状 |
|---|---|---|---|
| **JD 匹配定制** | `services/improver.py`（1514 行） | **diff-based**（LLM 出变更列表，本地 4 闸门审核） | ❌ 无（agent 整体改写） |
| **多轮精炼** | `services/refiner.py`（702 行） | 三 pass：关键词注入(LLM) + 去AI味(本地) + master对齐(强制) | ❌ 无 |
| **求职信/外联** | `services/cover_letter.py`（168 行） | 极具体 prompt（字数/段落/禁用词/抽公司名） | ❌ 无 |
| **面试准备** | `services/interview_prep.py`（128 行） | 5 结构化字段 + truncation 防 prompt 超长 | ❌ 无 |
| **关键词抽取+技能补全** | `improver.py` | **两步法**（LLM 提议 + 本地校验分类） | ❌ 无 |
| **对话式向导** | `services/resume_wizard.py`（447 行） | 只 merge 当前 section + 按签名 union + 进度服务端算 | ❌ 无 |
| **简历解析** | `services/parser.py`（176 行） | MarkItDown 抽文本 + LLM 转 JSON + **正则回填日期** | glm-ocr + 分段并行 |
| **ATS 评分** | `services/ats.py`（217 行） | **纯本地**三维加权 + recommendations | ❌ 无 |
| **LLM 基础设施** | `app/llm.py`（1227 行） | LiteLLM Router + JSON mode 探测/降级/重试/截断检测 | 直调 GLM |
| **eval 框架** | `tests/evals/` | 确定性 scorer + golden case + LLM judge | ❌ 无 |

---

## 二、五大核心设计（按借鉴价值排）

### 设计 1：Diff-based 简历定制（🔥 最值得借鉴）

**核心思想**：让 LLM 输出"变更列表"而非整份重写。原简历作基准不变，每条变更过四道闸门才生效。

**为什么不用整体重写**：整体重写让 LLM 输出整份简历 JSON，会丢字段、改名字、改日期、幻觉技能。Diff 模式可审计、可回滚、可预览。

**四件套**（`improver.py`）：
1. `generate_resume_diffs()` (`:506`)：LLM 生成 `changes` 列表，prompt 明确 path 白名单 + `original` 字段必须逐字匹配原文
2. `apply_diffs()` (`:226`)：每条变更过 4 闸门——
   - path 在白名单 `_ALLOWED_PATH_PATTERNS`（`:80`）
   - 不在黑名单（personalInfo/customSections/sectionMeta + 叶子字段 name/id/company/years 等）
   - path 能解析到真实值 `_resolve_path`
   - replace 动作的 `original` 与实际值逐字匹配 `_verify_original_matches`
3. `verify_diff_result()` (`:430`)：**零 LLM 成本本地质检**——空结果/section 数量变化/身份字段被改/字数膨胀超 1.8x/**虚构指标检测**（`\d+%|\d+x|\$\d+` 正则抓 original vs value 差集）
4. 四种 action：`replace` / `append` / `reorder`（含 salvage 逻辑）/ `add_skill`（必须命中已校验的技能目标集）

**防幻觉铁律** `CRITICAL_TRUTHFULNESS_RULES`（`templates.py:203`）：9 条，按定制档位定制第 7 条——
- 不加原文未提的技能/工具/认证
- 不虚构数字成就
- 不升级职级（Junior→Senior）
- 不延长日期/改时间线
- **绝不删除**已有技能/认证/语言/奖项，可按相关性重排

**防 prompt injection** `_sanitize_user_input()` (`:28`)：8 个正则（ignore previous/disregard above/forget everything/new instructions:/system:/`<system>`/`[INST]`）替换成 `[REDACTED]`。JD 和用户输入都过这道。

**落地建议**：定义 ResumeAgent 的 path 白名单（`experience[i].details[j]` / `skills` / `selfEvaluation` 等），实现 `apply_diffs`/`verify_diff_result`，prompt 让 LLM 输出 `{path, action, original, value, reason}`。改造入口：`backend/agent/agent/cv_editor.py`（264 行）。

---

### 设计 2：LLM 工程基础设施（🔥 生产环境刚需）

**`complete_json()` 的健壮性设计**（`llm.py:1070`）：
- **JSON mode 探测** `_supports_json_mode` (`:702`)：查 LiteLLM registry 是否支持 `response_format`；上游 400 拒绝时 `_is_response_format_unsupported` (`:734`) 降级为 prompt-only
- **app 层重试**：`JSONDecodeError` 重试时追加 hint "Output ONLY valid JSON"；**截断检测** `_appears_truncated` (`:807`) 按 schema 类型判（resume 检空数组、interview_prep 检 5 必需 key），命中则重试追加 "Output the COMPLETE JSON"
- **重试升温**：`[0.1, 0.3, 0.5, 0.7]` 逐次提高
- **JSON 提取** `_extract_json` (`:985`)：strip `<think>` → 去 markdown code block → 大括号深度计数找匹配 `}`（处理字符串内转义），MAX_RECURSION=10、MAX_SIZE=1MB

**其他**：
- `_strip_thinking_tags()` (`:971`)：去 `<think>...</think>`（deepseek-r1/qwq）
- `get_safe_max_tokens` (`:762`)：查 registry `max_output_tokens`，`min(requested, model_limit)`
- `_supports_temperature` (`:871`)：特例处理（claude-opus-4 废弃 temperature、kimi-k2.6 只允许 1.0）
- Router 缓存按 config fingerprint 重建（`hash(provider|model|hash(api_key)|api_base)`）
- `RetryPolicy`：429/500/timeout 重试，Auth/BadRequest 不重试；`disable_cooldowns=True`（单 deployment cooldown 会黑掉后端）
- `_scrub_secrets()` (`:286`)：三个正则（sk-/AIza/Bearer）redact，用于 health check error 和 wizard 用户输入

**落地建议**：在 `backend/agent/llm.py` 加 `complete_json` 封装，复用现有 GLM 调用但加截断检测和重试。这是 ResumeAgent 直连 GLM 最缺的一层。

---

### 设计 3：去 AI 味双保险（🔥 补 ResumeAgent 短板）

**RM 是 prompt 规劝 + 本地替换双保险**，ResumeAgent 现在只有 prompt 规劝。

**RM 的本地后处理** `remove_ai_phrases()` (`refiner.py:233`)：
- 递归遍历简历所有字符串字段
- 对 `AI_PHRASE_BLACKLIST` 做大小写不敏感正则替换，用 `AI_PHRASE_REPLACEMENTS` 映射（spearheaded→led, utilized→used, in order to→to）
- **JD 保护**：出现在 JD 里的词跳过（JD 可能就用了 "robust"）

**对比 ResumeAgent**：`backend/ai_phrase_blacklist.py`（已建）只把规则块塞 prompt 让 LLM 规避，没本地兜底。LLM 不一定听劝。

**落地建议**：扩 `ai_phrase_blacklist.py` 加 `remove_ai_phrases()` 本地后处理函数，在 `/api/resume/rewrite-text/stream` 返回前过一遍，加 JD 保护逻辑。

---

### 设计 4：对话式向导的 section merge（防擦除）

**核心**：LLM 即便返回完整 resume_data，也只取当前 section 的 key，其余 section 保持原样。

**`_merge_section()`** (`resume_wizard.py:230`)：
- 用 `"workExperience" in raw_updated` 判断 LLM 是否动了这个 key
- 只 merge 当前 section，其余 `existing.model_copy(deep=True)` 原样

**`_merge_entries()`** (`:183`)：列表型 section **按内容签名 union，不按 id**（wizard entry id 默认 0）。签名 = `(title, company, years)` casefold。LLM 省略的已有 entry 保留，LLM 回显的同签名 entry 原位替换，新 entry 追加。

**进度服务端算** `compute_progress()` (`:148`)：`total = min(15, max(8, asked_count + ...))`，注释明说"Server-side progress so the bar never trusts the model"——LLM 报的 `is_complete` 只是建议显示 Review 按钮，不自动 finalize。

**`extract_intro_name()`** (`:100`)：三组正则（I'm/My name is/Name's）兜底抽名字，**不用 re.IGNORECASE** 而显式 `[Mm]/[Nn]`——IGNORECASE 会让 `[A-Z]` 匹配小写产生假阳性（"domain name facebook is"→"facebook is"）。

**落地建议**：ResumeAgent agent 多轮编辑简历时可借鉴这套 merge；若做对话向导直接照搬。

---

### 设计 5：Eval 框架（prompt 迭代回归保护）

**三层架构**（`tests/evals/`）：

1. **确定性 scorers**（免费、全环境跑）`scorers.py`：
   - `sections_preserved`：原非空 section 定制后仍非空
   - `no_fabricated_employers`：tailored 出现但 original 没有的公司名（虚构雇主）
   - `jd_keywords_present`：JD 关键词命中率
   - `is_valid_resume`：仍过 schema
   - `personal_info_unchanged`：personalInfo 字节级一致

2. **Golden cases** `golden/cases.py`：2 个 case，每个含 `tailored_good`（忠实定制，过所有 scorer）+ `tailored_bad`（故意破坏：改名字/删 section/插虚构雇主 Globex Industries）。**bad case 是反剧场证明**——证明 scorer 真能检测违规而非永远 OK。

3. **LLM-as-judge** `test_tailoring_eval.py`：`@pytest.mark.eval` 默认不跑，`-m eval` 才跑。无 key 直接 skip。judge 按 RELEVANCE/TRUTHFULNESS/FORMATTING 三轴打 1-5 分。

**落地建议**：在 `backend/tests/` 建 `evals/`，先实现三个确定性 scorer（适配 ResumeAgent schema），配 2-3 个 golden case。改 prompt 时跑这个防回归。

---

## 三、其他值得借鉴的点

### 简历解析日期保真（M2）
`restore_dates_from_markdown()` (`parser.py:40`)：LLM 解析时常丢月份（"Jun 2020 - Aug 2021"→"2020 - 2021"）。从原始 markdown 正则抽含月日期建反查表 `{"2020 - 2021": "Jun 2020 - Aug 2021"}`，把只有年份的 `years` 字段替换回含月版本。

→ ResumeAgent 的 `assemble_resume_data_fast` 分段并行也面临 LLM 丢月份问题，可加这道正则后处理。

### 防幻觉 truthfulness rules（M4）
9 条铁律（见设计 1）系统化覆盖"不编造"。ResumeAgent rewrite prompt 已有"不编造"但零散不系统。

### 技能补全两步法（属于 H1）
- `generate_skill_target_plan()` LLM 提议要加哪些技能
- `verify_skill_target_plan()` 本地分四类：`existing`/`jd_added`/`supported_by_resume`/`unsupported`（拒绝）
- 只有前三类进 accepted，作为 diff 的 `add_skill` 动作白名单

→ "LLM 提议 + 本地验证"模式，避免 LLM 凭空加技能。

### Prompt 占位符校验
`validate_prompt_placeholders` (`prompts/__init__.py:30`)：保存自定义 prompt 前校验必含 `{job_description}/{resume_data}/{output_language}`，缺了 422。比 ResumeAgent 的 `_SafeDict` 容错 format 更前置。

### `_truncate_json_value` 防 prompt 超长
`interview_prep.py:31`：递归截断字符串/列表，末尾插 `{"_prompt_truncation_notice": "N items omitted. Do not infer."}` 提醒 LLM 别推断。三级降级 (2000,30)→(1000,20)→(500,10)。

---

## 四、借鉴清单（按优先级）

### 🔥 高优先级（直接补能力空白，ROI 最高）

| # | 借鉴什么 | RM 文件 | ResumeAgent 落点 | 难度 |
|---|---|---|---|---|
| **H1** | **Diff-based JD 定制**（path 白名单+4 闸门+本地 verify+skill 两步法） | `improver.py` | 改造 `agent/cv_editor.py`，新增 preview/confirm 端点 | 大 |
| **H2** | **LLM 工程层**（complete_json 截断检测/重试/降级 + secret scrub） | `llm.py:1070-1227` | `backend/agent/llm.py` 加 complete_json | 中 |
| **H3** | **Eval 框架**（确定性 scorer + golden case + LLM judge） | `tests/evals/` | `backend/tests/evals/` 新建 | 中 |
| **H4** | **去 AI 味本地后处理**（remove_ai_phrases + JD 保护） | `refiner.py:233-287` | 扩 `backend/ai_phrase_blacklist.py` | 小 |

### ⭐ 中优先级（增强现有）

| # | 借鉴什么 | RM 文件 | 价值 |
|---|---|---|---|
| M1 | 对话向导 section merge（只 merge 当前 section + 按签名 union） | `resume_wizard.py:230` | 防 LLM 擦除数据 |
| M2 | 解析日期保真（正则回填含月日期） | `parser.py:40` | 防 LLM 丢月份 |
| M3 | 加密 key 存储（Fernet + 三层配置） | `config.py` | 安全 |
| M4 | truthfulness 9 铁律 + prompt injection 8 正则 | `templates.py:203`、`improver.py:28` | 系统化防幻觉 |

### 低优先级（能力扩展）

| # | 借鉴什么 | 价值 |
|---|---|---|
| L1 | ATS 评分（纯本地三维加权） | 零成本评分，依赖先有关键词抽取 |
| L2 | 求职信/外联/面试准备 | 能力扩展 |
| L3 | 多轮精炼流水线（三 pass） | H1 之上的增强层 |

---

## 五、最关键的三个建议

1. **H1 diff-based 定制是 RM 整个 AI 设计的灵魂**——把"LLM 重写"变成"LLM 提议+本地守门"，可审计可回滚，解决 ResumeAgent agent 整体改写易丢字段的根本问题
2. **H3 eval 框架是 prompt 工程的回归保护网**——确定性 scorer 几乎零成本，改 prompt 时能 catch 大部分"改坏了"，golden bad case 是反剧场证明
3. **H2 的 complete_json 截断检测+重试是生产环境刚需**——ResumeAgent 直连 GLM 缺这层，长简历生成时 JSON 截断/格式错会很常见

---

## 六、避坑点（RM 注释明确的教训）

- PDF 渲染不要用 `wait_until:"networkidle"`（Next.js HMR 永不触发）
- 边距不能只用 HTML padding（只首页生效），必须 Playwright margin 或 @page
- 三层超时必须对齐（backend wait_for / proxyTimeout / client AbortController）
- API key 不能泄漏到本地服务器（openai_compatible/ollama 跳过 env 默认 key）
- wizard 不能让 LLM 整体覆盖 resume_data（只 merge 当前 section）
- extract_intro_name 不用 IGNORECASE（会让 `[A-Z]` 匹配小写假阳性）
- `_keyword_in_text` 用 `\b` 词边界（防 "python" 匹配 "pythonic"）
- JD 截断保护（超 2000 字符截断 + warning）
- `disable_cooldowns=True`（单 deployment cooldown 会黑掉后端）

---

## 七、协议说明

RM 采用 Apache License 2.0，允许商用/修改/分发/闭源。借鉴其设计思路和 prompt 词表完全合规；若原样抄录代码片段（如 scorers、complete_json），需在文件头标注来源与协议。
