"""ATS 文本归一化（career-ops A3，2026-07-19）。

AI 生成/粘贴内容常带弯引号、em-dash、零宽空格——ATS 按关键词精确匹配时
弯引号包住的 "Python" 匹配不上直引号 Python。在富文本 → LaTeX 转换的
文本清洗阶段（LaTeX 特殊字符转义之前）统一归一化。

中英文感知：中文正文里的「——」「""」「……」是合法标点，只在 **ASCII
上下文**（英文词/数字紧邻）才归一化，避免破坏中文排版：
- 弯引号：紧邻一侧是 ASCII 字母数字 → 直引号（"Python" → "Python"）
- en/em-dash：两侧最近非空格字符都是 ASCII 字母数字 → "-"（2019–2023 → 2019-2023）
- 省略号 …：紧邻一侧 ASCII → "..."（Wait… → Wait...）
- 零宽字符（U+200B/200C/200D/FEFF）：无条件删除（任何语言都不可见且害解析）
- 不换行空格 U+00A0：无条件 → 普通空格
"""

from __future__ import annotations

import re

_ZERO_WIDTH_RE = re.compile("[​‌‍﻿]")

_ASCII = r"[A-Za-z0-9]"

# 弯引号：紧邻（内侧）是 ASCII 字母数字才转
_SINGLE_QUOTE_BEFORE_ASCII = re.compile(rf"[‘’](?={_ASCII})")
_SINGLE_QUOTE_AFTER_ASCII = re.compile(rf"(?<={_ASCII})[‘’]")
_DOUBLE_QUOTE_BEFORE_ASCII = re.compile(rf"[“”](?={_ASCII})")
_DOUBLE_QUOTE_AFTER_ASCII = re.compile(rf"(?<={_ASCII})[“”]")

# en/em-dash：两侧最近非空格都是 ASCII 才转（保留原有空格）
_DASH_ASCII = re.compile(rf"(?<={_ASCII})(\s*)[–—](\s*)(?={_ASCII})")

# 省略号：紧邻一侧 ASCII 才展开
_ELLIPSIS_ASCII = re.compile(rf"(?<={_ASCII})…|…(?={_ASCII})")


def normalize_ats_text(text: str) -> str:
    """归一化会让 ATS/旧解析器串字的字符；中文标点上下文保持原样。"""
    if not text:
        return text
    text = _ZERO_WIDTH_RE.sub("", text)
    text = text.replace(" ", " ")
    text = _SINGLE_QUOTE_BEFORE_ASCII.sub("'", text)
    text = _SINGLE_QUOTE_AFTER_ASCII.sub("'", text)
    text = _DOUBLE_QUOTE_BEFORE_ASCII.sub('"', text)
    text = _DOUBLE_QUOTE_AFTER_ASCII.sub('"', text)
    text = _DASH_ASCII.sub(r"\1-\2", text)
    text = _ELLIPSIS_ASCII.sub("...", text)
    return text
