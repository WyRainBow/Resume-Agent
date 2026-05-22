"""新增/导入实习经历时的字段规范化（对齐前端 ResumeData.experience）。"""

from __future__ import annotations

import json
import re
import uuid
import copy
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional

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


def _normalize_match_text(text: str) -> str:
    """匹配用：去掉 markdown 强调与空白。"""
    return re.sub(r"\*+", "", (text or "")).replace(" ", "").strip()


def _strip_trailing_de(text: str) -> str:
    """去掉尾缀「的」，但保留「美的」等两字简称。"""
    if len(text) <= 2:
        return text
    return re.sub(r"的+$", "", text)


def _clean_experience_query_fragment(fragment: str) -> str:
    """去掉查询片段首尾的功能词，保留「美的」等公司简称。"""
    cleaned = _normalize_match_text(fragment)
    if not cleaned:
        return ""
    cleaned = _strip_trailing_de(cleaned)
    previous = None
    while cleaned != previous:
        previous = cleaned
        cleaned = _OPTIMIZE_QUERY_PREFIX_RE.sub("", cleaned)
        next_cleaned = _OPTIMIZE_QUERY_SUFFIX_RE.sub("", cleaned)
        if len(next_cleaned) < 2 <= len(cleaned):
            break
        cleaned = next_cleaned
        cleaned = _strip_trailing_de(cleaned)
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


def _normalize_optimize_query_text(text: str) -> str:
    """去掉优化指令常见尾缀，便于匹配公司简称。"""
    normalized = _normalize_match_text(text)
    suffixes = (
        "的内容",
        "的描述",
        "的经历",
        "的实习经历",
        "的工作经历",
        "的实习",
        "的工作",
    )
    for suffix in suffixes:
        if not normalized.endswith(suffix):
            continue
        candidate = normalized[: -len(suffix)]
        # 避免「优化美的实习」→「优化美」误截断公司简称
        probe = _clean_experience_query_fragment(candidate)
        if len(probe) >= 2:
            normalized = candidate
            break
    return normalized


def is_generic_optimize_section_query(user_input: str) -> bool:
    """是否为未指明具体经历的泛化优化请求（如「优化实习经历」）。"""
    normalized = _normalize_optimize_query_text(user_input or "")
    core = _clean_experience_query_fragment(normalized)
    if len(core) < 2:
        return True
    if core in {
        "实习",
        "经历",
        "工作",
        "实习经历",
        "工作经历",
        "开源",
        "开源经历",
    }:
        return True
    return False


SectionKind = Literal["experience", "opensource"]


@dataclass(frozen=True)
class OptimizeTarget:
    array_path: str
    index: int
    value_field: str
    label: str
    section_kind: SectionKind


def _opensource_list(resume_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = resume_data.get("openSource")
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    return []


def _entry_display_label(raw: Dict[str, Any], kind: SectionKind) -> str:
    if kind == "opensource":
        return re.sub(r"\*+", "", str(raw.get("name") or raw.get("title") or "")).strip()
    return re.sub(r"\*+", "", _experience_company_label(raw)).strip()


def _section_cn_name(kind: SectionKind) -> str:
    return "开源经历" if kind == "opensource" else "实习经历"


def _iter_optimize_sections(
    resume_data: Dict[str, Any],
) -> List[tuple[str, SectionKind, List[Dict[str, Any]], str]]:
    sections: List[tuple[str, SectionKind, List[Dict[str, Any]], str]] = []
    exp_path, experiences = resolve_experience_list(resume_data)
    if experiences:
        sections.append((exp_path, "experience", experiences, "details"))
    opensource = _opensource_list(resume_data)
    if opensource:
        sections.append(("openSource", "opensource", opensource, "description"))
    return sections


def _make_optimize_target(
    array_path: str,
    index: int,
    raw: Dict[str, Any],
    kind: SectionKind,
    value_field: str,
) -> OptimizeTarget:
    return OptimizeTarget(
        array_path=array_path,
        index=index,
        value_field=value_field,
        label=_entry_display_label(raw, kind) or f"第{index + 1}段",
        section_kind=kind,
    )


def list_optimize_targets(resume_data: Dict[str, Any]) -> List[OptimizeTarget]:
    targets: List[OptimizeTarget] = []
    for array_path, kind, entries, value_field in _iter_optimize_sections(resume_data):
        for idx, raw in enumerate(entries):
            targets.append(_make_optimize_target(array_path, idx, raw, kind, value_field))
    return targets


def build_optimize_clarification_suggestions(
    resume_data: Dict[str, Any],
) -> List[Dict[str, str]]:
    items: List[Dict[str, str]] = []
    for array_path, kind, entries, _ in _iter_optimize_sections(resume_data):
        for idx, raw in enumerate(entries):
            if not isinstance(raw, dict):
                continue
            label = _entry_display_label(raw, kind) or f"第{idx + 1}段"
            section_name = _section_cn_name(kind)
            if kind == "experience":
                position = re.sub(
                    r"\*+",
                    "",
                    str(raw.get("position") or raw.get("role") or "").strip(),
                ).strip()
                display = f"{label} · {position}" if position else label
            else:
                display = label
            items.append(
                {
                    "text": display,
                    "msg": f"优化{label}的{section_name}",
                }
            )
    return items


def _score_entry_against_text(
    normalized_text: str,
    raw: Dict[str, Any],
    kind: SectionKind,
) -> int:
    label = _normalize_match_text(_entry_display_label(raw, kind))
    if not label:
        return 0

    score = 0
    if label in normalized_text:
        score = max(score, len(label) + 10)

    short = label.split("|")[0].split("—")[0].split("-")[0].strip()
    if len(short) >= 2 and short in normalized_text:
        score = max(score, len(short) + 8)

    for token in re.split(r"[\|｜—\-/（）()]", label):
        token = _normalize_match_text(token)
        if len(token) >= 2 and token in normalized_text:
            score = max(score, len(token) + 3)

    if kind == "experience":
        position = _normalize_match_text(
            str(raw.get("position") or raw.get("role") or "").strip()
        )
        if position and position in normalized_text:
            score = max(score, len(position) + 6)

    query_tokens = _extract_experience_query_tokens(normalized_text)
    for keyword in query_tokens:
        keyword = _normalize_match_text(keyword)
        if len(keyword) < 2:
            continue
        if keyword in label:
            score = max(score, len(keyword) + 15)
        if label in keyword:
            score = max(score, len(label) + 12)
        if len(short) >= 2 and keyword in short:
            score = max(score, len(keyword) + 13)

    return score


def _resolve_best_target_in_text(
    text: str,
    resume_data: Dict[str, Any],
) -> Optional[OptimizeTarget]:
    normalized = _normalize_match_text(text)
    if not normalized:
        return None

    candidates: List[tuple[int, OptimizeTarget]] = []
    for array_path, kind, entries, value_field in _iter_optimize_sections(resume_data):
        for idx, raw in enumerate(entries):
            if not isinstance(raw, dict):
                continue
            score = _score_entry_against_text(normalized, raw, kind)
            if score > 0:
                candidates.append(
                    (
                        score,
                        _make_optimize_target(array_path, idx, raw, kind, value_field),
                    )
                )

    if not candidates:
        return None

    candidates.sort(key=lambda item: (-item[0], item[1].index))
    if len(candidates) >= 2 and candidates[0][0] - candidates[1][0] < 3:
        return None
    return candidates[0][1]


def resolve_optimize_target_from_input(
    user_input: str,
    resume_data: Dict[str, Any],
) -> Optional[OptimizeTarget]:
    text = (user_input or "").strip()
    if not text or is_generic_optimize_section_query(text):
        return None

    target = _resolve_best_target_in_text(text, resume_data)
    if target:
        return target

    focused = _clean_experience_query_fragment(_normalize_optimize_query_text(text))
    if focused and focused != _normalize_match_text(text):
        return _resolve_best_target_in_text(focused, resume_data)
    return None


def resolve_optimize_target_from_context(
    recent_assistant_messages: List[str],
    resume_data: Dict[str, Any],
) -> Optional[OptimizeTarget]:
    """从最近 assistant 消息推断优化目标（如刚展示完 Dubbo 开源经历后用户说「优化」）。"""
    if not recent_assistant_messages:
        return None

    for msg in reversed(recent_assistant_messages[-3:]):
        target = _resolve_best_target_in_text(msg or "", resume_data)
        if target:
            return target

        # 单条 ### 标题经历：用户泛化说「优化」时直接命中
        headers = re.findall(
            r"^###\s*(?:\[\d+\]\s*)?(.+?)\s*$",
            msg or "",
            re.MULTILINE,
        )
        if len(headers) == 1:
            header_target = _resolve_best_target_in_text(headers[0], resume_data)
            if header_target:
                return header_target
    return None


def resolve_optimize_target(
    user_input: str,
    recent_assistant_messages: List[str],
    resume_data: Dict[str, Any],
) -> Optional[OptimizeTarget]:
    """综合用户输入与对话上下文解析优化目标。"""
    target = resolve_optimize_target_from_input(user_input, resume_data)
    if target:
        return target
    return resolve_optimize_target_from_context(recent_assistant_messages, resume_data)


def resolve_experience_target_from_context(
    recent_assistant_messages: List[str],
    resume_data: Dict[str, Any],
) -> Optional[int]:
    """兼容旧接口：仅返回 experience/internships 下标。"""
    target = resolve_optimize_target_from_context(recent_assistant_messages, resume_data)
    if target and target.section_kind == "experience":
        return target.index
    return None


def resolve_experience_list(resume_data: Dict[str, Any]) -> tuple[str, List[Dict[str, Any]]]:
    """返回当前简历用于优化/匹配的经历数组路径与条目。"""
    exp = resume_data.get("experience")
    if isinstance(exp, list) and exp:
        return "experience", exp
    intern = resume_data.get("internships")
    if isinstance(intern, list) and intern:
        return "internships", intern
    if isinstance(exp, list):
        return "experience", exp
    if isinstance(intern, list):
        return "internships", intern
    return "experience", []


def resolve_experience_target_index(
    user_input: str,
    resume_data: Dict[str, Any],
) -> Optional[int]:
    """从用户输入中匹配 experience 条目下标（如「优化美的实习」→ 美的集团）。"""
    text = (user_input or "").strip()
    if not text:
        return None

    _, experiences = resolve_experience_list(resume_data)
    if not experiences:
        return None

    normalized = _normalize_optimize_query_text(text)
    query_tokens = _extract_experience_query_tokens(normalized)
    candidates: List[tuple[int, int, str]] = []

    for idx, raw in enumerate(experiences):
        if not isinstance(raw, dict):
            continue
        company = _normalize_match_text(_experience_company_label(raw))
        position = _normalize_match_text(
            str(raw.get("position") or raw.get("role") or "").strip()
        )
        if not company and not position:
            continue

        company_key = company
        company_short = company.split("|")[0].split("—")[0].split("-")[0].strip()
        company_short_key = company_short
        position_key = position

        score = 0
        if company_key and company_key in normalized:
            score = max(score, len(company_key) + 10)
        if company_short_key and company_short_key in normalized:
            score = max(score, len(company_short_key) + 8)

        for token in re.split(r"[\|｜—\-/（）()]", company):
            token = _normalize_match_text(token)
            if len(token) >= 2 and token in normalized:
                score = max(score, len(token) + 3)

        # 用户可能只说简称，如「美的」→「美的集团」
        for keyword in query_tokens:
            keyword = _normalize_match_text(keyword)
            if len(keyword) < 2:
                continue
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
    title = re.sub(r"\*+", "", str(suggestion.get("title") or "优化建议")).strip()
    return {
        "type": "resume_patch",
        "patch_id": str(uuid.uuid4()),
        "operation": "update",
        "paths": [apply_path],
        "before": {"_raw": current},
        "after": {"_raw": optimized},
        "summary": title,
    }
