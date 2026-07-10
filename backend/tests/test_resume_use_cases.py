"""Wave 2a-S3 ResumeUseCases 回归:
LLM JSON 容错解析四函数(纯函数,自 manus.py 逐行迁入,断言按现状行为锁定)
+ patch 队列写入 turn_state
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

from backend.agent.agent.resume_use_cases import ResumeUseCases
from backend.agent.agent.turn_state import TurnExecutionState


def make_use_cases(turn=None):
    return ResumeUseCases(
        llm_provider=lambda: None,
        session_id="test-uc-session",
        turn_state=turn or TurnExecutionState(),
        base_prompt_provider=None,
        stream_callback_provider=lambda: None,
    )


# ---------- JSON 容错解析（现状行为锁定） ----------

def test_strip_llm_thinking_prefix_removes_think_tags():
    raw = "<think>让我想想</think>\n{\"optimized\": \"x\"}"
    out = ResumeUseCases._strip_llm_thinking_prefix(raw)
    assert out.startswith("{")


def test_strip_llm_thinking_prefix_keeps_plain_text():
    """无 think 标签的普通前言不剥离（现状语义）"""
    raw = "好的。\n{\"optimized\": \"x\"}"
    assert ResumeUseCases._strip_llm_thinking_prefix(raw) == raw


def test_extract_json_object_with_key():
    text = '前缀噪音 {"optimized_html": "<ul></ul>", "other": 2} 尾巴'
    out = ResumeUseCases._extract_json_object_with_key(text, "optimized_html")
    assert out is not None and out.startswith("{") and '"optimized_html"' in out


def test_extract_json_object_with_key_missing():
    assert ResumeUseCases._extract_json_object_with_key("没有 json", "optimized_html") is None


def test_decode_json_string_literal():
    # 输入是 JSON 字符串字面量的内部内容（不含外引号），转义被还原
    assert ResumeUseCases._decode_json_string_literal("a\\nb") == "a\nb"


def test_parse_optimize_llm_json_happy_path():
    raw = '{"optimized": "更好的描述", "explanation": "量化了成果"}'
    out = ResumeUseCases._parse_optimize_llm_json(raw)
    assert isinstance(out, dict) and out.get("optimized") == "更好的描述"


def test_parse_optimize_llm_json_with_fence_and_think():
    raw = "<think>分析中</think>```json\n{\"optimized_html\": \"<ul><li>x</li></ul>\"}\n```"
    out = ResumeUseCases._parse_optimize_llm_json(raw)
    assert isinstance(out, dict) and out.get("optimized_html") == "<ul><li>x</li></ul>"


def test_parse_optimize_llm_json_garbage_returns_none():
    assert ResumeUseCases._parse_optimize_llm_json("完全不是 JSON") is None


# ---------- patch 队列归 turn_state ----------

def test_queue_optimization_patches_writes_turn_state():
    turn = TurnExecutionState()
    uc = make_use_cases(turn)
    count = uc._queue_optimization_patches(
        [
            {
                "target_label": "美团 · 后端实习生",
                "section_kind": "experience",
                "apply_path": "experience[0].details",
                "original": "旧文案",
                "optimized": "新文案",
                "summary": "优化了描述",
            },
            # 无 apply_path 的建议被跳过（现状语义）
            {"optimized": "x", "apply_path": ""},
        ]
    )
    assert count == 1
    assert len(turn.pending_resume_patches) == 1
