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


def is_fast_load_resume_text(text: str) -> bool:
    """Return True when text should hit load-resume fast path."""
    raw = (text or "").strip()
    if not raw:
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
