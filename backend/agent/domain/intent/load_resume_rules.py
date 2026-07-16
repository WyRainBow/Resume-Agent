"""Pasted-resume-import text detection.

Distinguishes "user pasted resume body text" from "user gave a file path",
so load-resume handling doesn't misroute pasted content into file-path logic.
"""

from __future__ import annotations

import re

# 对话粘贴导入（含「导入我的简历内容：…」），不应走 load_resume 文件路径逻辑
PASTE_IMPORT_PREFIX_RE = re.compile(
    r"^导入(?:我的)?(?:简历|cv)(?:内容)?\s*[：:]",
    re.IGNORECASE,
)
RESUME_BODY_HINT_RE = re.compile(
    r"教育经历|实习经历|项目经历|求职意向|工作经历",
    re.IGNORECASE,
)


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
