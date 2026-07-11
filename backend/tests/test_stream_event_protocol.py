"""Wave 1.2 事件协议回归:
1. 所有事件 to_dict 必含统一外壳 type/session_id/timestamp(此前 Thought/ToolCall/
   Answer 等自定义 to_dict 把公共字段丢掉了)
2. resume_patch / resume_generated 业务字段扁平输出(消除基类 data.data 双层嵌套;
   前端 CocoChat 的 `outerData.data ?? outerData` 两种形状均兼容)
3. %%SUGGESTIONS%% 标记提取:完整匹配 / 半开放容错 / 无标记 / 坏 JSON
4. suggestions 每 run 只发一次(step-tail 与 post-loop 双提取点防重)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

import backend.agent.agent.manus  # noqa: F401  先初始化包,避开循环导入
from backend.agent.web.streaming.agent_stream import AgentStream
from backend.agent.web.streaming.events import (
    AgentStartEvent,
    AnswerEvent,
    ResumeGeneratedEvent,
    ResumePatchEvent,
    ResumeUpdatedEvent,
    SuggestionsEvent,
    SystemEvent,
    ThoughtEvent,
    ToolCallEvent,
    ToolResultEvent,
)

SID = "s-protocol-test"


def make_stream() -> AgentStream:
    """仅测试标记提取/防重方法,不跑执行循环,绕开重量级构造依赖"""
    stream = AgentStream.__new__(AgentStream)
    stream._session_id = SID
    stream._suggestions_emitted = False
    return stream


# ---------- 1. 统一外壳 ----------

def test_all_events_carry_envelope():
    events = [
        ThoughtEvent(thought="t", session_id=SID),
        ToolCallEvent(tool_name="x", tool_args={}, session_id=SID),
        ToolResultEvent(tool_name="x", result="r", session_id=SID),
        AnswerEvent(content="a", session_id=SID),
        ResumeUpdatedEvent(resume_data={}, session_id=SID),
        ResumePatchEvent(
            patch_id="p", paths=[], before={}, after={}, summary="", session_id=SID
        ),
        ResumeGeneratedEvent(resume={}, summary="", session_id=SID),
        SuggestionsEvent(items=[], session_id=SID),
        AgentStartEvent(agent_name="m", task="t", session_id=SID),
        SystemEvent(message="m", session_id=SID),
    ]
    for event in events:
        d = event.to_dict()
        missing = {"type", "session_id", "timestamp"} - set(d)
        assert not missing, f"{type(event).__name__} 缺公共字段: {missing}"
        assert d["session_id"] == SID, f"{type(event).__name__} session_id 丢失"


# ---------- 2. 扁平业务字段 ----------

def test_resume_patch_flat_fields():
    d = ResumePatchEvent(
        patch_id="p1",
        paths=["basic.name"],
        before={"basic.name": "a"},
        after={"basic.name": "b"},
        summary="改名",
        session_id=SID,
        operation="set",
    ).to_dict()
    assert d["type"] == "resume_patch"
    assert d["patch_id"] == "p1"
    assert d["paths"] == ["basic.name"]
    assert d["before"] == {"basic.name": "a"}
    assert d["after"] == {"basic.name": "b"}
    assert d["operation"] == "set"
    assert "data" not in d  # 双层嵌套已消除


def test_resume_generated_flat_fields():
    d = ResumeGeneratedEvent(
        resume={"basic": {"name": "张三"}}, summary="done", session_id=SID
    ).to_dict()
    assert d["type"] == "resume_generated"
    assert d["resume"] == {"basic": {"name": "张三"}}
    assert d["summary"] == "done"
    assert "data" not in d


def test_tool_result_flat_contract_preserved():
    d = ToolResultEvent(
        tool_name="cv_editor_agent",
        result="ok",
        session_id=SID,
        tool_call_id="c1",
        structured_data={"type": "resume_patch"},
    ).to_dict()
    assert d["tool"] == "cv_editor_agent"
    assert d["result"] == "ok"
    assert d["tool_call_id"] == "c1"
    assert d["structured_data"] == {"type": "resume_patch"}


def test_answer_event_flat_contract_preserved():
    d = AnswerEvent(content="hello", is_complete=True, session_id=SID).to_dict()
    assert d["content"] == "hello"
    assert d["is_complete"] is True


# ---------- 3. SUGGESTIONS 标记提取 ----------

def test_extract_suggestions_full_marker():
    stream = make_stream()
    content = '回答正文\n\n%%SUGGESTIONS%%[{"text":"继续","msg":"继续优化"}]%%END%%'
    cleaned, items = stream._extract_suggestions(content)
    assert cleaned == "回答正文"
    assert items == [{"text": "继续", "msg": "继续优化"}]
    assert "%%SUGGESTIONS%%" not in cleaned


def test_extract_suggestions_partial_marker_tolerated():
    """模型没输出完 %%END%% 时半开放容错"""
    stream = make_stream()
    content = '正文\n\n%%SUGGESTIONS%%[{"text":"a","msg":"b"}'
    cleaned, items = stream._extract_suggestions(content)
    assert cleaned == "正文"
    assert items == [{"text": "a", "msg": "b"}]


def test_extract_suggestions_no_marker():
    stream = make_stream()
    cleaned, items = stream._extract_suggestions("纯正文")
    assert cleaned == "纯正文"
    assert items == []


def test_extract_suggestions_bad_json_keeps_content():
    stream = make_stream()
    content = "正文 %%SUGGESTIONS%%[not-json%%END%%"
    cleaned, items = stream._extract_suggestions(content)
    assert items == []
    assert "正文" in cleaned


# ---------- 4. suggestions 每 run 只发一次 ----------

def test_make_suggestions_event_emits_once():
    stream = make_stream()
    first = stream._make_suggestions_event([{"text": "a", "msg": "b"}])
    assert first is not None
    assert first.to_dict()["items"] == [{"text": "a", "msg": "b"}]
    assert first.to_dict()["session_id"] == SID
    # 第二次(post-loop 再提取同一标记)不再发
    second = stream._make_suggestions_event([{"text": "a", "msg": "b"}])
    assert second is None


def test_make_suggestions_event_empty_is_noop():
    stream = make_stream()
    assert stream._make_suggestions_event([]) is None
    # 空列表不占用"只发一次"额度
    assert stream._make_suggestions_event([{"text": "a", "msg": "b"}]) is not None
