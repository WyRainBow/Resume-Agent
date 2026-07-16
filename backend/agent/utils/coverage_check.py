"""内容保真度回验：改写前后关键实体（数字指标/专有技术名词）是否还在。

只覆盖"最容易被删、最容易机械核对"的两类实体，不追求完整语义比对——
纯规则，不过 LLM，微秒级，不新增延迟或调用成本。

设计依据：knowledge-base/specs/2026-07-12-long-task-context-engineering-design.md 七点四。
"""

from __future__ import annotations

import re
from typing import List

# 数字类指标：百分比/倍数/量级单位/时长/计数/货币，整体作为一个字符串匹配
# （如 "40%"、"3倍"、"10000单"、"$500,000"）。
# 已知局限：LLM 把 "40%" 改写成 "40.0%" 或 "提升了百分之四十" 会被误判成丢失——
# 这个粗粒度校验只堵"整段消失"这种极端情况，不追求语义级精确覆盖。
_NUMBER_METRIC_RE = re.compile(
    r"\d+(?:\.\d+)?\+?\s*(?:%|‰|倍|万|亿|人|次|秒|毫秒|ms|GB|TB|MB|QPS|qps|PB"
    r"|个百分点|百分点|小时|分钟|天|月|年|单|笔|款|台|名|家|期|批|元)"
    r"|[Tt][Oo][Pp]\s*\d+"
    r"|\$\s*[\d,]+(?:\.\d+)?"
)

# 专有技术名词：大写字母开头的英文 token（Spark/Kafka/LangGraph/Agent Swarm 这类）。
# 会有一定误报噪音，但宁可多提示也不要漏判——真正降噪靠下面的停用词表。
_TECH_TERM_RE = re.compile(r"\b[A-Z][A-Za-z0-9+#.]{1,}\b")

_MIN_TERM_LEN = 2
# 国内简历高频通用缩写/办公软件名——太通用、噪音大，不纳入覆盖度追踪。
# 独立 review 实测这些词命中率极高，不排除会淹没真正有价值的信号
# （如原始 bug 场景里的 "Swarm"）。
_STOPWORDS = {
    "HTML", "CSS", "PDF", "URL", "ID",
    "PPT", "PPTX", "WORD", "EXCEL", "OFFICE", "PS", "AE", "CAD",
    "SPSS", "STATA", "MATLAB", "SQL", "GIT", "LINUX", "VIM",
    "CET", "GPA", "KPI", "OKR", "OA", "ERP", "CRM", "SAAS",
    "TOB", "TOC", "B2B", "B2C", "ACM", "CFA", "TOP",
}


def _normalize_fullwidth(text: str) -> str:
    """全角字符转半角，避免 Word 粘贴常见的全角数字/百分号（３０％）漏检。"""
    chars = []
    for ch in text:
        code = ord(ch)
        if 0xFF01 <= code <= 0xFF5E:
            chars.append(chr(code - 0xFEE0))
        elif code == 0x3000:
            chars.append(" ")
        else:
            chars.append(ch)
    return "".join(chars)


def _strip_html(text: str) -> str:
    plain = re.sub(r"<[^>]+>", " ", text or "")
    return _normalize_fullwidth(plain)


def _dedup(items: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def extract_number_facts(text: str) -> List[str]:
    """只提取数字类指标（百分比/倍数/量级/计数/货币），不含专有技术名词。

    反向"疑似编造"校验专用：技术名词换写法（React→React.js）不算编造事实，
    只有凭空多出来的数字/量化声明才是我们要防的幻觉，故这里刻意收窄到数字子集。
    与 extract_facts 共用同一套 _NUMBER_METRIC_RE，避免正则逻辑漂移。
    """
    if not text:
        return []
    plain = _strip_html(text)
    return _dedup(_NUMBER_METRIC_RE.findall(plain))


def extract_facts(text: str) -> List[str]:
    """从原文里提取数字指标和专有技术名词，作为覆盖度校验用的实体清单。"""
    if not text:
        return []
    plain = _strip_html(text)
    numbers = _NUMBER_METRIC_RE.findall(plain)
    terms = [
        t for t in _TECH_TERM_RE.findall(plain)
        if len(t) >= _MIN_TERM_LEN and t.upper() not in _STOPWORDS
    ]
    return _dedup(numbers + terms)


def check_coverage(old_text: str, new_text: str) -> List[str]:
    """返回原文里出现、但改写后文本里找不到的实体列表（可能被删减）。"""
    facts = extract_facts(old_text)
    if not facts:
        return []
    new_plain = _strip_html(new_text)
    return [f for f in facts if f not in new_plain]


def check_invented(old_text: str, new_text: str) -> List[str]:
    """反向校验：返回改写后文本里出现、但原文里找不到的数字类指标（疑似编造）。

    防的是 check_coverage 的反面——LLM 在量化包装时把"提升了效率"写成
    "提升了35%"这类凭空捏造的数字。刻意只看数字子集（extract_number_facts），
    不看专有技术名词：技术名词换写法噪音大，不属于事实编造。

    软信号，有已知假阳性（"70%"改写成"约70.0%"会误报），故上层按软提示处理、
    不做硬阻断，见设计文档 2026-07-12-career-ops-comparison-research.md 第七节。
    """
    new_facts = extract_number_facts(new_text)
    if not new_facts:
        return []
    old_plain = _strip_html(old_text)
    return [f for f in new_facts if f not in old_plain]
