# ============================================================================
# 提示词模板系统 - 轻量级模板类
# ============================================================================

from backend.agent.prompt.base import PromptTemplate
from backend.agent.prompt.chat import ChatMessageTemplate, ChatPromptTemplate

__all__ = [
    "PromptTemplate",
    "ChatPromptTemplate",
    "ChatMessageTemplate",
]

# ============================================================================
# 现有提示词模块（保持向后兼容）
# ============================================================================

from backend.agent.prompt.manus import (
    SYSTEM_PROMPT as MANUS_SYSTEM_PROMPT,
    NEXT_STEP_PROMPT as MANUS_NEXT_STEP_PROMPT,
    GREETING_TEMPLATE,
    RESUME_ANALYSIS_SUMMARY,
    ERROR_REMINDER,
)
from backend.agent.prompt.toolcall import SYSTEM_PROMPT as TOOLCALL_SYSTEM_PROMPT
from backend.agent.prompt.cv_analyzer import (
    SYSTEM_PROMPT as CV_ANALYZER_SYSTEM_PROMPT,
    NEXT_STEP_PROMPT as CV_ANALYZER_NEXT_STEP_PROMPT,
    SIMPLE_ANALYSIS_PROMPT,
    DEEP_ANALYSIS_PROMPT,
    ERROR_PROMPT as CV_ANALYZER_ERROR_PROMPT,
)
from backend.agent.prompt.cv_reader import (
    SYSTEM_PROMPT as CV_READER_SYSTEM_PROMPT,
    NEXT_STEP_PROMPT as CV_READER_NEXT_STEP_PROMPT,
    INTRO_PROMPT,
    BASE_INTRO_PROMPT,
    ERROR_PROMPT as CV_READER_ERROR_PROMPT,
)
from backend.agent.prompt.browser import (
    SYSTEM_PROMPT as BROWSER_SYSTEM_PROMPT,
    NEXT_STEP_PROMPT as BROWSER_NEXT_STEP_PROMPT,
)
from backend.agent.prompt.mcp import (
    SYSTEM_PROMPT as MCP_SYSTEM_PROMPT,
    NEXT_STEP_PROMPT as MCP_NEXT_STEP_PROMPT,
    TOOL_ERROR_PROMPT,
    MULTIMEDIA_RESPONSE_PROMPT,
)
from backend.agent.prompt.planning import (
    PLANNING_SYSTEM_PROMPT,
    NEXT_STEP_PROMPT as PLANNING_NEXT_STEP_PROMPT,
)
from backend.agent.prompt.swe import (
    SYSTEM_PROMPT as SWE_SYSTEM_PROMPT,
)
from backend.agent.prompt.visualization import (
    SYSTEM_PROMPT as VISUALIZATION_SYSTEM_PROMPT,
)
from backend.agent.prompt.pdf_parser import (
    SYSTEM_PROMPT as PDF_PARSER_SYSTEM_PROMPT,
    ASSEMBLER_PROMPT as PDF_ASSEMBLER_PROMPT,
    SKILLS_RULES as PDF_SKILLS_RULES,
    HIGHLIGHTS_RULES as PDF_HIGHLIGHTS_RULES,
    NESTED_RULES as PDF_NESTED_RULES,
    OUTPUT_SCHEMA as PDF_OUTPUT_SCHEMA,
)

__all__.extend([
    "MANUS_SYSTEM_PROMPT",
    "MANUS_NEXT_STEP_PROMPT",
    "GREETING_TEMPLATE",
    "RESUME_ANALYSIS_SUMMARY",
    "ERROR_REMINDER",
    "TOOLCALL_SYSTEM_PROMPT",
    "CV_ANALYZER_SYSTEM_PROMPT",
    "CV_ANALYZER_NEXT_STEP_PROMPT",
    "SIMPLE_ANALYSIS_PROMPT",
    "DEEP_ANALYSIS_PROMPT",
    "CV_ANALYZER_ERROR_PROMPT",
    "CV_READER_SYSTEM_PROMPT",
    "CV_READER_NEXT_STEP_PROMPT",
    "INTRO_PROMPT",
    "BASE_INTRO_PROMPT",
    "CV_READER_ERROR_PROMPT",
    "BROWSER_SYSTEM_PROMPT",
    "BROWSER_NEXT_STEP_PROMPT",
    "MCP_SYSTEM_PROMPT",
    "MCP_NEXT_STEP_PROMPT",
    "TOOL_ERROR_PROMPT",
    "MULTIMEDIA_RESPONSE_PROMPT",
    "PLANNING_SYSTEM_PROMPT",
    "SWE_SYSTEM_PROMPT",
    "VISUALIZATION_SYSTEM_PROMPT",
    "PDF_PARSER_SYSTEM_PROMPT",
    "PDF_ASSEMBLER_PROMPT",
    "PDF_SKILLS_RULES",
    "PDF_HIGHLIGHTS_RULES",
    "PDF_NESTED_RULES",
    "PDF_OUTPUT_SCHEMA",
])
