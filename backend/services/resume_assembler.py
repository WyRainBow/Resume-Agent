"""
简历组装服务
根据布局骨架 + 原始文字生成结构化 Resume JSON
使用 DeepSeek 作为文本模型
"""
from __future__ import annotations

import json
import os
from typing import Dict, Any, Optional

from openai import OpenAI


DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

_deepseek_client: Optional[OpenAI] = None
_last_key: Optional[str] = None


def _get_client(api_key: Optional[str] = None) -> OpenAI:
    global _deepseek_client, _last_key
    key = api_key or DEEPSEEK_API_KEY
    if not key:
        raise ValueError("DEEPSEEK_API_KEY 未配置")
    if _deepseek_client is None or _last_key != key:
        _deepseek_client = OpenAI(api_key=key, base_url=DEEPSEEK_BASE_URL)
        _last_key = key
    return _deepseek_client


def _strip_json_block(text: str) -> str:
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0]
    return cleaned.strip()


def _parse_json(text: str) -> Dict[str, Any]:
    cleaned = _strip_json_block(text)
    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise


def _split_text_by_headings(text: str) -> Dict[str, str]:
    """
    按常见简历标题切分文本，减少跨模块混入
    """
    headings = [
        ("experience", ["实习经历", "工作经历", "工作经验"]),
        ("projects", ["项目经验", "项目经历"]),
        ("openSource", ["开源经历", "开源项目", "开源"]),
        ("skills", ["专业技能", "技能"]),
        ("education", ["教育经历", "教育背景"]),
        ("awards", ["获奖", "奖项", "荣誉"]),
    ]

    positions: Dict[str, tuple[int, str]] = {}
    for key, keywords in headings:
        for kw in keywords:
            idx = text.find(kw)
            if idx != -1:
                if key not in positions or idx < positions[key][0]:
                    positions[key] = (idx, kw)

    if not positions:
        return {}

    ordered = sorted(((idx, key, kw) for key, (idx, kw) in positions.items()), key=lambda x: x[0])
    segments: Dict[str, str] = {}
    for i, (start_idx, key, kw) in enumerate(ordered):
        end_idx = ordered[i + 1][0] if i + 1 < len(ordered) else len(text)
        segments[key] = text[start_idx:end_idx].strip()
    return segments


def assemble_resume_data(
    raw_text: str,
    layout: Dict[str, Any],
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    根据布局骨架 + 原始文本生成简历 JSON
    """
    if not raw_text:
        raise ValueError("原始文本为空")
    if not layout or "sections" not in layout:
        raise ValueError("布局骨架为空或格式不正确")

    schema_desc = (
        '{"name":"姓名","contact":{"phone":"电话","email":"邮箱","location":"地区"},'
        '"objective":"求职意向","education":[{"title":"学校","subtitle":"专业","degree":"学位(本科/硕士/博士)",'
        '"date":"时间","details":["荣誉"]}],"internships":[{"title":"公司","subtitle":"职位","date":"时间",'
        '"highlights":["工作内容"]}],"projects":[{"title":"项目名","subtitle":"角色","date":"时间",'
        '"description":"项目描述(可选)","highlights":["描述"]}],"openSource":[{"title":"开源项目","subtitle":"角色/描述",'
        '"date":"时间(格式: 2023.01-2023.12 或 2023.01-至今)","items":["贡献描述"],"repoUrl":"仓库链接"}],'
        '"skills":[{"category":"类别","details":"技能描述"}],"awards":["奖项"]}'
    )

    section_text = _split_text_by_headings(raw_text)
    prompt = f"""你是专业的简历结构化解析助手。

任务：根据【布局骨架】与【原始文本】生成结构化简历 JSON。

必须遵守（非常重要）：
1. 布局骨架定义了模块顺序和条目顺序，必须严格保持。
2. 每个条目的描述只能归属到对应条目，不能串条。
3. 如果骨架中出现 company=腾讯云，那么腾讯云相关描述只能放在对应条目。
4. **类型映射规则（必须严格遵守）：**
   - 布局骨架中 type="experience" → 输出到 internships 数组
   - 布局骨架中 type="projects" → 输出到 projects 数组
   - 布局骨架中 type="openSource" → 输出到 openSource 数组（不是 projects！）
   - 布局骨架中 type="education" → 输出到 education 数组
   - 布局骨架中 type="skills" → 输出到 skills 数组
5. **开源项目规则（必须严格遵守）：**
   - 如果布局骨架中有 type="openSource" 的模块，该模块下的所有条目必须输出到 openSource 数组
   - 开源项目不能放到 projects 数组中！
   - 个人项目（如 Resume-Agent）如果在骨架的 openSource 模块中，必须放到 openSource 数组
6. 同一段内容不能在多个模块重复出现。
7. 项目内容不得出现在 internships 中，实习内容不得出现在 projects 中。
8. 优先使用【分区文本】中对应模块的内容；只有分区为空时，才可参考原始文本的其他部分。
9. 只输出 JSON，不要任何解释或代码块。

布局骨架：
{json.dumps(layout, ensure_ascii=False)}

分区文本（按标题切分）：
{json.dumps(section_text, ensure_ascii=False)}

原始文本：
{raw_text}

输出格式：
{schema_desc}
"""

    client = _get_client(api_key)
    response = client.chat.completions.create(
        model=model or DEEPSEEK_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=2000
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("DeepSeek 未返回简历 JSON")
    return _parse_json(content)
