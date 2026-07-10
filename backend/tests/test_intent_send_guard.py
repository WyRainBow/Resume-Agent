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


def test_greeting_prompt_interpolation_locked():
    """审查 #19:GREETING prompt 必须是 f-string——历史上漏了前缀导致风格指引
    以 {GREETING_STYLE_GUIDANCE} 字面量发给模型,从未生效"""
    from backend.agent.prompt.greeting import GREETING_FAST_PATH_PROMPT, GREETING_STYLE_GUIDANCE

    assert "{GREETING_STYLE_GUIDANCE}" not in GREETING_FAST_PATH_PROMPT
    assert GREETING_STYLE_GUIDANCE in GREETING_FAST_PATH_PROMPT


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


def test_llm_first_switch_changes_routing_behavior(monkeypatch):
    """行为等价迁移(Wave 2a-S4pre,原 test_llm_first_wired_into_think_source):
    LLM-first 开关必须真实接线进 think 路由——同一规则强意图,开关关闭时走
    规则 direct tool call(不让权),开关开启时让权(true 侧由
    test_llm_first_yields_rule_route_and_blocks_query_rewrite 覆盖)。
    源码字符串断言改为开关值改变路由行为的可观察差异。"""
    import asyncio

    from backend.agent.agent.manus import Manus
    from backend.agent.agent.toolcall import ToolCallAgent
    from backend.agent.application.conversation.conversation_state import Intent
    from backend.agent.schema import Message
    from backend.agent.tool.resume_data_store import ResumeDataStore

    monkeypatch.setenv("AGENT_LLM_FIRST_ROUTING", "false")
    session_id = "s-llmfirst-off-test"
    ResumeDataStore.set_data(
        {"basic": {"name": "张三"}, "experience": [], "projects": []},
        session_id=session_id,
    )
    try:
        agent = Manus(session_id=session_id, is_admin=False, user_id=1)
        agent.memory.add_message(Message.user_message("帮我加载一下我的简历"))
        agent._conversation_state.update_resume_loaded(True)

        async def fake_process_input(**kwargs):
            return {
                "intent": Intent.LOAD_RESUME,
                "tool": "show_resume",
                "tool_args": {},
                "intent_source": "fast_rule",
                "enhanced_query": None,
                "intent_result": None,
            }

        monkeypatch.setattr(agent._conversation_state, "process_input", fake_process_input)

        called = {"super_think": False}

        async def fake_super_think(self):
            called["super_think"] = True
            return False

        monkeypatch.setattr(ToolCallAgent, "think", fake_super_think)

        asyncio.run(agent.think())

        assert called["super_think"] is False, "规则模式下强意图不得让权给 LLM"
        assert agent.tool_calls and agent.tool_calls[0].function.name == "show_resume", \
            "规则模式下 LOAD_RESUME 必须走 direct tool call"
    finally:
        ResumeDataStore.clear_data(session_id)


def test_staged_edit_fast_path_guarded_by_send_semantics(monkeypatch):
    """行为等价迁移(Wave 2a-S4pre,原 test_guard_wired_into_think_source):
    staged-edit 前置快路径必须被发送守卫覆盖——「把X改成Y」+「发送到邮箱」的
    复合输入即使命中替换模式,也不得装配 staged 编辑,必须让权 LLM 工具循环。
    源码位置断言改为守卫行为断言。"""
    import asyncio

    from backend.agent.agent.manus import Manus
    from backend.agent.agent.toolcall import ToolCallAgent
    from backend.agent.application.conversation.conversation_state import Intent
    from backend.agent.schema import Message
    from backend.agent.tool.resume_data_store import ResumeDataStore

    monkeypatch.setenv("AGENT_LLM_FIRST_ROUTING", "false")  # 规则模式:快路径本会生效
    session_id = "s-staged-guard-test"
    ResumeDataStore.set_data(
        {
            "basic": {"name": "张三"},
            "experience": [{"company": "美团", "position": "后端", "date": "2023", "details": "x"}],
            "projects": [],
        },
        session_id=session_id,
    )
    try:
        agent = Manus(session_id=session_id, is_admin=False, user_id=1)
        guarded_input = "把美团改成字节跳动,然后把简历发送到 hr@qq.com"
        agent.memory.add_message(Message.user_message(guarded_input))
        agent._conversation_state.update_resume_loaded(True)

        async def fake_process_input(**kwargs):
            return {
                "intent": Intent.EDIT_CV,
                "tool": "cv_editor_agent",
                "tool_args": {"path": "experience[0].company", "action": "update", "value": "字节跳动"},
                "intent_source": "fast_rule",
                "enhanced_query": None,
                "intent_result": None,
            }

        monkeypatch.setattr(agent._conversation_state, "process_input", fake_process_input)

        called = {"super_think": False}

        async def fake_super_think(self):
            called["super_think"] = True
            return False

        monkeypatch.setattr(ToolCallAgent, "think", fake_super_think)

        asyncio.run(agent.think())

        assert agent._turn.pending_edit_tool_call is None, \
            "发送语义输入不得装配 staged 编辑"
        assert called["super_think"] is True, "守卫命中后必须让权落 ReAct loop"
        assert not agent.tool_calls, "不得由规则手工构造工具调用"
    finally:
        ResumeDataStore.clear_data(session_id)
