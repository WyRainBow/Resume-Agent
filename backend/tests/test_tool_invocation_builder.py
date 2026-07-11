"""apply-optimization 构造回归（2026-07-11 内联收尾）：

原 ToolInvocationBuilder（含 ToolInvocation dataclass）只剩 build_apply_optimization
一个方法、唯一调用点在 manus._handle_optimize_confirm，按 §四方向一内联删除。
纯构造逻辑现落在 Manus._build_apply_optimization staticmethod，本文件改测它。
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging

setup_logging(False, "INFO", "logs/test")

from backend.agent.agent.manus import Manus


def _args(tool_call):
    return json.loads(tool_call.function.arguments)


# ────────────────────────── _build_apply_optimization ────────────────────────


def test_apply_optimization():
    tc, msg = Manus._build_apply_optimization("basic.name", "新名字", "优化标题")
    assert tc.id == "call_apply_optimization"
    assert tc.function.name == "cv_editor_agent"
    assert _args(tc) == {"path": "basic.name", "action": "update", "value": "新名字"}

    assert msg.content == "✅ 正在应用优化：优化标题\n路径：basic.name"
    assert msg.tool_calls == [tc]


def test_apply_optimization_uses_fixed_id():
    # 固定 id call_apply_optimization,与入参无关
    a = Manus._build_apply_optimization("p", "v1", "t")[0].id
    b = Manus._build_apply_optimization("p", "v2", "t")[0].id
    assert a == b == "call_apply_optimization"
