"""Load-resume fast intent rules.

Keeps the fast-path trigger vocabulary in one place and reuses
`show_resume.yaml` as the primary source when available.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import List, Tuple

try:
    import yaml
except Exception:  # pragma: no cover - yaml is optional at import-time
    yaml = None


# Keep fallback generic to avoid duplicating the full keyword vocabulary that
# already lives in `configs/show_resume.yaml`.
FALLBACK_PATTERNS = (
    r"(加载|打开|查看|选择|切换).*(简历|cv)",
    r"(load|show|choose|switch).*(resume|cv)",
)

# 对话粘贴导入（含「导入我的简历内容：…」），不应走 load_resume 文件路径逻辑
PASTE_IMPORT_PREFIX_RE = re.compile(
    r"^导入(?:我的)?(?:简历|cv)(?:内容)?\s*[：:]",
    re.IGNORECASE,
)
RESUME_BODY_HINT_RE = re.compile(
    r"教育经历|实习经历|项目经历|求职意向|工作经历",
    re.IGNORECASE,
)


def _normalize_text(text: str) -> str:
    return (
        (text or "")
        .strip()
        .lower()
        .replace("！", "")
        .replace("!", "")
        .replace("。", "")
        .replace("？", "")
        .replace("?", "")
        .strip()
    )


@lru_cache(maxsize=1)
def _load_rules_from_yaml() -> Tuple[Tuple[str, ...], Tuple[str, ...]]:
    config_path = Path(__file__).resolve().parent / "configs" / "show_resume.yaml"
    if yaml is None or not config_path.exists():
        return tuple(), FALLBACK_PATTERNS

    try:
        data = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    except Exception:
        return tuple(), FALLBACK_PATTERNS

    keywords_raw: List[str] = data.get("keywords") or []
    patterns_raw: List[str] = data.get("patterns") or []

    keywords = tuple(
        kw.strip().lower()
        for kw in keywords_raw
        if isinstance(kw, str) and kw.strip()
    )
    patterns = tuple(
        p.strip()
        for p in patterns_raw
        if isinstance(p, str) and p.strip()
    ) or FALLBACK_PATTERNS
    return keywords, patterns


def is_pasted_resume_import_text(text: str) -> bool:
    """Return True when user pasted resume body text instead of a file path."""
    raw = (text or "").strip()
    if not raw:
        return False
    if PASTE_IMPORT_PREFIX_RE.search(raw):
        return True
    if len(raw) >= 200 and RESUME_BODY_HINT_RE.search(raw):
        if re.search(r"^导入", raw, re.IGNORECASE):
            return True
    return False


def is_fast_load_resume_text(text: str) -> bool:
    """Return True when text should hit load-resume fast path."""
    raw = (text or "").strip()
    if not raw:
        return False
    if is_pasted_resume_import_text(raw):
        return False

    normalized = _normalize_text(raw)
    keywords, patterns = _load_rules_from_yaml()

    if normalized in keywords:
        return True

    if any(kw in normalized for kw in keywords):
        return True

    for pattern in patterns:
        try:
            if re.search(pattern, normalized, re.IGNORECASE):
                return True
        except re.error:
            continue

    return False
