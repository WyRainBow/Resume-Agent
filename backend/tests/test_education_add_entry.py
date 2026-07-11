"""education add 规范化回归（2026-07-10 实测 bug）:
「帮我添加教育经历，我毕业于XX大学计算机专业」此前被 normalize_experience_add_entry
吞成 company/position 全空的 experience 形状条目（id 还是 exp_ 前缀）。
现在 education 走专用 normalizer:school/major/degree/startDate/endDate 保留。
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

import pytest

from backend.agent.utils.experience_entry import normalize_education_add_entry


def test_basic_education_entry():
    out = normalize_education_add_entry(
        {"school": "XX大学", "major": "计算机科学与技术", "degree": "本科",
         "startDate": "2018.09", "endDate": "2022.06"}
    )
    assert out["school"] == "XX大学"
    assert out["major"] == "计算机科学与技术"
    assert out["degree"] == "本科"
    assert out["startDate"] == "2018.09"
    assert out["endDate"] == "2022.06"
    assert out["id"].startswith("edu_")
    assert out["visible"] is True


def test_double_wrapped_education_value():
    """实测 bug 形态:LLM 把 value 包成 {"education": [ {...} ]}"""
    out = normalize_education_add_entry(
        {"education": [{"school": "XX大学", "major": "计算机专业"}]}
    )
    assert out["school"] == "XX大学"
    assert out["major"] == "计算机专业"


def test_combined_date_split():
    out = normalize_education_add_entry(
        {"school": "XX大学", "date": "2018.09 - 2022.06"}
    )
    assert out["startDate"] == "2018.09"
    assert out["endDate"] == "2022.06"


def test_title_subtitle_compat():
    """兼容老类型字段名 title/subtitle"""
    out = normalize_education_add_entry({"title": "YY大学", "subtitle": "软件工程"})
    assert out["school"] == "YY大学"
    assert out["major"] == "软件工程"


def test_no_experience_fields_leak():
    """回归锁:education 条目不得出现 experience 形状字段"""
    out = normalize_education_add_entry({"school": "XX大学"})
    assert "company" not in out
    assert "position" not in out
    assert "details" not in out


def test_string_value_treated_as_school():
    out = normalize_education_add_entry("XX大学")
    assert out["school"] == "XX大学"


def test_invalid_value_raises():
    with pytest.raises(ValueError):
        normalize_education_add_entry(12345)
