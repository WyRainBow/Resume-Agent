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
    """
    lang = "请使用中文输出" if locale == "zh" else "Please output in English"
    if isinstance(original_value, str):
        return f"""
{lang}。你是简历优化助手，请按照以下意图重写文本：{instruction}
要求：
1. 以动词开头，量化成果，突出影响；
2. 输出纯文本，不要包含任何多余解释或代码块；

原始文本：
{original_value}
"""
    else:
        return f"""
{lang}。你是简历优化助手，请根据以下意图重写数据：{instruction}
要求：
1. 以动词开头，量化成果，突出影响；
2. 严格输出 JSON，结构需与原值类型一致；

原始数据(JSON)：
{original_value}
"""


# 单模块 AI 解析的 prompt 模板
SECTION_PROMPTS = {
    "contact": '提取个人信息,输出JSON:{"name":"姓名","phone":"电话","email":"邮箱","location":"地区","objective":"求职意向"}',
    "education": '提取教育经历,输出JSON数组:[{"title":"学校","subtitle":"学历","major":"专业","date":"时间","details":["描述"]}]',
    "experience": '提取工作/实习经历,输出JSON数组:[{"title":"公司","subtitle":"职位","date":"时间","highlights":["工作内容"]}]',
    "projects": '提取项目经历,输出JSON数组:[{"title":"项目名","subtitle":"角色","date":"时间","highlights":["描述"],"repoUrl":"仓库链接(可选)"}]',
    "skills": '提取技能,输出JSON数组:[{"category":"技能类别","details":"技能描述"}]',
    "awards": '提取荣誉奖项,输出JSON字符串数组:["奖项1","奖项2"]',
    "summary": '提取个人总结,输出JSON:{"summary":"总结内容"}',
    "opensource": '提取开源经历,输出JSON数组:[{"title":"项目名","subtitle":"角色","items":["贡献描述"],"repoUrl":"仓库链接"}]'
}
