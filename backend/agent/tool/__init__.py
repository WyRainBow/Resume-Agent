from backend.agent.tool.ask_user_question_tool import AskUserQuestionTool
from backend.agent.tool.base import BaseTool
from backend.agent.tool.bash import Bash
# BrowserUseTool 可能有额外依赖或 Pydantic 兼容性问题，设为可选
try:
    from backend.agent.tool.browser_use_tool import BrowserUseTool
except Exception:
    BrowserUseTool = None
from backend.agent.tool.create_chat_completion import CreateChatCompletion
from backend.agent.tool.cv_analyzer_agent_tool import CVAnalyzerAgentTool
from backend.agent.tool.cv_suggestions_agent_tool import CVSuggestionsAgentTool
from backend.agent.tool.cv_editor_agent_tool import CVEditorAgentTool
from backend.agent.tool.cv_reader_agent_tool import CVReaderAgentTool
from backend.agent.tool.cv_reader_tool import ReadCVContext
from backend.agent.tool.planning import PlanningTool
from backend.agent.tool.generate_resume_tool import GenerateResumeTool
from backend.agent.tool.show_resume_tool import ShowResumeTool
from backend.agent.tool.list_resumes_tool import ListResumesTool
from backend.agent.tool.get_resume_detail_tool import GetResumeDetailTool
from backend.agent.tool.str_replace_editor import StrReplaceEditor
from backend.agent.tool.terminate import Terminate
from backend.agent.tool.tool_collection import ToolCollection

__all__ = [
    "AskUserQuestionTool",
    "BaseTool",
    "Bash",
    "Terminate",
    "StrReplaceEditor",
    "ToolCollection",
    "CreateChatCompletion",
    "PlanningTool",
    "ReadCVContext",
    "CVReaderAgentTool",
    "CVAnalyzerAgentTool",
    "CVSuggestionsAgentTool",
    "CVEditorAgentTool",
    "ShowResumeTool",
    "ListResumesTool",
    "GetResumeDetailTool",
    "GenerateResumeTool",
    "AskUserQuestionTool",
]

if BrowserUseTool:
    __all__.append("BrowserUseTool")
