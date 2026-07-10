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
from backend.agent.agent.manus import (
    _has_send_email_intent,
    _looks_like_compound_request,
    _rule_intent_yield_reason,
)


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


# --- 复合请求让权(审计 I8 的通用解) ---

def test_compound_requests_yield():
    assert _looks_like_compound_request("优化第二段实习经历,然后翻译成英文")
    assert _looks_like_compound_request("帮我改一下名字,顺便分析一下整份简历")
    assert _looks_like_compound_request("先优化项目经历,接着生成一份新简历")
    assert _looks_like_compound_request("把腾讯改成字节,然后帮我导出 PDF")
    assert _looks_like_compound_request("润色第一段,再帮我诊断一下")


def test_single_intent_requests_do_not_yield():
    """单意图请求(哪怕很长/带修饰)必须保留给规则层,防误伤"""
    assert not _looks_like_compound_request("帮我优化一下第二段实习经历,重点突出量化成果和技术栈")
    assert not _looks_like_compound_request("把腾讯改成字节")
    assert not _looks_like_compound_request("再优化一下")  # 延续性单指令:连接词前无动词
    assert not _looks_like_compound_request("分析一下我的简历")
    assert not _looks_like_compound_request("然后呢")
    assert not _looks_like_compound_request("你好")


def test_yield_reason_aggregation():
    assert _rule_intent_yield_reason("把优化好的简历发给 a@qq.com") == "发送语义"
    assert _rule_intent_yield_reason("优化第二段,然后翻译成英文") == "复合请求"
    assert _rule_intent_yield_reason("优化第二段实习经历") is None
    assert _rule_intent_yield_reason("") is None


def test_llm_first_routing_switch(monkeypatch):
    from backend.agent.agent.manus import _llm_first_routing_enabled

    monkeypatch.delenv("AGENT_LLM_FIRST_ROUTING", raising=False)
    assert _llm_first_routing_enabled() is True  # 默认开启
    monkeypatch.setenv("AGENT_LLM_FIRST_ROUTING", "false")
    assert _llm_first_routing_enabled() is False
    monkeypatch.setenv("AGENT_LLM_FIRST_ROUTING", "true")
    assert _llm_first_routing_enabled() is True


def test_llm_first_yields_rule_route_and_blocks_query_rewrite(monkeypatch):
    """行为级白盒(Codex review):规则给出 LOAD_RESUME+tool+带 /[tool:] 标记的
    enhanced_query 时,LLM-first 必须 ①落到 super().think()(不直调工具)
    ②不把工具标记写回 memory(规则只做日志参考,不许暗中遥控)。"""
    import asyncio

    from backend.agent.agent.manus import Manus
    from backend.agent.agent.toolcall import ToolCallAgent
    from backend.agent.application.conversation.conversation_state import Intent
    from backend.agent.schema import Message, Role

    monkeypatch.setenv("AGENT_LLM_FIRST_ROUTING", "true")
    agent = Manus(session_id="s-llmfirst-test", is_admin=False, user_id=1)
    original_input = "帮我加载一下我的简历"
    agent.memory.add_message(Message.user_message(original_input))

    async def fake_process_input(**kwargs):
        return {
            "intent": Intent.LOAD_RESUME,
            "tool": "show_resume",
            "tool_args": {},
            "intent_source": "fast_rule",
            "enhanced_query": f"{original_input} /[tool:show_resume]",
            "intent_result": None,
        }

    monkeypatch.setattr(agent._conversation_state, "process_input", fake_process_input)

    called = {"super_think": False}

    async def fake_super_think(self):
        called["super_think"] = True
        return False

    monkeypatch.setattr(ToolCallAgent, "think", fake_super_think)

    asyncio.run(agent.think())

    assert called["super_think"] is True, "让权后必须落到 ReAct loop"
    user_msgs = [m for m in agent.memory.messages if m.role == Role.USER]
    assert user_msgs and "/[tool:" not in (user_msgs[-1].content or ""), \
        "规则的 enhanced_query 工具标记不得写回 memory"
    assert not agent.tool_calls, "不得由规则手工构造工具调用"


def test_llm_first_wired_into_think_source():
    import inspect

    src = inspect.getsource(manus_module.Manus.think)
    assert "LLM-first" in src
    assert "_llm_first_routing_enabled" in src


def test_guard_wired_into_think_source():
    """守卫必须接在意图消费入口(白盒:防止后续重构悄悄摘掉)"""
    import inspect

    src = inspect.getsource(manus_module.Manus.think)
    assert "_rule_intent_yield_reason" in src
    assert "让权" in src
    # staged-edit 前置快路径同样要被守卫覆盖
    assert src.index("staged-edit 快路径让权") < src.index("_extract_replace_request(user_input)\n") + 2000
