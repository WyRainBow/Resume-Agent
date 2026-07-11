import sys, os
# Insert the project root so we can import events.py directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

# Import the events module directly (bypassing package __init__.py which triggers
# the full backend initialization chain including logging config)
import importlib.util
_events_path = os.path.join(
    os.path.dirname(__file__), '..', 'agent', 'web', 'streaming', 'events.py'
)
_spec = importlib.util.spec_from_file_location(
    "backend.agent.web.streaming.events", _events_path
)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["backend.agent.web.streaming.events"] = _mod
_spec.loader.exec_module(_mod)

ResumePatchEvent = _mod.ResumePatchEvent
ResumeGeneratedEvent = _mod.ResumeGeneratedEvent


def test_resume_patch_event_to_dict():
    evt = ResumePatchEvent(
        patch_id="p1",
        paths=["experience[0].details"],
        before={"experience": [{"details": "负责后端开发"}]},
        after={"experience": [{"details": "主导重构，QPS提升3x"}]},
        summary="量化工作经历",
        operation="update",
    )
    d = evt.to_dict()
    # Wave 1.2:业务字段扁平输出(消除 data.data 双层嵌套),公共外壳必含 session_id/timestamp
    assert d["type"] == "resume_patch"
    assert d["patch_id"] == "p1"
    assert d["paths"] == ["experience[0].details"]
    assert d["summary"] == "量化工作经历"
    assert d["operation"] == "update"
    assert "timestamp" in d and "session_id" in d

def test_resume_generated_event_to_dict():
    evt = ResumeGeneratedEvent(
        resume={"basic": {"name": "张三"}},
        summary="已生成后端工程师简历",
    )
    d = evt.to_dict()
    # Wave 1.2:业务字段扁平输出(消除 data.data 双层嵌套)
    assert d["type"] == "resume_generated"
    assert d["resume"]["basic"]["name"] == "张三"
    assert d["summary"] == "已生成后端工程师简历"

def test_resume_patch_event_session_id():
    evt = ResumePatchEvent(
        patch_id="p1", paths=[], before={}, after={}, summary="test",
        session_id="sess-123"
    )
    d = evt.to_dict()
    assert d.get("session_id") == "sess-123"
