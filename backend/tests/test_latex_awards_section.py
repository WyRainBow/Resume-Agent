import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.latex_generator import json_to_latex


def _base_resume():
    return {
        "name": "张三",
        "contact": {"phone": "13800000000", "email": "a@b.com", "location": "上海"},
        "objective": "后端开发",
        "sectionOrder": ["awards"],
    }


def test_json_to_latex_renders_awards_when_only_description_exists():
    resume = _base_resume()
    resume["awards"] = [
        {
            "title": "",
            "issuer": "",
            "date": "",
            "description": "ACM 省赛一等奖",
        }
    ]

    latex = json_to_latex(resume, ["awards"])

    assert "\\section{荣誉奖项}" in latex
    assert "ACM 省赛一等奖" in latex


def test_json_to_latex_renders_awards_when_only_date_exists():
    resume = _base_resume()
    resume["awards"] = [
        {
            "title": "",
            "issuer": "",
            "date": "2023-09",
            "description": "",
        }
    ]

    latex = json_to_latex(resume, ["awards"])

    assert "\\section{荣誉奖项}" in latex
    assert "2023-09" in latex

