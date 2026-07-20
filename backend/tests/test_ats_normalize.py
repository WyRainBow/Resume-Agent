"""ATS 文本归一化 goldens（career-ops A3，2026-07-19）。

核心纪律:只在 ASCII 上下文归一化;中文正文的——/""/……是合法标点必须保持。
锁定这些行为防后续正则改动无声破坏中文排版。
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

import pytest

from backend.ats_normalize import normalize_ats_text
from backend.html_to_latex import html_to_latex


# ---- 英文/ASCII 上下文:必须归一化 ----

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("“Python”", '"Python"'),                     # 弯双引号包英文词
        ("O’Brien", "O'Brien"),                            # 撇号
        ("2019–2023", "2019-2023"),                        # en-dash 年份区间
        ("2019 – 2023", "2019 - 2023"),                    # 带空格保留空格
        ("state—of—the—art", "state-of-the-art"),  # em-dash
        ("Wait…", "Wait..."),                              # 省略号紧邻英文
    ],
)
def test_ascii_context_normalized(raw, expected):
    assert normalize_ats_text(raw) == expected


# ---- 中文上下文:合法标点保持原样 ----

@pytest.mark.parametrize(
    "raw",
    [
        "他说——你好",          # 中文破折号——
        "“中文引号”",          # 中文弯引号
        "然后……就结束了",      # 中文省略号……
    ],
)
def test_cjk_context_preserved(raw):
    assert normalize_ats_text(raw) == raw


# ---- 中英混排:英文侧转、中文侧不动 ----

def test_mixed_quotes_around_english_word():
    # 中文句子里引英文词:内侧是 ASCII → 转直引号(帮 ATS 匹配关键词)
    assert normalize_ats_text("熟悉“Python”开发") == '熟悉"Python"开发'


def test_mixed_dash_between_cjk_stays():
    # 中文—中文(单个 em-dash 也可能出现在中文里):两侧非 ASCII → 保持
    assert normalize_ats_text("前端—后端") == "前端—后端"


# ---- 无条件清理:零宽/NBSP 任何语言都删 ----

def test_zero_width_and_nbsp_removed_everywhere():
    raw = "熟悉​Python 开发﻿"
    assert normalize_ats_text(raw) == "熟悉Python 开发"


def test_empty_and_none_safe():
    assert normalize_ats_text("") == ""
    assert normalize_ats_text(None) is None


# ---- 穿透 html_to_latex(接线验证):弯引号在 LaTeX 转义前被归一 ----

def test_through_html_to_latex():
    latex = html_to_latex("<p>“Python” expert</p>")
    assert '"Python"' in latex
    assert "“" not in latex and "”" not in latex
