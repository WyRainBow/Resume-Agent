"""发送语义让权守卫:含「发送动词+邮箱地址」的请求,规则意图必须弃权给 LLM。

回归背景:2026-07-10 实测「把优化好的简历发给 3919720991@qq.com,告诉他我改了什么」
被"优化"关键词劫持进 OPTIMIZE 分支,send_resume_email 工具无缘被调用。
这组用例同时是意图路由评测集的第一批(方案 §8.3 评测集前置)。
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

import backend.agent.agent.manus as manus_module
from backend.agent.agent.manus import _has_send_email_intent


# --- 必须让权(发送语义) ---

def test_hijacked_sentence_from_field_report():
    assert _has_send_email_intent(
        "把优化好的简历发给 3919720991@qq.com,告诉他我改了什么"
    )


def test_send_variants():
    assert _has_send_email_intent("发送到 hr@company.com")
    assert _has_send_email_intent("帮我诊断一下然后投递到 hr@x.com")
    assert _has_send_email_intent("寄给他 a.b-c@mail.co,顺便附上建议")
    assert _has_send_email_intent("发邮件给 someone@qq.com")


# --- 不得让权(规则层的合法领地) ---

def test_field_edit_of_email_is_not_send():
    """「把邮箱改成 new@qq.com」是字段编辑,不含发送动词,规则层保留"""
    assert not _has_send_email_intent("把邮箱改成 new@qq.com")
    assert not _has_send_email_intent("我的邮箱是 me@qq.com,帮我更新到简历里")


def test_optimize_without_address_untouched():
    assert not _has_send_email_intent("优化第二段实习经历")
    assert not _has_send_email_intent("把优化好的简历再润色一下")


def test_send_talk_without_address_untouched():
    """只聊"发送"但没有具体地址:信息不足,交给规则/LLM 原有路径去追问"""
    assert not _has_send_email_intent("介绍一下发送简历的技巧")
    assert not _has_send_email_intent("怎么把简历发给 HR 比较礼貌")


def test_guard_wired_into_think_source():
    """守卫必须接在意图消费入口(白盒:防止后续重构悄悄摘掉)"""
    import inspect

    src = inspect.getsource(manus_module.Manus.think)
    assert "_has_send_email_intent" in src
    assert "发送语义让权" in src
