import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.latex_generator import json_to_latex


def test_json_to_latex_renders_custom_section_with_section_titles():
    resume = {
        "name": "张三",
        "contact": {"phone": "13800000000", "email": "a@b.com", "location": "上海"},
        "objective": "后端开发",
        "sectionTitles": {
            "custom_123": "工作经历补充",
        },
        "sectionOrder": ["custom_123"],
        "customData": {
            "custom_123": [
                {
                    "id": "item_1",
                    "title": "业务中台",
                    "subtitle": "后端开发",
                    "dateRange": "2024.01 - 2024.12",
                    "description": "<ul><li>负责核心模块设计与实现</li></ul>",
                    "visible": True,
                }
            ]
        },
    }

    latex = json_to_latex(resume, ["custom_123"])

    assert "\\section{工作经历补充}" in latex
    assert "业务中台" in latex
    assert "后端开发" in latex
    assert "2024.01 - 2024.12" in latex
    assert "负责核心模块设计与实现" in latex

