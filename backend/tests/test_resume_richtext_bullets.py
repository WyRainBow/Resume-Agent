"""无序列表规范化（2026-07-17）：经历类字段散文段落必须落成 custom-list。

根因回归：AI 助手对话改经历时，LLM 返回整段散文/段落 HTML，
plain_text_to_resume_html 只认显式列表标记（-/1./**标题**/；），散文漏网成 <p>。
约定：经历/项目/开源/技能(details/description/highlights/skillContent)强制无序列表，
整段包成一条 li 不猜句子边界；selfEvaluation/summary 保持段落。
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

from backend.agent.utils.resume_richtext import (
    is_bullet_required_path,
    normalize_editor_value,
)


# ---- 根因场景：散文进 → 无序列表出（原来是 <p> 段落） ----

def test_prose_string_becomes_single_bullet():
    out = normalize_editor_value(
        "负责后端接口开发与查询优化，显著降低了核心接口耗时", "experience[0].details"
    )
    assert out == (
        '<ul class="custom-list"><li><p>负责后端接口开发与查询优化，'
        "显著降低了核心接口耗时</p></li></ul>"
    )


def test_paragraph_html_becomes_single_bullet():
    out = normalize_editor_value("<p>参与核心业务模块的开发与维护</p>", "experience[1].details")
    assert out == '<ul class="custom-list"><li><p>参与核心业务模块的开发与维护</p></li></ul>'


def test_multi_paragraph_becomes_multi_bullets():
    # 一个段落一条 li，不拆句子
    out = normalize_editor_value("<p>负责A系统</p><p>优化B链路</p>", "projects[0].description")
    assert out == (
        '<ul class="custom-list"><li><p>负责A系统</p></li>'
        "<li><p>优化B链路</p></li></ul>"
    )


def test_project_and_opensource_description_covered():
    assert is_bullet_required_path("projects[2].description")
    assert is_bullet_required_path("openSource[0].description")
    assert is_bullet_required_path("experience[0].details")
    assert is_bullet_required_path("skillContent")


# ---- 豁免：自我评价/summary 保持段落体 ----

def test_self_evaluation_stays_paragraph():
    out = normalize_editor_value("三年后端经验，熟悉高并发场景。", "selfEvaluation")
    assert out == "<p>三年后端经验，熟悉高并发场景。</p>"
    assert not is_bullet_required_path("selfEvaluation")


def test_summary_stays_paragraph():
    out = normalize_editor_value("<p>一句话总结</p>", "summary")
    assert out == "<p>一句话总结</p>"


# ---- 既有行为不回退 ----

def test_existing_custom_list_unchanged():
    html = '<ul class="custom-list"><li><p><strong>治理</strong>：完成100余条</p></li></ul>'
    assert normalize_editor_value(html, "experience[0].details") == html


def test_intro_paragraph_plus_list_preserved():
    # 「引导语 <p> + <ul>」是合法结构（manus 示例格式），不得二次包裹
    html = (
        "<p>核心产出如下：</p>"
        '<ul class="custom-list"><li><p>高风险SQL治理</p></li></ul>'
    )
    assert normalize_editor_value(html, "experience[0].details") == html


def test_markdown_bullets_still_converted():
    out = normalize_editor_value("- 完成A\n- 完成B", "experience[0].details")
    assert out == (
        '<ul class="custom-list"><li><p>完成A</p></li><li><p>完成B</p></li></ul>'
    )


def test_numbered_list_still_becomes_ul():
    out = normalize_editor_value("1. 第一项\n2. 第二项", "projects[0].description")
    assert '<ul class="custom-list">' in out
    assert out.count("<li>") == 2
    assert "<ol" not in out


# ---- 边界：不丢内容、不产坏结构 ----

def test_mixed_structure_wrapped_whole_no_content_loss():
    html = "<strong>标题</strong><p>内容</p>"
    out = normalize_editor_value(html, "experience[0].details")
    assert out == f'<ul class="custom-list"><li>{html}</li></ul>'
    assert "标题" in out and "内容" in out


def test_empty_paragraph_artifact_unchanged():
    assert normalize_editor_value("<p></p>", "experience[0].details") == "<p></p>"


def test_non_richtext_path_untouched():
    assert normalize_editor_value("张三", "basic.name") == "张三"


def test_non_string_untouched():
    assert normalize_editor_value({"k": "v"}, "experience[0].details") == {"k": "v"}
