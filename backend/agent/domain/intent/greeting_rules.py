"""Greeting intent rules.

Centralizes fast greeting detection so state manager and agent orchestration
use the same rule set.
"""

from __future__ import annotations

FAST_GREETING_HIT_WORDS = {
    "你好",
    "您好",
    "哈喽",
    "嗨",
    "在吗",
    "hello",
    "hi",
    "hey",
}


def normalize_greeting_text(text: str) -> str:
    """Normalize short greeting text for deterministic fast-path matching."""
    return (
        (text or "")
        .strip()
        .lower()
        .replace("！", "")
        .replace("!", "")
        .replace("。", "")
        .strip()
    )


def is_fast_greeting_text(text: str, max_len: int = 12) -> bool:
    """Return True when input matches greeting fast-path rules."""
    raw = (text or "").strip().lower()
    if not raw or len(raw) > max_len:
        return False
    if raw in FAST_GREETING_HIT_WORDS:
        return True
    return normalize_greeting_text(raw) in FAST_GREETING_HIT_WORDS
