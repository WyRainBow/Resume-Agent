"""覆盖度回验（2026-07-12）：改写前后关键实体（数字/专有名词）是否还在。

固化独立 review（a0a1a61982bb52015）实测发现的假阳性/假阴性用例，
防止后续正则改动无声破坏行为。
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

import pytest

from backend.agent.utils.coverage_check import (
    extract_facts,
    extract_number_facts,
    check_coverage,
    check_invented,
)


# ---- 原始截图 bug 场景：回归基线，绝不能再退回 ----

def test_original_screenshot_case_detects_loss():
    old = (
        "<ul><li><strong>Agent Swarm 协作系统</strong>："
        "智能路由（70%单Agent快速通道/30%Swarm协作模式），"
        "复杂问题自动分解任务并分配给多个Agent并行执行。</li></ul>"
    )
    new_bad = "<p>主导设计并落地Step-RL强化学习框架。</p>"
    missing = check_coverage(old, new_bad)
    assert "Swarm" in missing
    assert "70%" in missing
    assert "30%" in missing


def test_preserved_content_no_false_positive():
    old = "<p>QPS 提升3倍</p>"
    new_good = "<p>系统 QPS 提升3倍，响应更快</p>"
    assert check_coverage(old, new_good) == []


# ---- 停用词降噪：国内简历高频通用缩写不应误报 ----

@pytest.mark.parametrize(
    "text",
    [
        "熟练使用 PPT、Word、Excel 制作报表",
        "获得 ACM 竞赛二等奖",
        "熟悉 Office 办公软件，持有 CFA 一级证书",
        "负责 KPI 制定与 OKR 拆解",
        "GPA 3.8/4.0",
    ],
)
def test_common_abbreviations_not_flagged(text):
    facts = extract_facts(text)
    # 通用缩写本身不应出现在提取结果里（数字仍可能被提取，如 GPA 场景里的分数）
    noise_terms = {"PPT", "WORD", "EXCEL", "OFFICE", "ACM", "CFA", "KPI", "OKR", "GPA"}
    assert not any(f.upper() in noise_terms for f in facts)


# ---- 数字表达覆盖：TOP N / 百分点 / 时长 / 计数单位 / 货币 / 全角 ----

@pytest.mark.parametrize(
    "text,expected_substr",
    [
        ("TOP 3", "TOP 3"),
        ("耗时从2小时缩短到10分钟", "2小时"),
        ("转化率提升1.5个百分点", "1.5个百分点"),
        ("订单量突破10000单", "10000单"),
        ("拉新5000+人", "5000+人"),
        ("$500,000 融资", "$500,000"),
        ("全年营收增长３０％", "30%"),  # 全角转半角
    ],
)
def test_number_patterns_extracted(text, expected_substr):
    facts = extract_facts(text)
    assert expected_substr in facts, f"{text!r} 应提取到 {expected_substr!r}，实际 {facts}"


# ---- action=add/delete 不适用覆盖度校验，仅在此记录预期（真正接入点见 cv_editor_agent_tool.py）----

def test_empty_old_text_no_facts():
    assert extract_facts("") == []
    assert extract_facts(None) == []


def test_check_coverage_empty_old_returns_empty():
    assert check_coverage("", "<p>任何新内容</p>") == []


# ---- 反向"疑似编造"校验（check_invented）：改写后凭空多出的数字才报，技术名词不报 ----

def test_invented_percentage_flagged():
    # 原文只说"提升效率"，改写量化成"提升35%"——凭空编造的百分比，必须报
    old = "<p>负责后端优化，显著提升了系统效率</p>"
    new_bad = "<p>负责后端优化，将系统效率提升了35%</p>"
    invented = check_invented(old, new_bad)
    assert "35%" in invented


def test_invented_multiplier_flagged():
    old = "<p>重构数据链路，查询更快</p>"
    new_bad = "<p>重构数据链路，查询速度提升3倍</p>"
    assert "3倍" in check_invented(old, new_bad)


def test_invented_count_flagged():
    old = "<p>搭建活动运营体系，拉动用户增长</p>"
    new_bad = "<p>搭建活动运营体系，拉新5000+人</p>"
    assert "5000+人" in check_invented(old, new_bad)


def test_number_present_in_old_not_flagged():
    # 原文已有 70%，改写后仍是 70%——有依据，不算编造
    old = "<p>智能路由：70%走快速通道</p>"
    new_good = "<p>设计智能路由，其中 70% 请求走快速通道，显著降低延迟</p>"
    assert check_invented(old, new_good) == []


def test_fullwidth_number_in_old_not_flagged():
    # 原文全角 ３０％，改写后半角 30%——归一化后视为同一数字，不报编造
    old = "<p>营收增长３０％</p>"
    new_good = "<p>推动营收增长30%</p>"
    assert check_invented(old, new_good) == []


def test_new_tech_term_not_flagged_as_invented():
    # 新引入的技术名词（React.js/Kafka）不是数字，反向校验刻意不管它——避免噪音
    old = "<p>负责前端开发</p>"
    new_good = "<p>基于 React.js 与 Kafka 负责前端开发</p>"
    assert check_invented(old, new_good) == []


def test_reworded_tech_term_not_flagged():
    # React → React.js 换写法，不属于事实编造，不应被反向校验拦下
    old = "<p>使用 React 开发页面</p>"
    new_good = "<p>使用 React.js 开发页面</p>"
    assert check_invented(old, new_good) == []


def test_invented_and_missing_can_coexist():
    # 原始 bug 的完整形态：既删了真内容（Swarm/70%）又编了假数字（35%）
    old = (
        "<ul><li><strong>Agent Swarm 协作系统</strong>："
        "智能路由（70%单Agent快速通道/30%Swarm协作模式）</li></ul>"
    )
    new_bad = "<p>主导后端架构优化，将系统吞吐提升35%</p>"
    missing = check_coverage(old, new_bad)
    invented = check_invented(old, new_bad)
    assert "70%" in missing and "Swarm" in missing
    assert "35%" in invented


def test_invented_empty_new_returns_empty():
    assert check_invented("<p>原文</p>", "") == []
    assert check_invented("<p>原文</p>", None) == []


# ---- extract_number_facts：只出数字子集，不出专有技术名词 ----

def test_extract_number_facts_excludes_tech_terms():
    text = "基于 Spark 处理数据，QPS 提升3倍，准确率达到98%"
    nums = extract_number_facts(text)
    assert "3倍" in nums and "98%" in nums
    assert "Spark" not in nums  # 技术名词不进数字子集


def test_extract_number_facts_subset_of_extract_facts():
    text = "使用 Kafka，转化率提升1.5个百分点，订单突破10000单"
    nums = set(extract_number_facts(text))
    facts = set(extract_facts(text))
    assert nums <= facts  # 数字子集必然被完整 extract_facts 包含
    assert "Kafka" in facts and "Kafka" not in nums
