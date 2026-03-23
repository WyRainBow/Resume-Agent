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
    )
    d = evt.to_dict()
    assert d["type"] == "resume_patch"
    assert d["data"]["patch_id"] == "p1"
    assert d["data"]["paths"] == ["experience[0].details"]
    assert d["data"]["summary"] == "量化工作经历"

def test_resume_generated_event_to_dict():
    evt = ResumeGeneratedEvent(
        resume={"basic": {"name": "张三"}},
        summary="已生成后端工程师简历",
    )
    d = evt.to_dict()
    assert d["type"] == "resume_generated"
    assert d["data"]["resume"]["basic"]["name"] == "张三"
    assert d["data"]["summary"] == "已生成后端工程师简历"
