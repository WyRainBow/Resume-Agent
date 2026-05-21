"""新增/导入实习经历时的字段规范化（对齐前端 ResumeData.experience）。"""

from __future__ import annotations

import json
import re
import uuid
import copy
from typing import Any, Dict, List, Optional

from backend.agent.utils.resume_richtext import (
    html_to_context_text,
    normalize_editor_value,
)

_HTML_TAG_RE = re.compile(r"<[a-z][^>]*>", re.I)


def _looks_like_html(text: str) -> bool:
    return bool(_HTML_TAG_RE.search(text or ""))


def coerce_tool_value(value: Any) -> Any:
    """将工具参数 value 从 JSON 字符串解析为对象。"""
    if value is None:
        return None
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return value
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return value
    return value


def resolve_experience_add_path(path: str, resume_data: Dict[str, Any]) -> str:
    """选择应写入的数组路径（experience 或 internships）。"""
    base = (path or "experience").strip()
    if base not in ("experience", "internships"):
        return base

    exp = resume_data.get("experience")
    intern = resume_data.get("internships")
    if isinstance(exp, list):
        return "experience"
    if isinstance(intern, list):
        return "internships"
    return "experience"


_OPTIMIZE_QUERY_PREFIX_RE = re.compile(
    r"^(优化|改进|润色|修改|完善|一下|请|帮我|我的|这段|这个|关于|针对)+"
)
_OPTIMIZE_QUERY_SUFFIX_RE = re.compile(
    r"(实习|经历|工作|条目|部分|内容|一下)+$"
)


def _clean_experience_query_fragment(fragment: str) -> str:
    """去掉查询片段首尾的功能词，保留「美的」等公司简称。"""
    cleaned = (fragment or "").strip()
    if not cleaned:
        return ""
    previous = None
    while cleaned != previous:
        previous = cleaned
        cleaned = _OPTIMIZE_QUERY_PREFIX_RE.sub("", cleaned)
        cleaned = _OPTIMIZE_QUERY_SUFFIX_RE.sub("", cleaned)
    return cleaned.strip()


def _extract_experience_query_tokens(normalized_text: str) -> List[str]:
    """从「优化一下美的实习」类输入提取可能的公司/岗位关键词。"""
    text = (normalized_text or "").strip()
    if not text:
        return []

    tokens: List[str] = []
    seen: set[str] = set()

    def _add(raw: str) -> None:
        cleaned = _clean_experience_query_fragment(raw)
        if len(cleaned) >= 2 and cleaned not in seen:
            seen.add(cleaned)
            tokens.append(cleaned)

    _add(text)
    for match in re.finditer(r"[\u4e00-\u9fffA-Za-z0-9]{2,12}", text):
        _add(match.group(0))

    tokens.sort(key=len, reverse=True)
    return tokens


def _experience_company_label(raw: Dict[str, Any]) -> str:
    return str(
        raw.get("company") or raw.get("title") or raw.get("organization") or ""
    ).strip()


def resolve_experience_target_index(
    user_input: str,
    resume_data: Dict[str, Any],
) -> Optional[int]:
    """从用户输入中匹配 experience 条目下标（如「优化美的实习」→ 美的集团）。"""
    text = (user_input or "").strip()
    if not text:
        return None

    experiences = resume_data.get("experience")
    if not isinstance(experiences, list) or not experiences:
        return None

    normalized = text.replace(" ", "")
    query_tokens = _extract_experience_query_tokens(normalized)
    candidates: List[tuple[int, int, str]] = []

    for idx, raw in enumerate(experiences):
        if not isinstance(raw, dict):
            continue
        company = _experience_company_label(raw)
        position = str(raw.get("position") or raw.get("role") or "").strip()
        if not company and not position:
            continue

        company_key = company.replace(" ", "")
        company_short = company.split("|")[0].split("—")[0].split("-")[0].strip()
        company_short_key = company_short.replace(" ", "")
        position_key = position.replace(" ", "")

        score = 0
        if company_key and company_key in normalized:
            score = max(score, len(company_key) + 10)
        if company_short_key and company_short_key in normalized:
            score = max(score, len(company_short_key) + 8)

        for token in re.split(r"[\|｜—\-/（）()]", company):
            token = token.strip().replace(" ", "")
            if len(token) >= 2 and token in normalized:
                score = max(score, len(token) + 3)

        # 用户可能只说简称，如「美的」→「美的集团」
        for keyword in query_tokens:
            if company_key and keyword in company_key:
                score = max(score, len(keyword) + 15)
            if company_key and company_key in keyword:
                score = max(score, len(company_key) + 12)
            if company_short_key and keyword in company_short_key:
                score = max(score, len(keyword) + 13)
            if position_key and keyword in position_key:
                score = max(score, len(keyword) + 6)

        if score > 0:
            candidates.append((score, idx, company or position))

    if not candidates:
        return None

    candidates.sort(key=lambda item: (-item[0], item[1]))
    return candidates[0][1]


def normalize_experience_add_entry(
    value: Any,
    *,
    array_path: str = "experience",
    index_hint: int = 0,
) -> Dict[str, Any]:
    """
    规范化为前端 ResumeData.experience 条目：
    id, company, position, date, details(HTML), visible
    """
    entry = coerce_tool_value(value)
    if isinstance(entry, str):
        entry = {"details": entry}
    if not isinstance(entry, dict):
        raise ValueError("add 操作的 value 必须是 JSON 对象")

    company = str(
        entry.get("company")
        or entry.get("title")
        or entry.get("organization")
        or ""
    ).strip()
    position = str(
        entry.get("position")
        or entry.get("subtitle")
        or entry.get("role")
        or ""
    ).strip()
    date = str(
        entry.get("date") or entry.get("period") or entry.get("duration") or ""
    ).strip()

    details_raw = entry.get("details") or entry.get("description") or ""
    if isinstance(details_raw, list):
        details_raw = "\n".join(str(x) for x in details_raw)
    details = str(details_raw).strip()
    details_path = f"{array_path}[{index_hint}].details"
    if details:
        # 始终规范化：拆内联 1.2.3. / · 为多条 custom-list
        if _looks_like_html(details) and "custom-list" not in details:
            details = normalize_editor_value(details, details_path)
        elif not _looks_like_html(details):
            details = normalize_editor_value(details, details_path)
        elif details.count("<li") <= 1 and (
            re.search(r"\d+\.\s+", details)
            or details.count("；") >= 2
            or len(html_to_context_text(details)) > 280
        ):
            details = normalize_editor_value(
                html_to_context_text(details), details_path
            )

    entry_id = str(entry.get("id") or "").strip() or f"exp_{uuid.uuid4().hex[:8]}"

    normalized: Dict[str, Any] = {
        "id": entry_id,
        "company": company,
        "position": position,
        "date": date,
        "details": details,
        "visible": entry.get("visible", True),
    }
    if entry.get("companyLogo"):
        normalized["companyLogo"] = entry.get("companyLogo")
    if entry.get("companyLogoSize") is not None:
        normalized["companyLogoSize"] = entry.get("companyLogoSize")
    return normalized


def to_internships_schema(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Agent 内存为后端 internships 数组时，转换为 title/subtitle/date/highlights。"""
    details = entry.get("details") or ""
    highlights = [details] if details else []
    return {
        "title": entry.get("company") or "",
        "subtitle": entry.get("position") or "",
        "date": entry.get("date") or "",
        "highlights": highlights,
    }


def _is_skippable_array_item(item: Any) -> bool:
    return item is None or item == {} or item == []


def _sanitize_experience_list(items: Any, *, array_path: str = "experience") -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    cleaned: List[Dict[str, Any]] = []
    for idx, raw in enumerate(items):
        if _is_skippable_array_item(raw):
            continue
        try:
            if isinstance(raw, str):
                parsed = coerce_tool_value(raw)
                if not isinstance(parsed, dict):
                    continue
                raw = parsed
            if not isinstance(raw, dict):
                continue
            cleaned.append(
                normalize_experience_add_entry(
                    raw, array_path=array_path, index_hint=idx
                )
            )
        except (ValueError, TypeError):
            continue
    return cleaned


def sanitize_resume_payload(resume_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    修复历史污染数据：experience 中的 JSON 字符串、空占位对象、basic 非 dict 等。
    """
    if not isinstance(resume_data, dict):
        return {}

    data = copy.deepcopy(resume_data)

    basic = data.get("basic") or data.get("basics")
    if isinstance(basic, str):
        data["basic"] = {"name": basic.strip()}
    elif not isinstance(basic, dict):
        data["basic"] = {}

    if "experience" in data:
        data["experience"] = _sanitize_experience_list(
            data.get("experience"), array_path="experience"
        )

    if "internships" in data and isinstance(data.get("internships"), list):
        intern_clean: List[Dict[str, Any]] = []
        for idx, raw in enumerate(data["internships"]):
            if _is_skippable_array_item(raw):
                continue
            if isinstance(raw, str):
                parsed = coerce_tool_value(raw)
                if not isinstance(parsed, dict):
                    continue
                raw = parsed
            if not isinstance(raw, dict):
                continue
            if "company" in raw or "details" in raw:
                workspace = normalize_experience_add_entry(
                    raw, array_path="internships", index_hint=idx
                )
                intern_clean.append(to_internships_schema(workspace))
            else:
                intern_clean.append(raw)
        data["internships"] = intern_clean

    return data


_INDEXED_ARRAY_ITEM_RE = re.compile(r"^(experience|internships)\[(\d+)\]$")


def is_indexed_array_item_path(path: str) -> bool:
    """路径是否为 experience[i] / internships[i] 形式的数组项。"""
    return bool(_INDEXED_ARRAY_ITEM_RE.match((path or "").strip()))


def build_indexed_patch_before(path: str, value: Any) -> Dict[str, Any]:
    """delete/update 的 before 侧：与 add 的 after 相同索引结构。"""
    return build_indexed_patch_after(path, value)


def build_indexed_patch_after(path: str, value: Any) -> Dict[str, Any]:
    """
    构造 resume_patch 的 after，避免 set_by_path 产生 [null, null, item]。
    前端 getByPath(after, 'experience[2]') 能取到 value。
    """
    from backend.agent.utils.json_path import parse_path, set_by_path

    parts = parse_path(path)
    if len(parts) == 2 and isinstance(parts[1], int):
        key, idx = parts[0], parts[1]
        arr: list = [None] * idx + [value]
        return {key: arr}

    payload: Dict[str, Any] = {}
    set_by_path(payload, path, value)
    return payload


def build_optimization_resume_patch(suggestion: Dict[str, Any]) -> Dict[str, Any]:
    """将优化建议转为 resume_patch，供前端 ResumeDiffCard 展示与应用。"""
    apply_path = str(suggestion.get("apply_path") or "").strip() or "experience[0].details"
    current = str(suggestion.get("current") or "")
    optimized = str(suggestion.get("optimized") or "")
    title = str(suggestion.get("title") or "优化建议")
    return {
        "type": "resume_patch",
        "patch_id": str(uuid.uuid4()),
        "operation": "update",
        "paths": [apply_path],
        "before": {"_raw": current},
        "after": {"_raw": optimized},
        "summary": title,
    }
