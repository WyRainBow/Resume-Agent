"""career-ops A 档 + B5 落地回归（2026-07-19）。

覆盖:A1 关键词范式/落位/铁律进 jd prompt、A2 引用铁律 + 逐字校验、
A4 中文语感进规则块 + 应届社招进体检、B5 atsChecklist 进 prompt/schema。
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

from backend.services.reason_quotes import mark_unverified_quotes
from backend.ai_phrase_blacklist import build_ai_phrase_rule_block
from backend.routes.resume import (
    JdOptimizeField,
    _build_jd_optimize_prompt,
    _build_jd_keyword_integrate_prompt,
    _build_health_check_prompt,
)

_FIELDS = [JdOptimizeField(key="exp:0", label="实习", content="负责后端开发")]


# ---- A1: 关键词改写范式 + 落位 + 铁律 ----

def test_jd_optimize_prompt_has_paradigm_placement_ironrule():
    p = _build_jd_optimize_prompt(jd_text="要求 RAG 经验", fields=_FIELDS, locale="zh")
    assert "绝不添加候选人不具备的技能" in p          # 铁律
    assert "RAG 检索管线设计与 LLM 编排" in p          # before→after 范式
    assert "第一条要点" in p and "技能区" in p          # 落位策略


def test_keyword_integrate_prompt_has_ironrule_and_placement():
    p = _build_jd_keyword_integrate_prompt(keyword="Kafka", jd_text="", fields=_FIELDS)
    assert "绝不添加候选人不具备的技能" in p
    assert "落位优先级" in p


# ---- A2: 引用铁律 + 逐字软校验 ----

def test_quote_verified_passthrough():
    src = '{"experience": "主导搜索服务拆分,超时率下降80%"}'
    reasons = ["匹配:后端经验扎实(依据:『主导搜索服务拆分』)"]
    assert mark_unverified_quotes(reasons, src) == reasons  # 逐字命中,原样


def test_quote_fabricated_gets_marked():
    src = '{"experience": "负责后端开发"}'
    reasons = ["匹配:有大数据经验(依据:『精通 Spark 集群调优』)"]
    out = mark_unverified_quotes(reasons, src)
    assert out == ["匹配:有大数据经验(依据:『精通 Spark 集群调优』(未核对))"]


def test_quote_helper_skips_non_str_and_no_quote():
    out = mark_unverified_quotes(["无引用的理由", 123, None], "任意原文")
    assert out == ["无引用的理由"]  # 非字符串丢弃,无引用原样


# ---- A4: 中文语感 + 应届/社招口径 ----

def test_rule_block_has_chinese_register():
    block = build_ai_phrase_rule_block("zh")
    assert "短句" in block and "主动语态" in block
    assert "保留英文" in block


def test_health_check_has_campus_vs_social():
    p = _build_health_check_prompt(fields=_FIELDS, locale="zh")
    assert "应届" in p and "社招" in p


# ---- B5: atsChecklist 进 prompt 与输出 schema ----

def test_jd_optimize_prompt_has_ats_checklist():
    p = _build_jd_optimize_prompt(jd_text="jd", fields=_FIELDS, locale="zh")
    assert "atsChecklist" in p
    assert "pass|fail|template" in p
    assert "模板" in p  # LaTeX 模板保证项说明
