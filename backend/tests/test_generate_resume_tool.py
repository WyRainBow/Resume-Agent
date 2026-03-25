import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

import importlib.util

# Initialize logging before importing tool modules
from backend.core.logger import setup_logging
setup_logging(False, 'INFO', 'logs/test')

# Pre-load base.py directly to avoid the circular import chain that goes through
# backend.agent.tool.__init__ -> cv_analyzer_agent_tool -> resume_data_store ->
# agent.__init__ -> browser -> toolcall -> backend.agent.tool (partially initialized)
_base_path = os.path.join(
    os.path.dirname(__file__), '..', 'agent', 'tool', 'base.py'
)
_base_spec = importlib.util.spec_from_file_location('backend.agent.tool.base', _base_path)
_base_mod = importlib.util.module_from_spec(_base_spec)
sys.modules['backend.agent.tool.base'] = _base_mod
_base_spec.loader.exec_module(_base_mod)

# Now import generate_resume_tool directly
_tool_path = os.path.join(
    os.path.dirname(__file__), '..', 'agent', 'tool', 'generate_resume_tool.py'
)
_spec = importlib.util.spec_from_file_location(
    "backend.agent.tool.generate_resume_tool", _tool_path
)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["backend.agent.tool.generate_resume_tool"] = _mod
_spec.loader.exec_module(_mod)

GenerateResumeTool = _mod.GenerateResumeTool


def test_generate_resume_tool_schema():
    tool = GenerateResumeTool()
    assert tool.name == "generate_resume"
    props = tool.parameters["properties"]
    assert "job_description" in props
    assert "user_background" in props
