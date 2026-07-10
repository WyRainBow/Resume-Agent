"""ToolInvocationBuilder 回归（2026-07-11 LLM-first 了断后收缩）：

原 5 个构造器中 build_show_resume_hint / build_diagnosis_phase1 / phase2 /
build_direct_tool_call / build_staged_edit 只服务已删除的规则分派回退路径，
随其一并删除。仅保留 build_apply_optimization（optimize-confirm 唯一存活的
规则路径在用）。
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging

setup_logging(False, "INFO", "logs/test")

from backend.agent.agent.tool_invocation_builder import (
    ToolInvocation,
    ToolInvocationBuilder,
)


def _args(tool_call):
    return json.loads(tool_call.function.arguments)


# ────────────────────────── build_apply_optimization ─────────────────────────


def test_apply_optimization():
    inv = ToolInvocationBuilder().build_apply_optimization(
        "basic.name", "新名字", "优化标题"
    )
    tc = inv.tool_calls[0]
    assert isinstance(inv, ToolInvocation)
    assert tc.id == "call_apply_optimization"
    assert tc.function.name == "cv_editor_agent"
    assert _args(tc) == {"path": "basic.name", "action": "update", "value": "新名字"}

    assert len(inv.memory_messages) == 1
    assert inv.memory_messages[0].content == "✅ 正在应用优化：优化标题\n路径：basic.name"
    assert inv.just_applied_optimization is True


def test_apply_optimization_uses_fixed_id():
    # 固定 id call_apply_optimization,与其它 build_* 无关(其它已随规则回退删除)
    a = ToolInvocationBuilder().build_apply_optimization("p", "v1", "t").tool_calls[0].id
    b = ToolInvocationBuilder().build_apply_optimization("p", "v2", "t").tool_calls[0].id
    assert a == b == "call_apply_optimization"
