"""Wave 2a-S4b ToolInvocationBuilder 决策表回归:

manus.py 里 5 处手工构造 ToolCall 的"纯构造"逻辑收口进 ToolInvocationBuilder。
每个 build_* 方法作为纯函数直接断言返回的 ToolInvocation(tool_calls 的
name/id/arguments、structured_results 的 key 与内容、memory_messages 的条数与
文案关键子串、outcome 与 flag)。注入确定性 id_factory 屏蔽时间戳影响。
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging

setup_logging(False, "INFO", "logs/test")

from backend.agent.agent.tool_invocation_builder import (
    DispatchOutcome,
    ToolInvocation,
    ToolInvocationBuilder,
)
from backend.agent.application.conversation.conversation_state import Intent


def _fixed_factory():
    """确定性 id_factory: call_<prefix>_1(时间戳被替换,测试可稳定断言)。"""
    return lambda prefix: f"call_{prefix}_1"


def _builder():
    return ToolInvocationBuilder(id_factory=_fixed_factory())


def _args(tool_call):
    return json.loads(tool_call.function.arguments)


# ────────────────────────── build_show_resume_hint ──────────────────────────


def test_show_resume_hint():
    hint = "Thought: 我识别到你想开始处理简历。\nResponse: 先打开面板。"
    inv = _builder().build_show_resume_hint(hint)

    assert isinstance(inv, ToolInvocation)
    assert len(inv.tool_calls) == 1
    tc = inv.tool_calls[0]
    assert tc.id == "call_show_resume_1"
    assert tc.function.name == "show_resume"
    assert _args(tc) == {}

    assert inv.structured_results == {}
    assert len(inv.memory_messages) == 2
    assert inv.memory_messages[0].content == hint
    assert inv.memory_messages[1].content == "我将先打开简历选择面板。"
    assert inv.memory_messages[1].tool_calls[0].id == "call_show_resume_1"

    assert inv.outcome == DispatchOutcome.CONTINUE
    assert inv.finish_after_load_resume is False
    assert inv.just_applied_optimization is False


# ────────────────────────── build_diagnosis_phase1 ──────────────────────────


def test_diagnosis_phase1():
    resume_meta = {"name": "张三", "experience_count": 2}
    ask = "已成功读取你的简历《张三》...%%SUGGESTIONS%%[]%%END%%"
    inv = _builder().build_diagnosis_phase1(resume_meta, ask)

    assert len(inv.tool_calls) == 1
    tc = inv.tool_calls[0]
    assert tc.id == "call_get_resume_detail_1"
    assert tc.function.name == "get_resume_detail"
    assert _args(tc) == {}

    assert inv.structured_results == {
        "call_get_resume_detail_1": {
            "type": "resume_detail",
            "status": "success",
            "tool": "get_resume_detail",
            "resume": resume_meta,
        }
    }

    assert len(inv.memory_messages) == 3
    assert "已读取简历《张三》，准备进行诊断..." in inv.memory_messages[0].content
    assert inv.memory_messages[0].tool_calls[0].id == "call_get_resume_detail_1"
    assert inv.memory_messages[1].content == "获取简历详情执行成功"
    assert inv.memory_messages[1].name == "get_resume_detail"
    assert inv.memory_messages[1].tool_call_id == "call_get_resume_detail_1"
    assert inv.memory_messages[2].content == ask

    assert inv.outcome == DispatchOutcome.FINISH
    assert inv.finish_after_load_resume is False


def test_diagnosis_phase1_default_name():
    inv = _builder().build_diagnosis_phase1({}, "ASK")
    assert "已读取简历《当前简历》，准备进行诊断..." in inv.memory_messages[0].content
    assert inv.structured_results["call_get_resume_detail_1"]["resume"] == {}


# ────────────────────────── build_diagnosis_phase2 ──────────────────────────


def test_diagnosis_phase2():
    payload = {
        "resume_meta": {"name": "李四"},
        "structured": {"type": "resume_diagnosis", "score": 80},
        "response": "报告正文",
        "thought": "思考",
    }
    inv = _builder().build_diagnosis_phase2(payload)

    assert len(inv.tool_calls) == 2
    detail, diag = inv.tool_calls
    assert detail.id == "call_get_resume_detail_1"
    assert detail.function.name == "get_resume_detail"
    assert diag.id == "call_resume_diagnosis_1"
    assert diag.function.name == "resume-diagnosis"

    assert inv.structured_results["call_get_resume_detail_1"] == {
        "type": "resume_detail",
        "status": "success",
        "tool": "get_resume_detail",
        "resume": {"name": "李四"},
    }
    assert inv.structured_results["call_resume_diagnosis_1"] == {
        "type": "resume_diagnosis",
        "score": 80,
    }

    assert len(inv.memory_messages) == 3
    assert inv.memory_messages[0].content == "正在执行简历深度诊断..."
    assert len(inv.memory_messages[0].tool_calls) == 2
    assert inv.memory_messages[1].content == "获取简历详情执行成功"
    assert inv.memory_messages[1].name == "get_resume_detail"
    assert inv.memory_messages[1].tool_call_id == "call_get_resume_detail_1"
    assert inv.memory_messages[2].content == "resume-diagnosis执行成功"
    assert inv.memory_messages[2].name == "resume-diagnosis"
    assert inv.memory_messages[2].tool_call_id == "call_resume_diagnosis_1"

    assert inv.outcome == DispatchOutcome.EMIT_ONLY


# ────────────────────────── build_direct_tool_call ──────────────────────────


def test_direct_tool_call_load_resume_uses_hint():
    inv = _builder().build_direct_tool_call(
        "show_resume", {}, Intent.LOAD_RESUME, load_resume_hint="HINT"
    )
    tc = inv.tool_calls[0]
    # 固定 id call_<tool>,不经 id_factory
    assert tc.id == "call_show_resume"
    assert tc.function.name == "show_resume"
    assert _args(tc) == {}

    assert len(inv.memory_messages) == 1
    assert inv.memory_messages[0].content == "HINT"
    assert inv.outcome == DispatchOutcome.CONTINUE
    assert inv.finish_after_load_resume is True


def test_direct_tool_call_edit_cv_full_notice():
    inv = _builder().build_direct_tool_call(
        "cv_editor_agent",
        {"path": "basic.name", "value": "x"},
        Intent.EDIT_CV,
    )
    tc = inv.tool_calls[0]
    assert tc.id == "call_cv_editor_agent"
    assert _args(tc) == {"path": "basic.name", "value": "x"}

    assert len(inv.memory_messages) == 3
    assert inv.memory_messages[0].content == (
        "Thought: 我识别到你要做简历字段修改，将直接执行编辑并返回前后对比。"
    )
    assert inv.memory_messages[1].content == (
        "Response: 收到，正在修改。完成后我会给你“修改前 / 修改后”的对比结果。"
        "我现在开始执行简历修改。"
    )
    assert inv.memory_messages[2].content == "我现在开始执行简历修改。"
    assert inv.memory_messages[2].tool_calls[0].id == "call_cv_editor_agent"
    assert inv.outcome == DispatchOutcome.CONTINUE
    assert inv.finish_after_load_resume is False


def test_direct_tool_call_edit_cv_skip_notice():
    inv = _builder().build_direct_tool_call(
        "cv_editor_agent",
        {"path": "basic.name", "value": "x"},
        Intent.EDIT_CV,
        skip_pre_edit_notice=True,
    )
    assert len(inv.memory_messages) == 1
    assert inv.memory_messages[0].content == "我现在开始执行简历修改。"


def test_direct_tool_call_generic_with_section():
    inv = _builder().build_direct_tool_call(
        "cv_analyzer_agent",
        {"section": "experience"},
        Intent.OPTIMIZE_SECTION,
    )
    tc = inv.tool_calls[0]
    assert tc.id == "call_cv_analyzer_agent"
    assert len(inv.memory_messages) == 1
    assert inv.memory_messages[0].content == "我将分析您的简历，重点优化：experience"
    assert inv.finish_after_load_resume is False


def test_direct_tool_call_unknown_tool_default_description():
    inv = _builder().build_direct_tool_call(
        "some_tool", {}, Intent.OPTIMIZE_SECTION
    )
    assert inv.memory_messages[0].content == "我将调用 some_tool 工具"
    assert inv.tool_calls[0].function.arguments == "{}"


def test_direct_tool_call_cv_reader_path_completion_not_in_builder():
    # file_path 补全留在 Manus(耦合 hint LLM 输入),builder 不做补全
    inv = _builder().build_direct_tool_call(
        "cv_reader_agent", {}, Intent.LOAD_RESUME, load_resume_hint="H"
    )
    assert _args(inv.tool_calls[0]) == {}


# ────────────────────────── build_apply_optimization ─────────────────────────


def test_apply_optimization():
    inv = _builder().build_apply_optimization("basic.name", "新名字", "优化标题")
    tc = inv.tool_calls[0]
    assert tc.id == "call_apply_optimization"
    assert tc.function.name == "cv_editor_agent"
    assert _args(tc) == {"path": "basic.name", "action": "update", "value": "新名字"}

    assert len(inv.memory_messages) == 1
    assert inv.memory_messages[0].content == "✅ 正在应用优化：优化标题\n路径：basic.name"
    assert inv.outcome == DispatchOutcome.CONTINUE
    assert inv.just_applied_optimization is True
    assert inv.finish_after_load_resume is False


# ────────────────────────── id_factory 行为 ──────────────────────────


def test_default_id_factory_is_monotonic_counter():
    builder = ToolInvocationBuilder()  # 默认单调计数器
    a = builder.build_show_resume_hint("h").tool_calls[0].id
    b = builder.build_show_resume_hint("h").tool_calls[0].id
    assert a == "call_show_resume_1"
    assert b == "call_show_resume_2"


def test_fixed_ids_bypass_id_factory():
    # id_factory 抛异常也不影响固定 id 的两个 build_*
    def boom(_prefix):
        raise AssertionError("id_factory 不应被固定 id 路径调用")

    builder = ToolInvocationBuilder(id_factory=boom)
    assert (
        builder.build_direct_tool_call("show_resume", {}, Intent.LOAD_RESUME, load_resume_hint="h")
        .tool_calls[0]
        .id
        == "call_show_resume"
    )
    assert (
        builder.build_apply_optimization("p", "v", "t").tool_calls[0].id
        == "call_apply_optimization"
    )
