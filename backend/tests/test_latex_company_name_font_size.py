import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.latex_generator import json_to_latex


def test_internships_item_company_font_size_overrides_global_setting():
    resume = {
        "name": "张三",
        "contact": {"phone": "13800000000", "email": "a@b.com", "location": "上海"},
        "objective": "后端开发",
        "globalSettings": {"companyNameFontSize": 18},
        "internships": [
            {
                "title": "字节跳动",
                "subtitle": "后端实习生",
                "date": "2024.01-2024.06",
                "highlights": ["负责服务开发"],
                "companyNameFontSize": 16,
            },
            {
                "title": "腾讯",
                "subtitle": "后端开发",
                "date": "2024.07-2024.12",
                "highlights": ["负责性能优化"],
            },
        ],
        "sectionOrder": ["internships"],
    }

    latex = json_to_latex(resume, ["internships"])

    # 第一条使用单条设置：16px -> 12.0pt
    assert "\\fontsize{12.0pt}{14.4pt}\\selectfont 字节跳动" in latex
    # 第二条回退全局设置：18px -> 13.5pt
    assert "\\fontsize{13.5pt}{16.2pt}\\selectfont 腾讯" in latex


def test_internships_respects_renamed_section_title_and_item_font_size():
    resume = {
        "name": "王五",
        "contact": {"phone": "13700000000", "email": "w@u.com", "location": "深圳"},
        "objective": "后端开发",
        "globalSettings": {"companyNameFontSize": 15},
        "sectionTitles": {"internships": "实习经历", "experience": "实习经历"},
        "internships": [
            {
                "title": "快手",
                "subtitle": "后端实习生",
                "date": "2024.03-2024.08",
                "highlights": ["负责接口开发"],
                "companyNameFontSize": 24,
            }
        ],
        "sectionOrder": ["internships"],
    }

    latex = json_to_latex(resume, ["internships"])

    # 标题应使用重命名后的“实习经历”
    assert "\\section{实习经历}" in latex
    # 单条字号应生效：24px -> 18.0pt
    assert "\\fontsize{18.0pt}{21.6pt}\\selectfont 快手" in latex


def test_experience_item_company_font_size_overrides_global_setting():
    resume = {
        "name": "李四",
        "contact": {"phone": "13900000000", "email": "c@d.com", "location": "北京"},
        "objective": "工程师",
        "globalSettings": {"companyNameFontSize": 17},
        "experience": [
            {
                "company": "阿里巴巴",
                "position": "后端工程师",
                "date": "2023.01-2024.01",
                "details": "<p>负责中台建设</p>",
                "companyNameFontSize": 20,
            },
            {
                "company": "美团",
                "position": "开发工程师",
                "date": "2022.01-2022.12",
                "details": "<p>负责业务迭代</p>",
            },
        ],
        "sectionOrder": ["experience"],
    }

    latex = json_to_latex(resume, ["experience"])

    # 第一条使用单条设置：20px -> 15.0pt
    assert "\\fontsize{15.0pt}{18.0pt}\\selectfont 阿里巴巴" in latex
    # 第二条回退全局设置：17px -> 12.8pt
    assert "\\fontsize{12.8pt}{15.4pt}\\selectfont 美团" in latex
