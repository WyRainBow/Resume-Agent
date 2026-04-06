"""提示词模板配置"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
PROMPT_CONFIG_PATH = ROOT_DIR / "backend" / "data" / "prompt_templates.json"


DEFAULT_REWRITE_TEXT_PROMPT_TEMPLATE = """你是资深简历优化专家。请将输入文本改写为大厂风格简历表述，并严格按用户指令执行。
- 语言: {locale}
- 字段路径: {path_hint}
- 改写指令: {instruction}

【任务目标】
把流水账式描述升级为高质量成果型表述，优先体现：问题（背景/瓶颈）-> 方案（技术手段）-> 收益（量化结果）。

【改写规则】
1. 严格基于原文事实，不编造项目、技术、数据。
2. 从“做了什么”升级到“怎么做”，优先补充可落地技术动作（分析方法、优化手段、架构调整、稳定性治理）。
3. 强化技术关键词，优先保留并突出原文已有关键词（如索引、执行计划、缓存、并发、架构、链路）。
4. 强化量化结果，优先保留原文数字与趋势表达（如 80%+、百万级降至万级）。
5. 语言专业、简洁、结果导向，避免空话（如“负责了/参与了/协助了”）。
6. 用动词开头，避免主观形容词堆砌。
7. 仅输出改写后的最终内容，不要解释，不要代码块。
8. 保持原段落结构，除非用户明确要求改结构。
9. 若原文包含 HTML 标签（如 <strong>/<ul>/<li>），必须输出 HTML 片段，不要改为 Markdown。
10. 若原文包含 HTML 标签，未要求变更的标签尽量保留。
11. 当用户要求“去掉加粗/取消加粗”时，移除 <strong>/<b> 以及 font-weight:bold 样式。
12. 当用户要求加粗（加粗/bold/加黑）时，必须使用 <strong> 标签，不要输出 ** Markdown 语法。
13. 当用户要求“挑重点加粗/部分加粗”时，优先加粗技术关键词与数字指标（如百分比、QPS、耗时、数量级）。

原文：
{source_text}
"""

DEFAULT_REWRITE_DEFAULT_INSTRUCTION = """请将原始经历改写为大厂风格简历条目。
改写规则：
1. 严格基于原文事实，不编造项目、技术、数据
2. 每条尽量体现“问题 -> 方案 -> 收益”
3. 从“做了什么”升级为“怎么做”，补充可落地技术手段
4. 强化技术关键词（如索引、执行计划、缓存、并发、架构、链路）
5. 强化量化结果，优先保留原文数字与趋势表达（如80%+、百万级降至万级）
6. 语言专业、简洁、结果导向，避免空话，尽量动词开头
7. 保持原有信息完整性，并保留HTML标签（如 <strong>、<ul>、<li>）"""

PROMPT_DEFINITIONS: list[dict[str, Any]] = [
    {
        "key": "rewrite_text_prompt_template",
        "title": "划词润色模板",
        "description": "用于 /api/resume/rewrite-text/stream",
        "variables": ["locale", "path_hint", "instruction", "source_text"],
        "default": DEFAULT_REWRITE_TEXT_PROMPT_TEMPLATE,
    },
    {
        "key": "rewrite_default_instruction",
        "title": "字段润色默认指令",
        "description": "用于 /api/resume/rewrite 与 /api/resume/rewrite/stream 在未输入指令时的兜底",
        "variables": [],
        "default": DEFAULT_REWRITE_DEFAULT_INSTRUCTION,
    },
]

DEFAULT_PROMPT_TEMPLATES = {item["key"]: item["default"] for item in PROMPT_DEFINITIONS}


class _SafeDict(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _ensure_parent() -> None:
    PROMPT_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)


def _normalize(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    normalized: dict[str, str] = {}
    for key, default_value in DEFAULT_PROMPT_TEMPLATES.items():
        raw = value.get(key)
        if isinstance(raw, str) and raw.strip():
            normalized[key] = raw
        else:
            normalized[key] = default_value
    return normalized


def get_prompt_templates() -> dict[str, str]:
    if not PROMPT_CONFIG_PATH.exists():
        return dict(DEFAULT_PROMPT_TEMPLATES)
    try:
        with open(PROMPT_CONFIG_PATH, "r", encoding="utf-8") as f:
            loaded = json.load(f)
        merged = dict(DEFAULT_PROMPT_TEMPLATES)
        merged.update(_normalize(loaded))
        return merged
    except Exception:
        return dict(DEFAULT_PROMPT_TEMPLATES)


def get_prompt_registry() -> list[dict[str, Any]]:
    templates = get_prompt_templates()
    return [
        {
            "key": item["key"],
            "title": item["title"],
            "description": item["description"],
            "variables": list(item["variables"]),
            "content": templates[item["key"]],
        }
        for item in PROMPT_DEFINITIONS
    ]


def save_prompt_templates(updates: dict[str, str]) -> dict[str, str]:
    current = get_prompt_templates()
    for key in DEFAULT_PROMPT_TEMPLATES:
        if key in updates and isinstance(updates[key], str) and updates[key].strip():
            current[key] = updates[key]
    _ensure_parent()
    with open(PROMPT_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(current, f, ensure_ascii=False, indent=2)
    return current


def render_rewrite_text_prompt(
    *,
    locale: str,
    path_hint: str,
    instruction: str,
    source_text: str,
) -> str:
    template = get_prompt_templates()["rewrite_text_prompt_template"]
    payload = _SafeDict(
        locale=locale,
        path_hint=path_hint,
        instruction=instruction,
        source_text=source_text,
    )
    return template.format_map(payload)


def get_rewrite_default_instruction() -> str:
    return get_prompt_templates()["rewrite_default_instruction"]
