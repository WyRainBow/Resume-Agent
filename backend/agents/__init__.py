"""
Agents 模组

提供 AI 简历助手的核心功能，基于 LLM + 动态任务图架构：
- CoreAgent: 核心对话 Agent（支持 DYNAMIC 和 LEGACY 模式）
- DynamicAgent: 动态任务图 Agent（替代规则引擎）
- RAG 知识库: 基于 Milvus 的向量检索
- STAR 法则: 渐进式追问引导
- SessionManager: 会话管理

注意：部分模块依赖 langchain_core，未安装时使用 mock 实现
"""

# ========== 核心模块 ==========

# 核心 Agent（新版，支持动态任务图）- 懒加载
try:
    from .core_agent import (
        CoreAgent,
        AgentMode,
        AgentResponse,
        create_agent,
        handle_message_stream,
    )
except ImportError:
    CoreAgent = None
    AgentMode = None
    AgentResponse = None
    create_agent = None
    handle_message_stream = None

# 动态任务 Agent - 懒加载（依赖 langchain_core）
try:
    from .dynamic_agent import (
        LangChainResumeAgent,
        TaskGraph,
        TaskNode,
        TaskNodeType,
        create_dynamic_agent,
        LANGCHAIN_AVAILABLE,
    )
except ImportError:
    LangChainResumeAgent = None
    TaskGraph = None
    TaskNode = None
    TaskNodeType = None
    create_dynamic_agent = None
    LANGCHAIN_AVAILABLE = False

# RAG 知识库 - 懒加载
try:
    from .knowledge_base import (
        ResumeKnowledgeBase,
        STARGuidancer,
        SearchConfig,
        get_knowledge_base,
        get_star_guidancer,
    )
except ImportError:
    ResumeKnowledgeBase = None
    STARGuidancer = None
    SearchConfig = None
    get_knowledge_base = None
    get_star_guidancer = None

# 会话管理
from .session_manager import (
    Session,
    SessionManager,
    SessionStatus,
    ChatMessage,
    get_session_manager,
)

# 工具
from .tools import (
    CVReaderTool,
    CVEditorTool,
    create_cv_reader,
    create_cv_editor,
    CV_READER_FUNCTION_DEF,
    CV_EDITOR_FUNCTION_DEF,
    ALL_TOOLS_FUNCTION_DEFS
)

# 工具执行
from .tool_executor import ToolExecutor, ExecutionResult

# CV Agent 和 Agent Manager
from .cv_agent import CVAgent
from .agent_manager import AgentManager, agent_manager
from .message_builder import MessageType

# ========== 向后兼容（旧版模块，保留但标记为 legacy）==========

# 旧版任务规划器（规则引擎，可选用 DynamicAgent 替代）
from .task_planner import (
    TaskPlanner,
    IntentRecognizer as OldIntentRecognizer,
    IntentResult,
    IntentType as OldIntentType,
    create_task_planner,
    recognize_intent
)


__all__ = [
    # ========== 核心模块（新版）==========
    # Agent
    "CoreAgent",
    "AgentMode",
    "AgentResponse",
    "create_agent",
    "handle_message_stream",
    # Dynamic Agent
    "LangChainResumeAgent",
    "TaskGraph",
    "TaskNode",
    "TaskNodeType",
    "create_dynamic_agent",
    "LANGCHAIN_AVAILABLE",
    # RAG 知识库
    "ResumeKnowledgeBase",
    "STARGuidancer",
    "SearchConfig",
    "get_knowledge_base",
    "get_star_guidancer",
    # Session
    "Session",
    "SessionManager",
    "SessionStatus",
    "ChatMessage",
    "get_session_manager",
    # Tools
    "CVReaderTool",
    "CVEditorTool",
    "create_cv_reader",
    "create_cv_editor",
    "CV_READER_FUNCTION_DEF",
    "CV_EDITOR_FUNCTION_DEF",
    "ALL_TOOLS_FUNCTION_DEFS",
    # Executor
    "ToolExecutor",
    "ExecutionResult",
    # CV Agent
    "CVAgent",
    "AgentManager",
    "agent_manager",
    "MessageType",

    # ========== 向后兼容（旧版）==========
    # Task Planner (legacy - 规则引擎)
    "TaskPlanner",
    "OldIntentRecognizer",
    "IntentResult",
    "OldIntentType",
    "create_task_planner",
    "recognize_intent",
]
