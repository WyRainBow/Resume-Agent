"""
提示词构建模块
"""
from typing import Any
try:
    from prompt_templates import get_rewrite_default_instruction
except ImportError:
    from backend.prompt_templates import get_rewrite_default_instruction


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


def build_skill_ainative_context(original_value: Any) -> str:
    """
    构造「技能模块 AI Native 分角色润色」的专属上下文。
    仅用于 path 含 skill 的场景，引导 LLM：
    1. 自动判断用户职业方向（开发/产品/运营/设计）
    2. 保留原有技能 + 按角色补充 AI Native 能力
    3. 统一无序列表 HTML 输出，成熟工程师风格
    """
    return """这是「专业技能」部分。请在保留用户原有技能的基础上，自动升级为更具竞争力、符合 AI Native 趋势的表达，并按用户职业方向补充 AI 相关能力。

## 核心任务

1. **自动判断职业方向**：根据现有技能内容判断用户属于【开发 / 产品 / 运营 / 设计】哪个方向，无法明确判断时默认按「开发」处理。用户若在指令中指定方向，以用户指定为准。

2. **保留原有技能**：不要删除用户已有的技能项，在其基础上升级表达（从「会用」升级到「能解决问题」），增加结果导向（性能提升、效率提升、系统稳定性等）。

3. **按方向补充 AI Native 能力**（在原有技能之后追加，不要替换）：

   - **开发方向**：补充 AI 编程工具（如 Claude Code、Cursor、Codex）提效；SDD / Spec 驱动开发将需求结构化为 prompt 生成代码；LLM API（OpenAI / Claude / Gemini 等）集成；Prompt 设计与调优；AI + 后端/前端结合（Agent、Workflow、自动化处理流程）。
   - **产品方向**：补充 AI 工具进行自动化运营提效；搭建 AI 驱动的内容生成 / 用户触达 / 数据分析流程；AI Native 产品思路（从功能到 workflow）；利用 AI 做增长、转化优化或流程自动化。
   - **运营方向**：补充 AI 自动化运营流程搭建；AI 内容生成与分发；AI 数据分析与用户洞察；AI 增长黑客与转化优化。
   - **设计方向**：补充 Figma 等 AI 辅助设计工具；AI 生成 UI / 设计稿迭代 / 文案生成；AI 产品交互设计（对话式界面、Agent 体验）；AI Native 设计思维（从静态页面到动态交互）。

## 输出格式（强制）

- 必须用**无序列表**：`<ul class="custom-list"><li><p><strong>能力类别</strong>：具体描述</p></li></ul>`
- 每条是一类能力（如 后端 / AI / 工程化 / 设计 / 运营等），每条内部是完整的一到两句话，不要拆碎
- **小标题不要带序号**（写 `<strong>后端</strong>`，不要 `<strong>1. 后端</strong>`）
- 保留原文已有的 HTML 标签结构，不要改为 Markdown

## 风格要求（非常重要）

- 不要出现「我具备…」「本人熟悉…」这种学生表达
- 不要过度夸张（如「精通所有」「全栈专家」）
- 用自然表达，如「熟悉…并能在实际项目中…」「能够基于…实现…」「在…场景下完成…优化」
- 不要堆砌工具名，要体现使用场景
- 整体语气偏成熟工程师，而不是学生或教科书"""


def build_rewrite_prompt(path: str, original_value: Any, instruction: str, locale: str = "zh",
                         history: list[dict] | None = None) -> str:
    """
    构造一个将字段进行改写的提示词
    如果原值是字符串，则要求输出单段文本；
    如果原值是数组或对象，则要求输出 JSON。

    支持多轮对话：当 history 非空时，将历史轮次拼入上下文
    支持字段类型感知：根据 path 自动注入优化策略
    """
    lang = "请使用中文输出" if locale == "zh" else "Please output in English"

    # 字段类型上下文
    path_lower = path.lower()
    is_skill = 'skill' in path_lower
    if 'project' in path_lower:
        field_context = "这是「项目经历」的描述。请突出技术深度、量化成果，使用 STAR 法则（情境-任务-行动-结果），以动词开头。"
    elif 'experience' in path_lower or 'internship' in path_lower:
        field_context = "这是「工作/实习经历」的描述。请突出业务影响和成长轨迹，量化成果，以动词开头。"
    elif is_skill:
        field_context = build_skill_ainative_context(original_value)
    elif 'opensource' in path_lower or 'open_source' in path_lower:
        field_context = "这是「开源贡献」的描述。请突出社区影响和技术能力。"
    else:
        field_context = ""

    # 默认润色指令（如果用户没有提供具体指令）
    default_polish_instruction = get_rewrite_default_instruction()

    # 技能模块走 AI Native 专属默认指令；其他模块沿用通用润色指令
    if is_skill and not instruction.strip():
        final_instruction = "请按上述规则对技能模块进行 AI Native 分角色升级润色。"
    else:
        final_instruction = instruction.strip() if instruction.strip() else default_polish_instruction

    # 构建多轮对话上下文
    history_section = ""
    if history:
        parts = []
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                parts.append(f"用户指令：{content}")
            elif role == "assistant":
                parts.append(f"之前的润色结果：{content}")
        if parts:
            history_section = "\n对话历史：\n" + "\n".join(parts) + "\n"

    if isinstance(original_value, str):
        return f"""
{lang}。你是一个专业的简历优化助手。{field_context}

任务：{final_instruction}
{history_section}
要求：
1. 直接返回优化后的文本，不要包含任何解释、代码块标记或其他内容
2. 如果原文包含HTML标签（如 <strong>、<ul>、<li> 等），请保留这些标签
3. 只输出优化后的内容，不要添加"优化后："等前缀

原始文本：
{original_value}
"""
    else:
        return f"""
{lang}。你是一个专业的简历优化助手。{field_context}

任务：{final_instruction}
{history_section}
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
