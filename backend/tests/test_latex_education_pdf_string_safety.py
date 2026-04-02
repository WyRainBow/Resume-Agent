import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.json_normalizer import normalize_resume_json
from backend.latex_generator import json_to_latex


def test_education_titles_define_pdf_string_safe_commands_for_logo_and_fontsize():
    resume = {
        "name": "张三",
        "contact": {"phone": "13800000000", "email": "a@b.com", "location": "北京"},
        "objective": "后端开发",
        "education": [
            {
                "title": "**北京大学**",
                "subtitle": "计算机科学与技术",
                "degree": "硕士",
                "date": "2025-09 - 2026-09",
                "logo": "北京大学",
                "logoSize": 30,
                "schoolNameFontSize": 24,
                "details": ["<p>GPA 3.8/4.0</p>"],
            }
        ],
        "sectionOrder": ["education"],
    }

    latex = json_to_latex(resume, ["education"])

    assert r"\pdfstringdefDisableCommands{" in latex
    assert r"\def\raisebox#1#2{#2}" in latex
    assert r"\def\includegraphics#1#2{}" in latex
    assert r"\def\fontsize#1#2{}" in latex
    assert r"\def\selectfont{}" in latex


def test_school_name_font_size_does_not_override_education_title():
    normalized = normalize_resume_json(
        {
            "education": [
                {
                    "title": "北京大学",
                    "subtitle": "计算机科学与技术",
                    "degree": "硕士",
                    "date": "2025-09 - 2026-09",
                    "schoolNameFontSize": 18,
                    "logo": "北京大学",
                    "logoSize": 30,
                }
            ]
        }
    )

    assert normalized["education"][0]["title"] == "北京大学"
    assert normalized["education"][0]["schoolNameFontSize"] == 18
