"""联系栏生日/年龄与状态字段合并去重"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.latex_generator import _merge_contact_status_with_birth


def test_merge_age_mode_strips_duplicate_status():
    merged = _merge_contact_status_with_birth("21 岁", "2005-03", "age")
    assert merged == "21岁"


def test_merge_collapses_corrupted_double_age_string():
    merged = _merge_contact_status_with_birth("21 岁 · 21 岁", "2005-03", "age")
    assert merged == "21岁"


def test_merge_age_prefix_status_uses_canonical_birth_text():
    merged = _merge_contact_status_with_birth("年龄：21 岁", "2005-03", "age")
    assert merged == "21岁"
