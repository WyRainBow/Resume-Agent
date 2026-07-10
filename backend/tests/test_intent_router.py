"""Wave 2a-S4a IntentRouter 决策表回归:
路由判定从 think() 迁出,决策表按原 think() 行为逐条锁定——
诊断兜底 / 发送守卫 / LLM-first 全量让权 / 无简历让权 / GREETING 不让权 /
enhanced_query 清洗 / 复合请求提示 / process_input 恰好一次。
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

import backend.agent.agent.manus as manus_module  # noqa: F401 包初始化
from backend.agent.agent.intent_router import IntentRouter, RoutingContext
from backend.agent.agent.manus import (
    _looks_like_compound_request,
    _rule_intent_yield_reason,
)
from backend.agent.application.conversation.conversation_state import Intent


class FakeConversationState:
    """process_input 桩:记录调用次数,返回预设意图结果"""

    def __init__(self, result):
        self._result = result
        self.calls = 0

    async def process_input(self, **kwargs):
        self.calls += 1
        return dict(self._result)


def make_router(rule_result, llm_first=True):
    state = FakeConversationState(rule_result)
    router = IntentRouter(
        state,
        llm_first_enabled_provider=lambda: llm_first,
        yield_reason_fn=_rule_intent_yield_reason,
        compound_request_fn=_looks_like_compound_request,
    )
    return router, state


def ctx(resume=True):
    return RoutingContext(recent_messages=[], last_ai_message=None, resume_available=resume)


def run(coro):
    return asyncio.run(coro)


BASE = {
    "intent": Intent.UNKNOWN, "tool": None, "tool_args": {},
    "intent_source": "fast_rule", "enhanced_query": "", "intent_result": None,
}


# ---------- 决策表 ----------

def test_greeting_never_yields():
    router, state = make_router({**BASE, "intent": Intent.GREETING}, llm_first=True)
    out = run(router.decide("你好", ctx()))
    assert out.intent == Intent.GREETING
    assert out.yield_reason is None
    assert state.calls == 1


def test_llm_first_yields_business_intent():
    router, _ = make_router(
        {**BASE, "intent": Intent.LOAD_RESUME, "tool": "show_resume"}, llm_first=True
    )
    out = run(router.decide("帮我加载简历", ctx()))
    assert out.intent == Intent.UNKNOWN
    assert out.yield_reason == "LLM-first"
    assert out.tool is None


def test_rule_mode_keeps_business_intent():
    router, _ = make_router(
        {**BASE, "intent": Intent.LOAD_RESUME, "tool": "show_resume"}, llm_first=False
    )
    out = run(router.decide("帮我加载简历", ctx()))
    assert out.intent == Intent.LOAD_RESUME
    assert out.yield_reason is None
    assert out.tool == "show_resume"


def test_send_semantics_guard_wins_over_rule_intent():
    router, _ = make_router(
        {**BASE, "intent": Intent.OPTIMIZE_SECTION, "tool": "cv_editor_agent"},
        llm_first=False,
    )
    out = run(router.decide("把优化好的简历发给 a@qq.com", ctx()))
    assert out.intent == Intent.UNKNOWN
    assert out.yield_reason == "发送语义"


def test_compound_request_sets_hint():
    router, _ = make_router(
        {**BASE, "intent": Intent.OPTIMIZE_SECTION}, llm_first=False
    )
    out = run(router.decide("优化第二段实习经历,然后翻译成英文", ctx()))
    assert out.yield_reason == "复合请求"
    assert out.compound_hint is True


def test_no_resume_yields_optimize():
    router, _ = make_router(
        {**BASE, "intent": Intent.OPTIMIZE_SECTION}, llm_first=False
    )
    out = run(router.decide("优化第一段经历", ctx(resume=False)))
    assert out.intent == Intent.UNKNOWN
    assert out.yield_reason == "无简历"


def test_diagnosis_keyword_override():
    """「诊断」关键词兜底:UNKNOWN 强转 ANALYZE_RESUME(规则模式+有简历不让权)"""
    router, _ = make_router({**BASE, "intent": Intent.UNKNOWN}, llm_first=False)
    out = run(router.decide("帮我诊断一下简历", ctx()))
    assert out.intent == Intent.ANALYZE_RESUME


def test_enhanced_query_stripped_on_yield():
    router, _ = make_router(
        {**BASE, "intent": Intent.LOAD_RESUME, "tool": "show_resume",
         "enhanced_query": "帮我加载简历 /[tool:show_resume]"},
        llm_first=True,
    )
    out = run(router.decide("帮我加载简历", ctx()))
    assert out.enhanced_query == "帮我加载简历"  # 工具标记被清洗


def test_enhanced_query_stripped_even_without_yield_when_llm_first():
    """LLM-first 开启即全量禁止 /[tool:] 写回,intent 本来是 UNKNOWN 也一样"""
    router, _ = make_router(
        {**BASE, "intent": Intent.UNKNOWN,
         "enhanced_query": "随便聊聊 /[tool:show_resume]"},
        llm_first=True,
    )
    out = run(router.decide("随便聊聊", ctx()))
    assert out.enhanced_query == "随便聊聊"


def test_enhanced_query_kept_in_rule_mode():
    router, _ = make_router(
        {**BASE, "intent": Intent.LOAD_RESUME, "tool": "show_resume",
         "enhanced_query": "帮我加载简历 /[tool:show_resume]"},
        llm_first=False,
    )
    out = run(router.decide("帮我加载简历", ctx()))
    assert "/[tool:show_resume]" in out.enhanced_query  # 规则模式保留增强
