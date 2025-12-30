"""
Agent 异常定义

参考架构：sophia-pro/backend/agent/src/amplift/

定义统一的异常层次结构，支持：
1. 错误分类和追踪
2. 结构化错误信息
3. 多语言错误消息
4. 错误恢复建议
"""
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
import traceback


class ErrorCategory(str, Enum):
    """错误类别"""
    # 工具相关
    TOOL_NOT_FOUND = "tool_not_found"
    TOOL_EXECUTION = "tool_execution"
    TOOL_VALIDATION = "tool_validation"

    # 数据相关
    DATA_NOT_FOUND = "data_not_found"
    DATA_VALIDATION = "data_validation"
    DATA_PARSE = "data_parse"

    # 意图识别相关
    INTENT_RECOGNITION = "intent_recognition"
    INTENT_AMBIGUOUS = "intent_ambiguous"

    # LLM 相关
    LLM_API = "llm_api"
    LLM_TIMEOUT = "llm_timeout"
    LLM_RATE_LIMIT = "llm_rate_limit"
    LLM_TOKEN_LIMIT = "llm_token_limit"

    # 会话相关
    SESSION_NOT_FOUND = "session_not_found"
    SESSION_EXPIRED = "session_expired"

    # 通用
    UNKNOWN = "unknown"


@dataclass
class ErrorContext:
    """错误上下文"""
    category: ErrorCategory
    tool_name: Optional[str] = None
    tool_params: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None
    user_message: Optional[str] = None
    traceback: Optional[str] = None
    timestamp: float = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "category": self.category.value if isinstance(self.category, ErrorCategory) else self.category,
            "tool_name": self.tool_name,
            "tool_params": self.tool_params,
            "session_id": self.session_id,
            "user_message": self.user_message,
            "traceback": self.traceback,
            "timestamp": self.timestamp,
            "metadata": self.metadata
        }


class AgentError(Exception):
    """
    Agent 基础异常

    所有 Agent 相关异常的基类
    """

    def __init__(
        self,
        message: str,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        context: Optional[ErrorContext] = None,
        recovery_suggestions: Optional[List[str]] = None
    ):
        self.message = message
        self.category = category
        self.context = context or ErrorContext(category=category)
        self.recovery_suggestions = recovery_suggestions or []
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于 API 响应）"""
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "category": self.category.value,
            "context": self.context.to_dict(),
            "recovery_suggestions": self.recovery_suggestions
        }


class ToolError(AgentError):
    """
    工具相关异常

    用于工具执行过程中的错误
    """

    def __init__(
        self,
        message: str,
        tool_name: str,
        tool_params: Optional[Dict[str, Any]] = None,
        category: ErrorCategory = ErrorCategory.TOOL_EXECUTION,
        recovery_suggestions: Optional[List[str]] = None
    ):
        context = ErrorContext(
            category=category,
            tool_name=tool_name,
            tool_params=tool_params
        )
        super().__init__(message, category, context, recovery_suggestions)
        self.tool_name = tool_name
        self.tool_params = tool_params


class ToolNotFoundError(ToolError):
    """工具未找到异常"""

    def __init__(self, tool_name: str, available_tools: Optional[List[str]] = None):
        message = f"工具 '{tool_name}' 不存在"
        if available_tools:
            message += f"。可用工具: {', '.join(available_tools)}"

        recovery = ["检查工具名称是否正确", "查看可用工具列表"]
        super().__init__(message, tool_name, ErrorCategory.TOOL_NOT_FOUND, recovery)
        self.available_tools = available_tools


class ToolExecutionError(ToolError):
    """工具执行异常"""

    def __init__(
        self,
        tool_name: str,
        error_message: str,
        tool_params: Optional[Dict[str, Any]] = None,
        original_error: Optional[Exception] = None
    ):
        message = f"工具 '{tool_name}' 执行失败: {error_message}"
        recovery = ["检查工具参数是否正确", "查看工具使用文档"]

        context = ErrorContext(
            category=ErrorCategory.TOOL_EXECUTION,
            tool_name=tool_name,
            tool_params=tool_params,
            traceback=traceback.format_exception(type(original_error), original_error, original_error.__traceback__) if original_error else None
        )

        super().__init__(message, tool_name, tool_params, ErrorCategory.TOOL_EXECUTION, recovery)
        self.original_error = original_error


class ToolValidationError(ToolError):
    """工具参数验证异常"""

    def __init__(
        self,
        tool_name: str,
        validation_errors: Dict[str, str],
        tool_params: Optional[Dict[str, Any]] = None
    ):
        errors_str = "; ".join([f"{k}: {v}" for k, v in validation_errors.items()])
        message = f"工具 '{tool_name}' 参数验证失败: {errors_str}"

        recovery = [f"修正 {field} 字段" for field in validation_errors.keys()]
        recovery.append("查看工具参数说明")

        context = ErrorContext(
            category=ErrorCategory.TOOL_VALIDATION,
            tool_name=tool_name,
            tool_params=tool_params,
            metadata={"validation_errors": validation_errors}
        )

        super().__init__(message, tool_name, tool_params, ErrorCategory.TOOL_VALIDATION, recovery)
        self.validation_errors = validation_errors


class DataError(AgentError):
    """
    数据相关异常

    用于数据访问、解析、验证过程中的错误
    """

    def __init__(
        self,
        message: str,
        path: Optional[str] = None,
        category: ErrorCategory = ErrorCategory.DATA_VALIDATION,
        recovery_suggestions: Optional[List[str]] = None
    ):
        context = ErrorContext(
            category=category,
            metadata={"path": path} if path else {}
        )
        super().__init__(message, category, context, recovery_suggestions)
        self.path = path


class DataNotFoundError(DataError):
    """数据未找到异常"""

    def __init__(self, path: str, available_paths: Optional[List[str]] = None):
        message = f"数据路径 '{path}' 不存在"
        if available_paths:
            message += f"。可用路径: {', '.join(available_paths[:5])}"
            if len(available_paths) > 5:
                message += f" ... (共 {len(available_paths)} 个)"

        recovery = ["检查路径是否正确", "使用 CVReader 查看可用数据"]
        super().__init__(message, path, ErrorCategory.DATA_NOT_FOUND, recovery)
        self.available_paths = available_paths


class DataValidationError(DataError):
    """数据验证异常"""

    def __init__(
        self,
        message: str,
        path: str,
        validation_errors: Dict[str, str],
        provided_data: Optional[Dict[str, Any]] = None
    ):
        errors_str = "; ".join([f"{k}: {v}" for k, v in validation_errors.items()])
        full_message = f"{message}: {errors_str}"

        recovery = [f"修正 {field} 字段" for field in validation_errors.keys()]

        context = ErrorContext(
            category=ErrorCategory.DATA_VALIDATION,
            metadata={
                "path": path,
                "validation_errors": validation_errors,
                "provided_data": provided_data
            }
        )

        super().__init__(full_message, path, ErrorCategory.DATA_VALIDATION, recovery)
        self.validation_errors = validation_errors
        self.provided_data = provided_data


class IntentError(AgentError):
    """
    意图识别异常

    用于意图识别过程中的错误
    """

    def __init__(
        self,
        message: str,
        user_input: Optional[str] = None,
        category: ErrorCategory = ErrorCategory.INTENT_RECOGNITION,
        recovery_suggestions: Optional[List[str]] = None
    ):
        context = ErrorContext(
            category=category,
            user_message=user_input
        )
        super().__init__(message, category, context, recovery_suggestions)
        self.user_input = user_input


class LLMError(AgentError):
    """
    LLM 相关异常

    用于 LLM API 调用过程中的错误
    """

    def __init__(
        self,
        message: str,
        category: ErrorCategory = ErrorCategory.LLM_API,
        model: Optional[str] = None,
        recovery_suggestions: Optional[List[str]] = None
    ):
        context = ErrorContext(
            category=category,
            metadata={"model": model} if model else {}
        )
        super().__init__(message, category, context, recovery_suggestions)
        self.model = model


class SessionError(AgentError):
    """
    会话相关异常

    用于会话管理过程中的错误
    """

    def __init__(
        self,
        message: str,
        session_id: Optional[str] = None,
        category: ErrorCategory = ErrorCategory.SESSION_NOT_FOUND,
        recovery_suggestions: Optional[List[str]] = None
    ):
        context = ErrorContext(
            category=category,
            session_id=session_id
        )
        super().__init__(message, category, context, recovery_suggestions)
        self.session_id = session_id


class ErrorHandler:
    """
    错误处理器

    提供统一的错误处理接口
    """

    @staticmethod
    def handle_error(error: Exception) -> Dict[str, Any]:
        """
        处理异常，返回结构化错误信息

        Args:
            error: 异常对象

        Returns:
            结构化错误信息
        """
        if isinstance(error, AgentError):
            return error.to_dict()

        # 处理标准异常
        return {
            "error_type": error.__class__.__name__,
            "message": str(error),
            "category": ErrorCategory.UNKNOWN.value,
            "context": ErrorContext(
                category=ErrorCategory.UNKNOWN,
                traceback=traceback.format_exception(type(error), error, error.__traceback__)
            ).to_dict(),
            "recovery_suggestions": ["请稍后重试", "如果问题持续，请联系支持"]
        }

    @staticmethod
    def create_error_response(error: Exception, include_traceback: bool = False) -> Dict[str, Any]:
        """
        创建 API 错误响应

        Args:
            error: 异常对象
            include_traceback: 是否包含堆栈跟踪

        Returns:
            API 错误响应
        """
        error_info = ErrorHandler.handle_error(error)

        if not include_traceback and "context" in error_info:
            error_info["context"].pop("traceback", None)

        return {
            "success": False,
            "error": error_info
        }

    @staticmethod
    def wrap_tool_error(
        tool_name: str,
        error: Exception,
        tool_params: Optional[Dict[str, Any]] = None
    ) -> ToolExecutionError:
        """
        将普通异常包装为工具执行异常

        Args:
            tool_name: 工具名称
            error: 原始异常
            tool_params: 工具参数

        Returns:
            工具执行异常
        """
        if isinstance(error, ToolError):
            return error

        return ToolExecutionError(
            tool_name=tool_name,
            error_message=str(error),
            tool_params=tool_params,
            original_error=error
        )
