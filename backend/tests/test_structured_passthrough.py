"""structured 通用透传测试:名单外工具零注册直达、坏数据不炸有日志、老工具行为不回归"""
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

import backend.agent.agent.manus  # noqa: F401  先初始化包,避开循环导入
from backend.agent.agent.manus import Manus
from backend.agent.tool.base import ToolResult


def make_agent():
    return Manus(session_id="s-structured-test")


def test_unknown_tool_with_typed_system_passes_through():
    agent = make_agent()
    result = ToolResult(
        output="ok",
        system=json.dumps({"type": "approval_request", "payload": {"x": 1}}),
    )
    agent._store_structured_tool_result("call_1", "some_future_tool", result)
    stored = agent.get_structured_tool_result("call_1")
    assert stored == {"type": "approval_request", "payload": {"x": 1}}


def test_invalid_json_system_is_dropped_not_crashed():
    agent = make_agent()
    result = ToolResult(output="ok", system="not-json{{")
    agent._store_structured_tool_result("call_2", "some_future_tool", result)
    assert agent.get_structured_tool_result("call_2") is None


def test_system_without_type_is_dropped():
    agent = make_agent()
    result = ToolResult(output="ok", system=json.dumps({"payload": 1}))
    agent._store_structured_tool_result("call_3", "some_future_tool", result)
    assert agent.get_structured_tool_result("call_3") is None


def test_no_system_is_noop():
    agent = make_agent()
    result = ToolResult(output="plain text only")
    agent._store_structured_tool_result("call_4", "some_future_tool", result)
    assert agent.get_structured_tool_result("call_4") is None


def test_legacy_cv_editor_type_gate_preserved():
    """老工具行为不变:cv_editor 非白名单 type 仍被丢弃(不走通用路径)"""
    agent = make_agent()
    result = ToolResult(
        output="ok", system=json.dumps({"type": "weird_type", "x": 1})
    )
    agent._store_structured_tool_result("call_5", "cv_editor_agent", result)
    assert agent.get_structured_tool_result("call_5") is None

    ok = ToolResult(
        output="ok",
        system=json.dumps({"type": "resume_edit_diff", "before": "a", "after": "b"}),
    )
    agent._store_structured_tool_result("call_6", "cv_editor_agent", ok)
    stored = agent.get_structured_tool_result("call_6")
    assert stored is not None and stored["type"] == "resume_edit_diff"
    assert stored["source"] == "cv_editor_agent"  # 元数据注入保留
