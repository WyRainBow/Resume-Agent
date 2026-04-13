from __future__ import annotations

import json
from typing import Any


def _to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def build_parser_system_prompt() -> str:
    return (
        "你是资深招聘 JD 结构化分析助手。"
        "只输出合法 JSON，不要输出解释。"
        "字段必须包含 title, company_name, summary, responsibilities, "
        "required_skills, preferred_skills, tools_and_stack, seniority, keywords, source_url。"
        "数组字段必须是字符串数组。无法确定时返回空字符串或空数组，不要编造。"
    )


def build_parser_user_prompt(raw_text: str, source_url: str | None) -> str:
    payload = {
        "source_url": source_url or "",
        "raw_text": raw_text,
    }
    return f"请把下面 JD 结构化为 JSON：\n{_to_json(payload)}"


def build_requirement_system_prompt() -> str:
    return (
        "你是资深招聘经理。"
        "只输出合法 JSON，不要输出解释。"
        "字段必须包含 responsibilities, must_have_skills, nice_to_have_skills, "
        "domain_focus, keywords，且都为字符串数组。"
    )


def build_requirement_user_prompt(structured_jd: dict[str, Any]) -> str:
    return f"基于这个结构化 JD，提炼岗位要求：\n{_to_json(structured_jd)}"


def build_match_system_prompt() -> str:
    return (
        "你是技术招聘顾问。"
        "请根据目标 JD 和当前简历给出岗位匹配分析。"
        "只输出合法 JSON，不要输出解释。"
        "字段必须包含 match_score, summary, core_gaps, priority_updates, "
        "current_must_have_stack, future_stack。"
        "match_score 取 0 到 100 的数字。其余字段按要求输出字符串或字符串数组。"
    )


def build_match_user_prompt(
    structured_jd: dict[str, Any],
    requirements: dict[str, Any],
    resume_data: dict[str, Any],
) -> str:
    payload = {
        "structured_jd": structured_jd,
        "requirements": requirements,
        "resume_data": resume_data,
    }
    return f"分析这份简历与岗位的差距：\n{_to_json(payload)}"


def build_patch_system_prompt() -> str:
    return (
        "你是资深简历优化顾问。"
        "请基于目标 JD 与现有简历，输出模块级 patch 建议。"
        "只输出合法 JSON，不要输出解释。"
        "格式必须是 {\"patch_batches\": [...]}。"
        "每个 patch batch 必须包含 module_key, summary, value。"
        "module_key 只能是 basic, experience, projects, skills, education, openSource, awards。"
        "value 必须是对应模块的完整替换值，且保持现有 ResumeData 的字段结构。"
        "skills 对应的 value 必须是字符串；其余模块必须保持原有对象或数组结构。"
        "只返回你确定应该改写的模块，不要返回空模块。"
    )


def build_patch_user_prompt(
    structured_jd: dict[str, Any],
    match_analysis: dict[str, Any],
    resume_data: dict[str, Any],
) -> str:
    payload = {
        "structured_jd": structured_jd,
        "match_analysis": match_analysis,
        "resume_modules": {
            "basic": resume_data.get("basic"),
            "experience": resume_data.get("experience"),
            "projects": resume_data.get("projects"),
            "skills": resume_data.get("skillContent"),
            "education": resume_data.get("education"),
            "openSource": resume_data.get("openSource"),
            "awards": resume_data.get("awards"),
        },
    }
    return f"请生成岗位定向简历 patch：\n{_to_json(payload)}"


def build_learning_path_system_prompt() -> str:
    return (
        "你是求职学习路径规划顾问。"
        "只输出合法 JSON，不要输出解释。"
        "格式必须是 {\"phases\": [...]}。"
        "每个 phase 必须包含 phase_name, goal, topics, suggested_projects, resume_ready_outcomes。"
        "除 phase_name 和 goal 外，其余字段必须是字符串数组。"
    )


def build_learning_path_user_prompt(
    structured_jd: dict[str, Any],
    match_analysis: dict[str, Any],
) -> str:
    payload = {
        "structured_jd": structured_jd,
        "match_analysis": match_analysis,
    }
    return f"请生成动态学习路径：\n{_to_json(payload)}"
