from backend.latex_generator import json_to_latex


def test_education_plain_description_does_not_render_as_bullet_list():
    resume = {
        "name": "测试用户",
        "education": [
            {
                "title": "华南农业大学珠江学院",
                "subtitle": "国际经济与贸易",
                "degree": "本科",
                "date": "2023-09 - 2027-06",
                "details": [
                    "<p>主修课程：高等数学、管理学原理、微观经济学</p>",
                ],
            }
        ],
        "sectionTitles": {"education": "教育经历"},
    }

    latex = json_to_latex(resume, ["education"])

    assert "主修课程" in latex
    assert "\\begin{itemize}" not in latex
    assert "\\item 主修课程" not in latex


def test_education_list_description_keeps_bullet_list():
    resume = {
        "name": "测试用户",
        "education": [
            {
                "title": "华南农业大学珠江学院",
                "subtitle": "国际经济与贸易",
                "degree": "本科",
                "date": "2023-09 - 2027-06",
                "details": [
                    "<ul><li><p>获得校级奖学金</p></li><li><p>通过英语六级</p></li></ul>",
                ],
            }
        ],
        "sectionTitles": {"education": "教育经历"},
    }

    latex = json_to_latex(resume, ["education"])

    assert "\\begin{itemize}" in latex
    assert "\\item 获得校级奖学金" in latex
    assert "\\item 通过英语六级" in latex
