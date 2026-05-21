"""Normalize flattened pasted resume text before AI parsing."""

from __future__ import annotations

import re
from typing import List

SECTION_HEADERS: List[str] = [
    "教育经历",
    "实习经历",
    "工作经历",
    "项目经历",
    "项目经验",
    "开源经历",
    "专业技能",
    "技能特长",
    "荣誉奖项",
    "自我评价",
    "个人总结",
]

IMPORT_PREFIX_RE = re.compile(
    r"^导入(?:我的)?(?:简历|cv)(?:内容)?\s*[：:]\s*",
    re.IGNORECASE,
)


def normalize_pasted_resume_text(text: str) -> str:
    """
    对话粘贴的简历常为单行/空格分隔，需还原段落与 bullet 结构，
    否则 split_resume_text 无法按模块分块，LLM 易把每条职责拆成独立实习。
    """
    raw = (text or "").strip()
    if not raw:
        return raw

    raw = IMPORT_PREFIX_RE.sub("", raw)

    # bullet：「 - 架构设计」或「 - **标题**」
    raw = re.sub(r"\s+-\s+(?=\*\*|[\u4e00-\u9fff])", "\n- ", raw)

    # 模块小标题
    for label in ("项目背景", "主要工作成果", "核心职责", "性能优化成果", "参与核心业务实现"):
        raw = re.sub(rf"\s+({re.escape(label)})\s*[：:]\s*", r"\n\1：", raw)

    # 一级模块标题（支持出现在长行中间）
    for header in SECTION_HEADERS:
        raw = re.sub(
            rf"(?<=[^\n])\s+({re.escape(header)})\s*[：:]?\s*",
            rf"\n\n\1\n",
            raw,
        )

    raw = re.sub(r"\n{3,}", "\n\n", raw)
    return raw.strip()
