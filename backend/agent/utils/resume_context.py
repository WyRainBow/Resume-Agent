"""Canonical resume context normalization and privacy redaction."""

from __future__ import annotations

import copy
import re
from typing import Any, Dict, Mapping

from backend.agent.utils.experience_entry import coerce_tool_value


_EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")
_PRIVATE_KEYS = {
    "phone",
    "mobile",
    "telephone",
    "email",
    "wechat",
    "qq",
    "idcard",
    "identitynumber",
    "avatar",
    "avatarurl",
    "photo",
    "photourl",
    "location",
    "address",
    "residence",
    "hometown",
}
_IDENTITY_CONTAINERS = {"basic", "basics", "contact", "personalinfo", "personal_info"}


def _as_record(item: Any) -> Dict[str, Any]:
    if isinstance(item, dict):
        return item
    if isinstance(item, str):
        parsed = coerce_tool_value(item)
        if isinstance(parsed, dict):
            return parsed
    return {}


def normalize_resume_for_context(resume: Mapping[str, Any]) -> Dict[str, Any]:
    """Converge historical resume shapes before rendering or LLM analysis."""
    source = copy.deepcopy(dict(resume))
    normalized = dict(source)

    basic = source.get("basic", {})
    if isinstance(basic, str):
        basic = {"name": basic}
    elif isinstance(basic, dict):
        basic = dict(basic)
    else:
        basic = {}
    contact = source.get("contact", {})
    if not isinstance(contact, dict):
        contact = {}
    if source.get("name") and not basic.get("name"):
        basic["name"] = source["name"]
    if source.get("objective") and not basic.get("title"):
        basic["title"] = source["objective"]
    for field in ("email", "phone", "location"):
        if contact.get(field) and not basic.get(field):
            basic[field] = contact[field]
    normalized["basic"] = basic

    normalized["education"] = []
    for item in source.get("education", []):
        education = _as_record(item)
        normalized["education"].append(
            {
                **education,
                "school": education.get("school") or education.get("title") or "",
                "degree": education.get("degree") or education.get("subtitle") or "",
                "startDate": education.get("startDate", ""),
                "endDate": education.get("endDate") or education.get("date", ""),
                "description": education.get("description")
                or education.get("details", ""),
            }
        )

    normalized["experience"] = []
    experience_items = source.get("experience") or source.get("internships", [])
    for item in experience_items:
        experience = _as_record(item)
        details = experience.get("details") or experience.get("description") or ""
        highlights = experience.get("highlights")
        if not details and isinstance(highlights, list):
            details = "\n".join(str(highlight) for highlight in highlights)
        normalized["experience"].append(
            {
                **experience,
                "company": experience.get("company")
                or experience.get("title")
                or "未知公司",
                "position": experience.get("position")
                or experience.get("subtitle")
                or "",
                "date": experience.get("date") or experience.get("period") or "",
                "details": details,
            }
        )

    normalized["projects"] = [
        _as_record(item) for item in source.get("projects", [])
    ]
    normalized["openSource"] = [
        _as_record(item) for item in source.get("openSource", [])
    ]

    skills = source.get("skillContent", "")
    if not skills and isinstance(source.get("skills"), list):
        skill_lines = []
        for item in source["skills"]:
            if isinstance(item, str):
                skill_lines.append(item)
                continue
            skill = _as_record(item)
            category = skill.get("category", "")
            details = skill.get("details", "")
            if isinstance(details, list):
                details = "、".join(str(detail) for detail in details)
            if category or details:
                skill_lines.append(
                    f"{category}：{details}"
                    if category and details
                    else str(category or details)
                )
        skills = "\n".join(skill_lines)
    normalized["skillContent"] = skills
    normalized["awards"] = [
        {"title": award} if isinstance(award, str) else _as_record(award)
        for award in source.get("awards", [])
    ]
    return normalized


def redact_resume_for_llm(resume: Mapping[str, Any]) -> Dict[str, Any]:
    """Return normalized resume evidence with identity/contact fields removed."""

    def scrub(value: Any, path: tuple[str, ...] = ()) -> Any:
        if isinstance(value, Mapping):
            cleaned: dict[str, Any] = {}
            for raw_key, item in value.items():
                key = str(raw_key)
                lowered = key.lower()
                canonical_key = re.sub(r"[^a-z0-9]", "", lowered)
                parent = path[-1] if path else ""
                is_identity_name = lowered == "name" and (
                    not path or parent in _IDENTITY_CONTAINERS
                )
                if canonical_key in _PRIVATE_KEYS or is_identity_name:
                    cleaned[key] = "[已隐藏]"
                else:
                    cleaned[key] = scrub(item, (*path, lowered))
            return cleaned
        if isinstance(value, list):
            return [scrub(item, path) for item in value]
        if isinstance(value, str):
            return _EMAIL_RE.sub(
                "[邮箱已隐藏]", _PHONE_RE.sub("[电话已隐藏]", value)
            )
        return value

    return scrub(normalize_resume_for_context(resume))
