"""
Agents 模组

参考架构：sophia-pro/backend/agent/src/amplift/

提供 AI 简历助手的核心功能：
- CVAgent: 核心对话 Agent
- AgentState: 统一状态管理（参考 sophia-pro）
- AgentManager: Agent 会话管理
- IntentRecognizer: 意图识别（复用 task_planner 逻辑）
- ToolExecutor: 工具执行
- MessageBuilder: 消息构建

新架构特性（参考 sophia-pro）：
- Capability: 能力包系统，动态配置 Agent 行为
- ReActAgent: 基于 ReAct 循环的智能体
- ToolPolicy: 工具策略白名单

向后兼容：
- CoreAgent: 旧版 Agent（保留供参考）
- TaskPlanner: 旧版任务规划器（保留供参考）
"""

# ========== 核心模块 ==========

# 核心 Agent
from .cv_agent import CVAgent, AgentResponse

# 统一状态管理（参考 sophia-pro AgentState）
from .agent_state import AgentState, PendingTask

# Agent 管理器
from .agent_manager import AgentManager, agent_manager

# 对话状态（保留兼容）
from .chat_state import ChatState, IntentType, Message, PendingData

# 意图识别
from .intent_recognizer import IntentRecognizer, RecognitionResult

# 工具执行
from .tool_executor import ToolExecutor, ExecutionResult

# 工具钩子（参考 sophia-pro tool_hooks）
from .tool_hooks import (
    ToolStatusHook,
    LoggingToolHook,
    ToolCallContext,
    ToolStatus,
    create_tool_wrapper
)

# 工具注册
from .tool_registry import ToolRegistry, tool_registry, setup_default_tools

# 消息构建
from .message_builder import MessageBuilder, AgentMessage, MessageType


# ========== 向后兼容（旧版模块）==========

# 旧版核心 Agent
from .core_agent import (
    CoreAgent,
    AgentResponse as OldAgentResponse,
    AgentState as OldAgentState,  # 旧版状态枚举，避免与新 AgentState 冲突
    create_agent,
    handle_message_stream
)

# 旧版任务规划器
from .task_planner import (
    TaskPlanner,
    IntentRecognizer as OldIntentRecognizer,
    IntentResult,
    IntentType as OldIntentType,
    create_task_planner,
    recognize_intent
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

# 会话管理
from .session_manager import (
    Session,
    SessionManager,
    SessionStatus,
    ChatMessage,
    get_session_manager
)


# ========== 新架构模块（参考 sophia-pro） ==========

# Capability 系统
try:
    from .capability import (
        Capability,
        ToolPolicy,
        CapabilityRegistry,
        BASE_CAPABILITY,
        ADVANCED_CAPABILITY,
        OPTIMIZER_CAPABILITY,
    )
    _capability_available = True
except ImportError:
    _capability_available = False

# ReAct Agent
try:
    from .react_agent import (
        ReActAgent,
        ReActStep,
        ReActStepType,
        ReActMemory,
        ReActPromptBuilder,
        ReActOutputParser,
        create_react_agent,
    )
    _react_agent_available = True
except ImportError:
    _react_agent_available = False

# ========== 混合架构模块 ==========

# TaskClassifier - 任务复杂度分类器
from .task_classifier import (
    TaskClassifier,
    ExecutionMode,
    TaskComplexity,
    ClassificationResult,
    classify_task,
    should_use_react,
)

# HybridAgent - 混合模式 Agent
from .hybrid_agent import (
    HybridAgent,
    HybridAgentConfig,
    ExecutionContext,
    create_hybrid_agent,
)

# ToolRegistry V2
try:
    from .tool_registry_v2 import (
        ToolRegistry as ToolRegistryV2,
        ToolMetadata,
        ToolStatus,
        register_tool as register_tool_v2,
    )
    _tool_registry_v2_available = True
except ImportError:
    _tool_registry_v2_available = False


__all__ = [
    # ========== 核心模块 ==========
    # Agent
    "CVAgent",
    "AgentResponse",
    # State（参考 sophia-pro）
    "AgentState",
    "PendingTask",
    # Manager
    "AgentManager",
    "agent_manager",
    # 兼容旧版 ChatState
    "ChatState",
    "IntentType",
    "Message",
    "PendingData",
    # Intent
    "IntentRecognizer",
    "RecognitionResult",
    # Executor
    "ToolExecutor",
    "ExecutionResult",
    # Tool Hooks（参考 sophia-pro）
    "ToolStatusHook",
    "LoggingToolHook",
    "ToolCallContext",
    "ToolStatus",
    "create_tool_wrapper",
    # Registry
    "ToolRegistry",
    "tool_registry",
    "setup_default_tools",
    # Message
    "MessageBuilder",
    "AgentMessage",
    "MessageType",
    
    # ========== 向后兼容（旧版）==========
    # Agent (old)
    "CoreAgent",
    "OldAgentResponse",
    "OldAgentState",  # 旧版状态枚举
    "create_agent",
    "handle_message_stream",
    # Task Planner (old)
    "TaskPlanner",
    "OldIntentRecognizer",
    "IntentResult",
    "OldIntentType",
    "create_task_planner",
    "recognize_intent",
    # Tools
    "CVReaderTool",
    "CVEditorTool",
    "create_cv_reader",
    "create_cv_editor",
    "CV_READER_FUNCTION_DEF",
    "CV_EDITOR_FUNCTION_DEF",
    "ALL_TOOLS_FUNCTION_DEFS",
    # Session
    "Session",
    "SessionManager",
    "SessionStatus",
    "ChatMessage",
    "get_session_manager",

    # ========== 新架构模块（参考 sophia-pro）==========
    # Capability
    "Capability",
    "ToolPolicy",
    "CapabilityRegistry",
    "BASE_CAPABILITY",
    "ADVANCED_CAPABILITY",
    "OPTIMIZER_CAPABILITY",
    # ReAct Agent
    "ReActAgent",
    "ReActStep",
    "ReActStepType",
    "ReActMemory",
    "ReActPromptBuilder",
    "ReActOutputParser",
    "create_react_agent",

    # ========== 混合架构模块 ==========
    # TaskClassifier
    "TaskClassifier",
    "ExecutionMode",
    "TaskComplexity",
    "ClassificationResult",
    "classify_task",
    "should_use_react",
    # HybridAgent
    "HybridAgent",
    "HybridAgentConfig",
    "ExecutionContext",
    "create_hybrid_agent",
    # ToolRegistry V2
    "ToolRegistryV2",
    "ToolMetadata",
    "ToolStatus",
    "register_tool_v2",
    "_tool_registry_v2_available",
]
