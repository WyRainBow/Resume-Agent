"""Fast rules for deterministic simple resume edit intents."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple


_TOOL_TAG_RE = re.compile(r"\[tool:[^\]]+\]", re.IGNORECASE)
_SPACE_RE = re.compile(r"\s+")

_LEADING_PREFIX_RE = re.compile(
    r"^(?:请问|请|麻烦你|麻烦|帮我|帮忙|可以帮我|能不能帮我|我想|我想把|我要把)\s*",
    re.IGNORECASE,
)
_TRAILING_POLITE_RE = re.compile(r"(?:谢谢|麻烦了|辛苦了)\s*$", re.IGNORECASE)

_NAME_PATTERNS = (
    r"^(?:把)?(?:我的)?(?:简历(?:里|中|上的?)?(?:的)?)?(?:名字|姓名)\s*(?:改成|改为|改)\s*[:：]?\s*(.+?)\s*$",
    r"^(?:把)?(?:名字|姓名)\s*(?:改成|改为|改)\s*[:：]?\s*(.+?)\s*$",
)

_INTERNSHIP_COMPANY_PATTERNS = (
    re.compile(
        r"^(?:把)?(?:第)?([一二三四五六七八九十]|\d+)(?:段)?(?:实习|工作)?(?:经历)?(?:公司)\s*(?:改成|改为|改)\s*[:：]?\s*(.+?)\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:把)?(?:实习|工作)?(?:经历)?(?:公司)\s*([一二三四五六七八九十]|\d+)\s*(?:改成|改为|改)\s*[:：]?\s*(.+?)\s*$",
        re.IGNORECASE,
    ),
)

_GENERIC_EDIT_PATTERN = re.compile(
    r"^(?:把)?(?:我的)?(.+?)\s*(?:改成|改为|改)\s*[:：]?\s*(.+?)\s*$",
    re.IGNORECASE,
)

_BASIC_FIELD_ALIAS_TO_PATH: Dict[str, str] = {
    "姓名": "basic.name",
    "名字": "basic.name",
    "name": "basic.name",
    "电话": "basic.phone",
    "手机": "basic.phone",
    "手机号": "basic.phone",
    "联系电话": "basic.phone",
    "email": "basic.email",
    "邮箱": "basic.email",
    "邮件": "basic.email",
    "现居地": "basic.location",
    "所在地": "basic.location",
    "地址": "basic.location",
    "城市": "basic.location",
    "求职意向": "basic.title",
    "意向岗位": "basic.title",
    "岗位": "basic.title",
    "职位": "basic.title",
}


def _normalize_target_text(target: str) -> str:
    normalized = (target or "").strip()
    if not normalized:
        return ""
    normalized = re.sub(r"^(?:简历(?:里|中|上的?)?(?:的)?)", "", normalized)
    normalized = normalized.strip()
    if normalized.endswith("的"):
        normalized = normalized[:-1].strip()
    return normalized


def _resolve_generic_target_to_path(target: str) -> Tuple[Optional[str], Optional[int], str]:
    normalized = _normalize_target_text(target)
    if not normalized:
        return None, None, ""

    direct_path = _BASIC_FIELD_ALIAS_TO_PATH.get(normalized)
    if direct_path:
        return direct_path, None, normalized

    company_match = re.match(
        r"^(?:第)?([一二三四五六七八九十]|\d+)(?:段)?(?:实习|工作)?(?:经历)?(?:公司)$",
        normalized,
        re.IGNORECASE,
    ) or re.match(
        r"^(?:实习|工作)?(?:经历)?(?:公司)([一二三四五六七八九十]|\d+)$",
        normalized,
        re.IGNORECASE,
    )
    if company_match:
        index = _parse_cn_index(company_match.group(1))
        if index is not None:
            return f"internships[{index}].company", index, normalized

    return None, None, normalized


def _parse_cn_index(index_text: str) -> Optional[int]:
    index_text = (index_text or "").strip()
    if not index_text:
        return None

    mapping = {
        "一": 1,
        "二": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
        "十": 10,
    }
    if index_text in mapping:
        return mapping[index_text] - 1

    if index_text.isdigit():
        value = int(index_text)
        if value > 0:
            return value - 1
    return None


def normalize_simple_edit_text(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return ""

    normalized = _TOOL_TAG_RE.sub(" ", raw)
    normalized = _SPACE_RE.sub(" ", normalized).strip()

    # Strip polite wrappers from both ends so "帮我把名字改成李四，谢谢"
    # still hits deterministic fast-path.
    for _ in range(2):
        next_text = _LEADING_PREFIX_RE.sub("", normalized).strip()
        if next_text == normalized:
            break
        normalized = next_text
    normalized = _TRAILING_POLITE_RE.sub("", normalized).strip()
    return normalized


def parse_fast_simple_edit_text(user_input: str) -> Optional[Dict[str, Any]]:
    text = normalize_simple_edit_text(user_input)
    if not text:
        return None

    for pattern in _NAME_PATTERNS:
        match = re.match(pattern, text, re.IGNORECASE)
        if not match:
            continue
        new_name = (match.group(1) or "").strip().strip("'\"")
        if not new_name:
            return None
        return {
            "path": "basic.name",
            "action": "update",
            "value": new_name,
            "section": "basic",
            "field": "name",
            "index": None,
            "normalized_text": text,
        }

    for pattern in _INTERNSHIP_COMPANY_PATTERNS:
        internship_match = pattern.match(text)
        if not internship_match:
            continue
        index = _parse_cn_index(internship_match.group(1))
        company = (internship_match.group(2) or "").strip().strip("'\"")
        if index is None or not company:
            return None
        return {
            "path": f"internships[{index}].company",
            "action": "update",
            "value": company,
            "section": "internships",
            "field": "company",
            "index": index,
            "normalized_text": text,
        }

    generic_match = _GENERIC_EDIT_PATTERN.match(text)
    if generic_match:
        raw_target = (generic_match.group(1) or "").strip()
        value = (generic_match.group(2) or "").strip().strip("'\"")
        if not raw_target or not value:
            return None
        path, index, normalized_target = _resolve_generic_target_to_path(raw_target)
        if not path:
            return None
        field = path.split(".")[-1]
        return {
            "path": path,
            "action": "update",
            "value": value,
            "section": "basic" if path.startswith("basic.") else "internships",
            "field": field,
            "index": index,
            "target": normalized_target,
            "normalized_text": text,
        }

    return None
