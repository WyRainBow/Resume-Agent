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


def test_custom_section_skips_redundant_item_title():
    """条目标题与模块名相同时，不再重复渲染为子标题（单块语义）。"""
    resume = {
        "name": "李嘉",
        "contact": {"phone": "13800000000", "email": "a@b.com", "location": "上海"},
        "objective": "算法工程师",
        "sectionTitles": {
            "custom_1": "竞赛与科研",
        },
        "sectionOrder": ["custom_1"],
        "customData": {
            "custom_1": [
                {
                    "id": "item_1",
                    "title": "竞赛与科研",
                    "subtitle": "",
                    "dateRange": "",
                    "description": "<p>2024 华为杯中国研究生数学建模竞赛 队长 全国三等奖</p>",
                    "visible": True,
                }
            ]
        },
    }

    latex = json_to_latex(resume, ["custom_1"])

    # 模块名仍以 \section 出现，但不应作为子标题重复
    assert latex.count("竞赛与科研") == 1
    assert "未命名条目" not in latex
    # 正文照常渲染
    assert "2024 华为杯中国研究生数学建模竞赛" in latex


def test_custom_section_empty_item_title_renders_description_only():
    """条目标题留空时，渲染只有「模块名 + 正文」，不出现「未命名条目」。"""
    resume = {
        "name": "李嘉",
        "contact": {"phone": "13800000000", "email": "a@b.com", "location": "上海"},
        "objective": "算法工程师",
        "sectionTitles": {
            "custom_2": "竞赛与科研",
        },
        "sectionOrder": ["custom_2"],
        "customData": {
            "custom_2": [
                {
                    "id": "item_1",
                    "title": "",
                    "subtitle": "",
                    "dateRange": "",
                    "description": "<ul><li>太阳能学报已录用一作</li></ul>",
                    "visible": True,
                }
            ]
        },
    }

    latex = json_to_latex(resume, ["custom_2"])

    assert "\\section{竞赛与科研}" in latex
    assert "未命名条目" not in latex
    assert "太阳能学报已录用一作" in latex


def test_default_research_and_user_custom_sections_coexist():
    """竞赛与科研（默认模块 custom_research）与用户新增自定义模块（custom_<ts>）应各自独立渲染。"""
    resume = {
        "name": "李嘉",
        "contact": {"phone": "13800000000", "email": "a@b.com", "location": "上海"},
        "objective": "算法工程师",
        "sectionTitles": {
            "custom_research": "竞赛与科研",
            "custom_1718800000000": "社会实践",
        },
        "sectionOrder": ["custom_research", "custom_1718800000000"],
        "customData": {
            "custom_research": [
                {
                    "id": "r1",
                    "title": "华为杯数学建模",
                    "subtitle": "队长",
                    "dateRange": "2024.09 - 2024.11",
                    "description": "<p>全国三等奖</p>",
                    "visible": True,
                }
            ],
            "custom_1718800000000": [
                {
                    "id": "v1",
                    "title": "支教志愿者",
                    "subtitle": "",
                    "dateRange": "",
                    "description": "<p>暑期支教一个月</p>",
                    "visible": True,
                }
            ],
        },
    }

    latex = json_to_latex(resume, ["custom_research", "custom_1718800000000"])

    # 两个模块的标题与内容都各自渲染，互不干扰
    assert "\\section{竞赛与科研}" in latex
    assert "\\section{社会实践}" in latex
    assert "华为杯数学建模" in latex
    assert "全国三等奖" in latex
    assert "支教志愿者" in latex
    assert "暑期支教一个月" in latex
    # 竞赛与科研只作为模块名出现一次（条目标题「华为杯数学建模」与模块名不同，照常渲染）
    assert latex.count("竞赛与科研") == 1

