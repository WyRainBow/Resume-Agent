from backend.agent.tool.base import BaseTool
from backend.agent.tool.bash import Bash
# BrowserUseTool 可能有额外依赖或 Pydantic 兼容性问题，设为可选
try:
    from backend.agent.tool.browser_use_tool import BrowserUseTool
except Exception:
    BrowserUseTool = None
from backend.agent.tool.create_chat_completion import CreateChatCompletion
from backend.agent.tool.cv_analyzer_agent_tool import CVAnalyzerAgentTool
from backend.agent.tool.cv_editor_agent_tool import CVEditorAgentTool
from backend.agent.tool.cv_reader_agent_tool import CVReaderAgentTool
from backend.agent.tool.cv_reader_tool import ReadCVContext
from backend.agent.tool.education_analyzer_tool import EducationAnalyzerTool
from backend.agent.tool.planning import PlanningTool
from backend.agent.tool.str_replace_editor import StrReplaceEditor
from backend.agent.tool.terminate import Terminate
from backend.agent.tool.tool_collection import ToolCollection
from backend.agent.tool.web_search import WebSearch

# Crawl4ai 可能有额外依赖，设为可选
try:
    from backend.agent.tool.crawl4ai import Crawl4aiTool
except ImportError:
    Crawl4aiTool = None


__all__ = [
    "BaseTool",
    "Bash",
    "Terminate",
    "StrReplaceEditor",
    "WebSearch",
    "ToolCollection",
    "CreateChatCompletion",
    "PlanningTool",
    "ReadCVContext",
    "CVReaderAgentTool",
    "CVAnalyzerAgentTool",
    "CVEditorAgentTool",
    "EducationAnalyzerTool",
]

if BrowserUseTool:
    __all__.append("BrowserUseTool")
if Crawl4aiTool:
    __all__.append("Crawl4aiTool")
