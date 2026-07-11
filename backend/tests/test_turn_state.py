"""Wave 2a-S1 TurnExecutionState 回归:
patch 队列 FIFO / drain 清空 / reset 语义(patches 不清、flag 全清)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

from backend.agent.agent.turn_state import TurnExecutionState


def test_drain_patches_fifo_and_empties():
    turn = TurnExecutionState()
    turn.queue_patch({"patch_id": "p1"})
    turn.queue_patch({"patch_id": "p2"})

    drained = turn.drain_patches()

    assert [p["patch_id"] for p in drained] == ["p1", "p2"]
    assert turn.pending_resume_patches == []
    assert turn.drain_patches() == []


def test_reset_keeps_patches():
    """D3:patches 队列跨轮残留语义保持现状,reset 不清"""
    turn = TurnExecutionState()
    turn.queue_patch({"patch_id": "p1"})

    turn.reset_for_new_turn()

    assert len(turn.pending_resume_patches) == 1


def test_reset_clears_flags():
    turn = TurnExecutionState(
        pending_immediate_stream={"x": 1},
        pending_edit_tool_call={"tool": "cv_editor_agent"},
        finish_after_load_resume_tool=True,
        read_only=True,
    )

    turn.reset_for_new_turn()

    assert turn.pending_immediate_stream is None
    assert turn.pending_edit_tool_call is None
    assert turn.finish_after_load_resume_tool is False
    assert turn.read_only is False
