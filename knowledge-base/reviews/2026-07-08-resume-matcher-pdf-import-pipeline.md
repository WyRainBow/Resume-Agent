# Resume-Matcher 的 PDF 导入与解析：从二进制到结构化数据的全链路拆解

> 调研对象：[srbhr/Resume-Matcher](https://github.com/srbhr/resume-matcher)（`apps/backend`，提交 `dd9b5c3`）
> 调研日期：2026-07-08
> 调研者：ZCode

## 一、一句话概括

Resume-Matcher 的 PDF 导入走的是一条**"两段式"管线**：

```
PDF 二进制 ──[MarkItDown / pdfminer.six]──▶ Markdown 文本 ──[LLM + JSON Schema]──▶ 结构化 JSON
```

它**没有**自己写任何 PDF 解析代码，也没有用 OCR。PDF 的文本抽取完全委托给微软的 [MarkItDown](https://github.com/microsoft/markitdown)，而 MarkItDown 底层对 PDF 用的是 [pdfminer.six](https://pdfminersix.readthedocs.io/)。真正的"理解简历"——把杂乱文本切成工作经历、教育、技能等字段——是交给 LLM 做的。

这个设计选择很关键：**它把"提取文字"和"理解语义"彻底解耦**，前者用确定性工具，后者用大模型。

---

## 二、全链路时序：一次上传发生了什么

以 `POST /resumes/upload` 为例（`apps/backend/app/routers/resumes.py:630`）：

```
┌─ 前端 ─────────────────────────────────────────────────┐
│ use-file-upload.ts                                       │
│   drag/drop 或点击选文件                                  │
│   → FormData(file) ──POST──▶  /resumes/upload           │
│   client.ts:138  getUploadUrl() = `${API_BASE}/resumes/upload`
└──────────────────────────────────────────────────────────┘
                          │
┌─ 后端 upload_resume() ──────────────────────────────────┐
│ 1. 校验 content_type ∈ {pdf, doc, docx}                  │
│ 2. 校验 size ≤ 4MB；空文件直接 400                        │
│ 3. parse_document(content, filename)        ← 第一段：抽文本 │
│      ├─ 写临时文件                                        │
│      ├─ MarkItDown().convert(path).text_content          │
│      └─ 得到 markdown_content                            │
│ 4. 空文本 → 422（疑似扫描件/纯图片 PDF）                   │
│ 5. db.create_resume_atomic_master(...)                   │
│      ├─ content = markdown_content (content_type="md")   │
│      ├─ original_markdown = markdown_content  ← 永久留存  │
│      └─ processing_status = "processing"                 │
│ 6. parse_resume_to_json(markdown)     ← 第二段：LLM 结构化 │
│      ├─ 拼 PARSE_RESUME_PROMPT + schema 示例              │
│      ├─ complete_json(...)  (retries=3, JSON mode)       │
│      ├─ restore_dates_from_markdown()  ← 正则补回月份     │
│      └─ ResumeData.model_validate()                      │
│ 7. 更新 processed_data + processing_status="ready"        │
│ 8. 返回 resume_id + processing_status                    │
│                                                          │
│    ※ 第 6 步失败不影响上传：status="failed"，前端可重试     │
│    ※ /resumes/{id}/retry-processing 可对 failed 重跑第 6 步 │
└──────────────────────────────────────────────────────────┘
```

两个值得注意的设计：

1. **原子性 + 降级**：先存 markdown、置 `processing`，再异步尝试 LLM 解析。LLM 挂了不影响文件入库，用户能看到"解析失败"并可点重试，而不是整个上传 500。
2. **`original_markdown` 永久留存**：即使用户后来在 Builder 里把 `content` 改成 JSON，原始 markdown 仍被保留——它是后续"日期补全"和"个人信息保护"的真理之源（source of truth）。

---

## 三、第一段：PDF → Markdown（MarkItDown + pdfminer.six）

### 3.1 代码

`apps/backend/app/services/parser.py:119`

```python
async def parse_document(content: bytes, filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)
    try:
        md = MarkItDown()
        result = md.convert(str(tmp_path))
        return result.text_content
    finally:
        tmp_path.unlink(missing_ok=True)
```

实现极其朴素：写临时文件 → `MarkItDown().convert()` → 取 `.text_content` → 删临时文件。**没有任何预处理、没有页眉页脚剥离、没有版面分析**。

### 3.2 MarkItDown 在 PDF 上到底做了什么

MarkItDown 是微软开源的"万能转 Markdown"工具，统一封装了 PDF / DOCX / PPTX / XLSX / HTML / 图片 / 音频 等格式。对 PDF 而言：

- **默认后端是 pdfminer.six**（`apps/backend/pyproject.toml` 显式 pin 了 `pdfminer.six==20260107` 和 `markitdown[docx]==0.1.4`）。
- pdfminer.six 是一个**纯文本流抽取器**：它能按 PDF 内部内容流的顺序把字符、坐标、字体挖出来，但**不做版面理解**——不识别"这是两栏排版""这是表格""这是页眉"。
- 后果：对于**单栏、文本密集**的现代简历 PDF，效果不错（基本能按阅读顺序出文本）；但对**双栏模板、含表格、纯图片/扫描件**，要么顺序错乱，要么抽不出字。

这正是 `upload_resume` 里那段 422 检测的由来：

```python
# Validate extracted text is not empty (image-based PDFs / scanned documents)
if not markdown_content or not markdown_content.strip():
    raise HTTPException(
        status_code=422,
        detail="Could not extract text from the uploaded file. "
               "The document may be image-based or scanned. "
               "Please upload a file with selectable text.",
    )
```

**它明确放弃了对扫描件的支持**——没有 OCR 兜底（项目里没有 Tesseract / PaddleOCR / 云 OCR 的任何痕迹）。

### 3.3 一个有意为之的取舍

"用 MarkItDown 这种通用工具，而不是专门的简历解析器（如 pyresparser、奉旨 OCR 流水线）"看似粗糙，实则是为 LLM 让路：既然第二段要用大模型做语义理解，那第一段只要把字拎出来就够了，版面信息反正 LLM 也能部分推断。这种**"粗糙抽取 + 强模型"**的组合，是 LLM 时代简历解析的典型范式——和传统 pyresparser（依赖 NLP 抽实体 + 正则切 section）的思路正好相反。

---

## 四、第二段：Markdown → 结构化 JSON（LLM + Schema）

### 4.1 核心调用

`apps/backend/app/services/parser.py:144`

```python
async def parse_resume_to_json(markdown_text: str) -> dict[str, Any]:
    prompt = PARSE_RESUME_PROMPT.format(
        schema=RESUME_SCHEMA_EXAMPLE,
        resume_text=markdown_text,
    )
    config = get_llm_config()
    model_name = get_model_name(config)
    result = await complete_json(
        prompt=prompt,
        system_prompt="You are a JSON extraction engine. Output only valid JSON, no explanations.",
        max_tokens=get_safe_max_tokens(model_name),
        retries=3,
    )
    result = restore_dates_from_markdown(result, markdown_text)  # 关键后处理
    validated = ResumeData.model_validate(result)
    return validated.model_dump()
```

注意三个细节：

1. **system prompt 极度强硬**："You are a JSON extraction engine. Output only valid JSON, no explanations."——把模型钉死成一个无脑转换器，禁止任何寒暄/解释。
2. **`complete_json` 用 JSON mode**：`response_format={"type": "json_object"}`（当模型支持时），从协议层保证输出是合法 JSON。`get_safe_max_tokens` 还会按模型注册表把 `max_tokens` 钳到该模型实际上限，避免 422。
3. **Pydantic 校验兜底**：`ResumeData.model_validate(result)` 是最后一道防线，LLM 漏字段会被默认值补上，字段类型不符会抛错（然后被外层 catch 成 `processing_status="failed"`）。

### 4.2 Prompt 设计的精髓

`PARSE_RESUME_PROMPT`（`apps/backend/app/prompts/templates.py:155`）是整个解析的"大脑"，它做对了几件难事：

**(a) Few-shot：直接给完整 schema 示例**

```
Example output format:
{schema}    # 一个填满示例值的完整 JSON，见 RESUME_SCHEMA_EXAMPLE
```

比起用文字描述字段，直接塞一个填好值的 JSON 示例，模型几乎不会跑偏字段名、嵌套层级、ID 从 1 开始等约定。

**(b) 把"非标准 section"显式建模为 `customSections`**

```
Custom section types:
- "text": Single text block (e.g., objective, statement)
- "itemList": List of items with title, subtitle, years, description (e.g., publications)
- "stringList": Simple list of strings (e.g., hobbies, interests)
```

简历的 section 千变万化（Publications / Volunteer / Research / Hobbies / Patents…），硬编码字段不可能穷举。这里用一个灵活的 `customSections` + 三种 `sectionType` 兜底，既保留了结构化（前端能渲染），又不丢信息。配套的 Pydantic 模型也印证了这一点（`schemas/models.py` 有 `SectionType` 枚举 = text/itemList/stringList）。

**(c) 日期处理是头号难题，单独立规**

```
- Format dates preserving the original precision. Keep months when present:
  "Jan 2020 - Dec 2023", "May 2021 - Present".
  Use "YYYY - YYYY" only when the source has no months.
- Normalize date separators: "2020-2021" → "2020 - 2021",
  "Current"/"Ongoing" → "Present". Do NOT discard months.
```

为什么这么强调日期？因为**LLM 在解析时会系统性地把月份丢掉**——"Jun 2020 - Aug 2021" 经常被"精简"成 "2020 - 2021"。这对求职者是大问题（月份影响工龄计算）。光靠 prompt 约束不够，所以有了下面的硬编码兜底。

---

## 五、值得单独成章的工程亮点：日期补全（restore_dates_from_markdown）

这是整个解析链路里**最体现工程思维**的一段代码（`parser.py:40`）。它揭示了"不能信任 LLM 输出"这一现实：

### 5.1 问题

LLM 解析后，`workExperience[i].years` 经常是 `"2020 - 2021"`（丢了月份），但**原始 markdown 里明明有 `"Jun 2020 - Aug 2021"`**。

### 5.2 解法：用正则从原始 markdown 抽日期，回填

```python
# 1. 一个超长的正则，匹配 "Jun 2020 - Aug 2021" / "May 2021 - Present" / "Jun 2023"
_MD_DATE_RE = re.compile(r"(?:Jan(?:uary)?|Feb|...|Dec)\.?\s+\d{4}) ...")

# 2. 从 markdown 抽所有带月份的日期
md_dates = _extract_markdown_dates(markdown)

# 3. 建映射：把 "Jun 2020 - Aug 2021" 压缩成 key "2020 - 2021"
#    → year_to_full["2020 - 2021"] = "Jun 2020 - Aug 2021"
year_to_full: dict[str, str] = {}
for md_date in md_dates:
    years_in_date = re.findall(r"\d{4}", md_date)
    year_key = " - ".join(years_in_date)   # "2020 - 2021"
    if year_key not in year_to_full:
        year_to_full[year_key] = normalize(md_date)

# 4. 遍历解析结果，凡是 years 字段不含月份（只有年份）且能匹配上的，回填
for section in ("workExperience", "education", "personalProjects"):
    for entry in parsed_data[section]:
        if entry["years"] 已含月份: continue       # 不覆盖已有月份
        if entry["years"] in year_to_full:
            entry["years"] = year_to_full[entry["years"]]
```

### 5.3 为什么这个设计高明

- **数据源是原始 markdown，不是 LLM 输出**：markdown 是 pdfminer 确定性抽取的，可信；LLM 输出不可信。用可信源去补不可信源，方向对。
- **只用年份做匹配键**：`"2020 - 2021"` 这种弱键可能有歧义（同年份的多段经历），但因为回填的是"补回月份"而非"改写内容"，即便匹配错也只影响该字段的精度，不致命。
- **幂等 + 不破坏**：已经有月份的不动，找不到匹配的不动——纯粹的"只补不破"。
- **覆盖到 customSections**：出版物、志愿工作等自定义列表项的 `years` 也一并处理。

这条逻辑有完整的单测（`tests/unit/test_parser.py`），覆盖率从 ~20% 拉到完整，可见团队把它当一等公民对待。后续在 `improve/tailor` 流程里，还有同名的 `restore_dates_from_markdown` 和 `_restore_original_dates` 做**第二层兜底**（防止 LLM 在改写简历时又把月份弄丢）——典型的 defense-in-depth。

---

## 六、LLM 调用层的工程化（complete_json）

`apps/backend/app/llm.py` 的 `complete_json` 把"调 LLM 要 JSON"这件事做得很扎实，解析简历时受益于：

| 机制 | 作用 |
|---|---|
| LiteLLM Router | 统一封装 OpenAI / Anthropic / Gemini / DeepSeek / Ollama / OpenRouter，按错误类型分级重试（429/500/timeout 重试，400/401 不重试） |
| `drop_params=True` | 自动丢弃模型不支持的参数（reasoning_effort、temperature 等），避免 422 |
| `_supports_json_mode()` | 查 LiteLLM 模型注册表判断是否支持 `response_format`；Ollama 本地模型一律当支持 |
| JSON mode 降级 | 若注册表说支持但实际 400（如 LM Studio 拒绝 `json_object`），自动回退到"仅 prompt 约束"模式重试 |
| 截断检测 `_appears_truncated()` | 解析出的 resume 若 `workExperience/education/skills` 为 `[]`，判为截断，自动重试并追加"输出完整 JSON"的 hint |
| `_extract_json()` | 手写花括号配平解析器，能从 ```` ```json ... ``` ````、混杂文字、甚至 `<think>...</think>`（DeepSeek-R1/QwQ）里抠出 JSON |
| 重试时升 temperature | `[0.1, 0.3, 0.5, 0.7]` 递增，增加变化性；但对 kimi-k2.6（只允许 temp=1）等特判 |

一句话：**它假设 LLM 会以各种方式失败，并为每种失败准备了兜底**。这套基础设施让"用 LLM 做解析"在生产环境变得可靠。

---

## 七、数据模型：结构化结果的形状

`ResumeData`（`apps/backend/app/schemas/models.py:341`）是解析的最终产物，前端类型与之严格对应：

```
ResumeData
├─ personalInfo: PersonalInfo     # name/title/email/phone/location/website/linkedin/github
├─ summary: str
├─ workExperience: [Experience]   # title/company/location/years/description[]
├─ education: [Education]         # institution/degree/years/description
├─ personalProjects: [Project]    # name/role/years/github/website/description[]
├─ additional: Additional         # technicalSkills[]/languages[]/certificationsTraining[]/awards[]
└─ customSections: dict           # 灵活的 {key: {sectionType, items[]|text}}
```

两个细节：

- `description` 字段在 Work/Project 是 `list[str]`（bullet 列表），在 Education 是 `str | None`（单段）。Pydantic 用 `_coerce_string_list` 做类型强转，防止 LLM 偶尔返回字符串而非列表。
- `additional` 收纳所有"列表型"杂项（技能/语言/证书/奖项），而 `customSections` 收纳"结构型"杂项（出版物/科研/志愿）。这种**双轨制**比一个扁平 `sections[]` 更利于下游（ATS 打分、tailor 改写）按字段名精准操作。

---

## 八、对自家 Resume-Agent 的启示

对比我们 `backend/agent/` 现有的简历解析，这套方案的几个点值得借鉴：

1. **两段式 + 原始文本永久留存**：把"抽文本"和"理解"分开，原始 markdown/文本作为真理之源长期保存，后续所有 LLM 改写都能拿它做兜底校验。我们现在也有类似保留，但兜底链路（日期补全、技能防丢）可以更系统化。
2. **日期补全是刚需**：用确定性正则去补 LLM 丢的月份，这个 pattern 直接可抄——尤其是我们中文简历里"2020.06-2023.08"这类格式，LLM 极易吞月份。
3. **customSections 兜底非标 section**：开源经历、论文、专利这些放进固定字段都不合适，一个灵活的 `customSections` 比硬扩 schema 更稳。
4. **LLM 失败不阻塞上传**：processing / ready / failed 三态 + retry 接口，UX 比一次性 500 友好得多。
5. **PDF 抽取的天花板要认清**：pdfminer.six 对扫描件/复杂版面无能为力，且没有 OCR。我们如果要做得更好，可以在第一段引入 OCR（如自家 GLM-4V/Claude 的视觉能力做 PDF 版面理解）作为 markitdown 抽空时的兜底——这是 Resume-Matcher 留下的最大空白，也是我们可以差异化的点。

---

## 附：关键文件索引

| 职责 | 文件 |
|---|---|
| 上传入口（后端） | `apps/backend/app/routers/resumes.py` (`upload_resume`, L630) |
| PDF→Markdown + LLM→JSON | `apps/backend/app/services/parser.py` |
| LLM 调用基础设施 | `apps/backend/app/llm.py` (`complete_json`) |
| Prompt 与 Schema 示例 | `apps/backend/app/prompts/templates.py` (`PARSE_RESUME_PROMPT`, `RESUME_SCHEMA_EXAMPLE`) |
| 数据模型 | `apps/backend/app/schemas/models.py` (`ResumeData`) |
| 日期补全单测 | `apps/backend/tests/unit/test_parser.py` |
| 前端上传 Hook | `apps/frontend/hooks/use-file-upload.ts` |
| 前端上传 URL | `apps/frontend/lib/api/client.ts:138` |
| 依赖声明 | `apps/backend/pyproject.toml` (`markitdown[docx]==0.1.4`, `pdfminer.six==20260107`) |

## 参考资料

- [microsoft/markitdown](https://github.com/microsoft/markitdown)
- [pdfminer.six 文档](https://pdfminersix.readthedocs.io/)
- [markitdown PDF 转换局限讨论 (issue #1117)](https://github.com/microsoft/markitdown/issues/1117)
- [srbhr/Resume-Matcher](https://github.com/srbhr/resume-matcher)
