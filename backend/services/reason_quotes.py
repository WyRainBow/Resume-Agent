"""评分理由『逐字引用』软校验（career-ops A2，2026-07-19）。

评分 prompt 要求每条理由用『』引用简历原文片段；本模块校验引用是否
真的逐字出现在简历原文里——不在则追加「(未核对)」标注，防 LLM 伪造
引用。软校验：不删理由、不硬阻断。零依赖，独立于 scoring_service 可测。
"""

from __future__ import annotations

import re
from typing import Any, List

_REASON_QUOTE_RE = re.compile(r"『([^『』]{2,60})』")


def mark_unverified_quotes(reasons: List[Any], source_text: str) -> List[str]:
    """理由中『引用』的片段若不在 source_text 里逐字出现，追加「(未核对)」。"""
    out: List[str] = []
    for reason in reasons:
        if not isinstance(reason, str):
            continue
        marked = reason
        for span in _REASON_QUOTE_RE.findall(reason):
            if span not in source_text:
                marked = marked.replace(f"『{span}』", f"『{span}』(未核对)")
        out.append(marked)
    return out
