"""
提示词构建模块
"""
from typing import Any


def build_resume_prompt(instruction: str, locale: str = "zh") -> str:
    """
    构建简历生成提示词，优化为更简洁快速
    根据用户的一句话指令，构造严格的 JSON 输出提示词
    """
    lang_header = "请使用中文输出，只输出 JSON，不要其他文字" if locale == "zh" else "Please output JSON only, no other text"
    schema = (
        "{"
        "\n  \"name\": \"姓名或英文名\","
        "\n  \"contact\": {\n    \"email\": \"...\", \n    \"phone\": \"...\", \n    \"location\": \"...\"\n  },"
        "\n  \"summary\": \"一句话职业总结或2-3句简介\","
        "\n  \"experience\": ["
        "{\n    \"company\": \"公司\", \n    \"position\": \"职位\", \n    \"duration\": \"起止时间\", \n    \"location\": \"地点\","
        "\n    \"achievements\": [\"量化成果1\", \"量化成果2\"]\n  }"
        "] ,"
        "\n  \"projects\": ["
        "{\n    \"name\": \"项目名\", \n    \"role\": \"角色\", \n    \"stack\": [\"技术1\", \"技术2\"], \n    \"highlights\": [\"亮点1\", \"亮点2\"]\n  }"
        "] ,"
        "\n  \"skills\": [\"技能1\", \"技能2\"],"
        "\n  \"education\": ["
        "{\n    \"school\": \"学校\", \n    \"degree\": \"学位\", \n    \"major\": \"专业\", \n    \"duration\": \"起止时间\"\n  }"
        "] ,"
        "\n  \"awards\": ["
        "{\n    \"title\": \"奖项\", \"issuer\": \"颁发方\", \"date\": \"日期\"\n  }"
        "]\n}"
    )

    prompt = f"""
{lang_header}，并严格输出 JSON（不要使用 Markdown、不要加解释、不要加代码块）。

用户需求：
{instruction}

请基于招聘 ATS 最佳实践（动词开头、含量化指标、突出影响），返回以下 JSON 结构：
{schema}

重要提示：
1. 必须根据用户输入的具体信息生成，不要使用固定模板
2. 姓名、公司、项目名称等必须多样化，不要总是使用"张明"、"XX科技"等固定名称
3. 技能栈必须与用户输入的技术栏一致（如用户提到 Go，就要包含 Go）
4. experience 字段必须包含，至少1条工作经历
5. projects 字段必须包含，至少1个项目
6. skills 字段必须是字符串数组，如 ["Java", "Python", "MySQL"]
7. 所有量化成果必须包含具体数字
8. 严格按照上述 JSON 格式输出，不要添加任何其他字段
9. 每次生成的内容应该不同，不要重复之前的结果
"""
    return prompt


def build_rewrite_prompt(path: str, original_value: Any, instruction: str, locale: str = "zh") -> str:
    """
    构造一个将字段进行改写的提示词
    如果原值是字符串，则要求输出单段文本；
    如果原值是数组或对象，则要求输出 JSON。
    
    优化：针对简历润色场景，提供更专业的提示词
    """
    lang = "请使用中文输出" if locale == "zh" else "Please output in English"
    
    # 默认润色指令（如果用户没有提供具体指令）
    default_polish_instruction = """请优化这段文本，使其更加专业、简洁、有吸引力。
优化原则：
1. 使用更专业的词汇和表达方式
2. 突出关键成就和技能
3. 保持简洁清晰，避免冗余
4. 使用主动语气，以动词开头
5. 量化成果，突出影响（如：提升30%、节省50%时间等）
6. 保持原有信息的完整性
7. 保留HTML格式标签（如 <strong>、<ul>、<li> 等）"""
    
    # 如果用户提供了具体指令，使用用户指令；否则使用默认润色指令
    final_instruction = instruction.strip() if instruction.strip() else default_polish_instruction
    
    if isinstance(original_value, str):
        return f"""
{lang}。你是一个专业的简历优化助手。

任务：{final_instruction}

要求：
1. 直接返回优化后的文本，不要包含任何解释、代码块标记或其他内容
2. 如果原文包含HTML标签（如 <strong>、<ul>、<li> 等），请保留这些标签
3. 只输出优化后的内容，不要添加"优化后："等前缀

原始文本：
{original_value}
"""
    else:
        return f"""
{lang}。你是一个专业的简历优化助手。

任务：{final_instruction}

要求：
1. 严格输出 JSON 格式，结构需与原值类型完全一致
2. 不要包含任何解释或代码块标记
3. 只输出 JSON 对象或数组

原始数据(JSON)：
{original_value}
"""


def build_resume_markdown_prompt(instruction: str, locale: str = "zh") -> str:
    """
    构建简历生成提示词 - Markdown 格式输出
    用于流式输出，按模块顺序生成简历内容
    """
    lang_note = "请使用中文输出" if locale == "zh" else "Please output in English"
    
    prompt = f"""{lang_note}。你是专业简历撰写助手。

用户需求：{instruction}

请按以下 Markdown 格式输出简历内容，按顺序逐个模块输出：

# [姓名]

**电话：** [手机号] | **邮箱：** [邮箱] | **地点：** [城市]

**求职意向：** [目标岗位]

---

## 个人总结

[2-3句职业总结，突出核心优势]

---

## 工作经历

### [公司名称] | [职位]
*[起止时间] · [地点]*

- [量化成果1，以动词开头，包含数字]
- [量化成果2]
- [量化成果3]

---

## 项目经历

### [项目名称] | [角色]
*技术栈：[技术1, 技术2, 技术3]*

- [项目亮点1]
- [项目亮点2]

---

## 教育经历

### [学校名称] | [学位] · [专业]
*[起止时间]*

---

## 专业技能

- **编程语言：** [语言列表]
- **框架/工具：** [框架列表]
- **数据库：** [数据库列表]

---

## 荣誉奖项

- [奖项1] - [颁发方] - [日期]
- [奖项2]

要求：
1. 根据用户输入生成真实、多样化的内容
2. 所有成果必须包含具体数字
3. 以动词开头描述成果
4. 如果用户没有提供某模块信息，可以合理推断或省略该模块
5. 直接输出 Markdown，不要加代码块或解释
"""
    return prompt


# 单模块 AI 解析的 prompt 模板
SECTION_PROMPTS = {
    "contact": '提取个人信息,输出JSON:{"name":"姓名","phone":"电话","email":"邮箱","location":"地区","objective":"求职意向"}',
    "education": '提取教育经历,输出JSON数组:[{"title":"学校","subtitle":"专业","degree":"学位(本科/硕士/博士等)","date":"时间","details":["描述"]}]',
    "experience": '提取工作/实习经历,输出JSON数组:[{"title":"公司","subtitle":"职位","date":"时间","highlights":["工作内容"]}]',
    "projects": '提取项目经历,输出JSON数组:[{"title":"项目名","subtitle":"角色","date":"时间","highlights":["描述"],"repoUrl":"仓库链接(可选)"}]',
    "skills": '提取技能,输出JSON数组:[{"category":"技能类别","details":"技能描述"}]',
    "awards": '提取荣誉奖项,输出JSON字符串数组:["奖项1","奖项2"]',
    "summary": '提取个人总结,输出JSON:{"summary":"总结内容"}',
    "opensource": '提取开源经历,输出JSON数组:[{"title":"项目名","subtitle":"角色/描述","date":"时间(格式: 2023.01-2023.12 或 2023.01-至今)","items":["贡献描述"],"repoUrl":"仓库链接"}]'
}


def build_application_progress_parse_prompt(text: str, intent_hint: str = "") -> str:
    """
    投递进展 AI 导入提示词模板（结构化抽取）
    统一放在 prompts.py 便于后续集中管理。
    """
    intent_line = f"意图识别结果（来自系统）：{intent_hint}\n" if intent_hint else ""
    return f"""你是“投递进展表”的意图识别与信息抽取助手。
目标：将用户的自然语言描述解析成投递记录 JSON。

只输出 JSON（不要 markdown、不要解释），严格使用以下 schema：
{{
  "company": "string|null",
  "application_link": "string|null",
  "industry": "互联网|金融|制造业|null",
  "position": "string|null",
  "location": "深圳|北京|上海|广州|null",
  "progress": "已投简历|简历挂|测评未做|测评完成|等待一面|一面完成|一面被刷|等待二面|二面完成|二面被刷|null",
  "notes": "string|null",
  "application_date": "YYYY-MM-DD|null",
  "referral_code": "string|null"
}}

规则：
1) 自动做意图识别与实体抽取：公司、职位、时间、链接、地点、行业、备注。
2) 时间表达“今天”请转换为当前日期（格式 YYYY-MM-DD）。
3) 如果文本出现“部门/团队”等信息，放到 notes。
4) 若无法确定字段，填 null，不要臆造。
5) application_link 必须是完整 http/https URL。

{intent_line}用户输入：
{text}
"""
