import json
from abc import ABC, abstractmethod
from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Optional, Union

from pydantic import BaseModel, Field, PrivateAttr

from backend.core.logger import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class ToolProgress:
    """A curated, user-visible progress update emitted by a running tool."""

    content: str
    phase: str = "tool_progress"
    node_id: str = ""
    is_complete: bool = True
    current: int | None = None
    total: int | None = None
    label: str | None = None
    stages: tuple[str, ...] = ()


ToolProgressCallback = Callable[[ToolProgress], Awaitable[None]]


# class BaseTool(ABC, BaseModel):
#     name: str
#     description: str
#     parameters: Optional[dict] = None

#     class Config:
#         arbitrary_types_allowed = True

#     async def __call__(self, **kwargs) -> Any:
#         """Execute the tool with given parameters."""
#         return await self.execute(**kwargs)

#     @abstractmethod
#     async def execute(self, **kwargs) -> Any:
#         """Execute the tool with given parameters."""

#     def to_param(self) -> Dict:
#         """Convert tool to function call format."""
#         return {
#             "type": "function",
#             "function": {
#                 "name": self.name,
#                 "description": self.description,
#                 "parameters": self.parameters,
#             },
#         }


class ToolResult(BaseModel):
    """Represents the result of a tool execution."""

    output: Any = Field(default=None)
    error: Optional[str] = Field(default=None)
    base64_image: Optional[str] = Field(default=None)
    system: Optional[str] = Field(default=None)
    # 结构化数据显式通道:优先于 system JSON 旁路被消费
    # (兼容迁移,见 toolcall._store_structured_tool_result;system JSON 仍作 fallback)
    structured_data: Optional[Dict[str, Any]] = Field(default=None)

    class Config:
        arbitrary_types_allowed = True

    def __bool__(self):
        return any(getattr(self, field) for field in self.__fields__)

    def __add__(self, other: "ToolResult"):
        def combine_fields(
            field: Optional[str], other_field: Optional[str], concatenate: bool = True
        ):
            if field and other_field:
                if concatenate:
                    return field + other_field
                raise ValueError("Cannot combine tool results")
            return field or other_field

        return ToolResult(
            output=combine_fields(self.output, other.output),
            error=combine_fields(self.error, other.error),
            base64_image=combine_fields(self.base64_image, other.base64_image, False),
            system=combine_fields(self.system, other.system),
            structured_data=combine_fields(
                self.structured_data, other.structured_data, False
            ),
        )

    def __str__(self):
        return f"Error: {self.error}" if self.error else self.output

    def replace(self, **kwargs):
        """Returns a new ToolResult with the given fields replaced."""
        # return self.copy(update=kwargs)
        return type(self)(**{**self.dict(), **kwargs})


class BaseTool(ABC, BaseModel):
    """Consolidated base class for all tools combining BaseModel and Tool functionality.

    Provides:
    - Pydantic model validation
    - Schema registration
    - Standardized result handling
    - Abstract execution interface

    Attributes:
        name (str): Tool name
        description (str): Tool description
        parameters (dict): Tool parameters schema
        _schemas (Dict[str, List[ToolSchema]]): Registered method schemas
    """

    name: str
    description: str
    parameters: Optional[dict] = None
    session_id: Optional[str] = Field(default=None, exclude=True)
    shared_state: Optional[Any] = Field(default=None, exclude=True)
    # 运行时确认协议:True 时 execute_tool 不直接执行,先挂起并推 approval_request
    # 确认卡,由 /api/agent/approval 端点在用户批准后带(可能被编辑过的)参数执行。
    # 这是运行时语义,模型无法绕过;approval_editable_fields 声明确认卡中可编辑的参数。
    requires_approval: bool = Field(default=False, exclude=True)
    approval_editable_fields: list = Field(default_factory=list, exclude=True)
    _progress_callback: ContextVar[Optional[ToolProgressCallback]] = PrivateAttr(
        default_factory=lambda: ContextVar("tool_progress_callback", default=None)
    )
    # _schemas: Dict[str, List[ToolSchema]] = {}

    class Config:
        arbitrary_types_allowed = True
        underscore_attrs_are_private = False

    def set_progress_callback(
        self,
        callback: Optional[ToolProgressCallback],
    ) -> Token:
        """Bind progress delivery to the current async context."""
        return self._progress_callback.set(callback)

    def clear_progress_callback(self, token: Token) -> None:
        self._progress_callback.reset(token)

    async def emit_progress(self, update: ToolProgress) -> None:
        """Best-effort progress delivery; presentation failures must not fail tools."""
        callback = self._progress_callback.get()
        if not callback:
            return
        try:
            await callback(update)
        except Exception as exc:
            logger.warning(
                f"Tool progress callback failed for {self.name}: {type(exc).__name__}"
            )

    # def __init__(self, **data):
    #     """Initialize tool with model validation and schema registration."""
    #     super().__init__(**data)
    #     logger.debug(f"Initializing tool class: {self.__class__.__name__}")
    #     self._register_schemas()

    # def _register_schemas(self):
    #     """Register schemas from all decorated methods."""
    #     for name, method in inspect.getmembers(self, predicate=inspect.ismethod):
    #         if hasattr(method, 'tool_schemas'):
    #             self._schemas[name] = method.tool_schemas
    #             logger.debug(f"Registered schemas for method '{name}' in {self.__class__.__name__}")

    async def __call__(self, **kwargs) -> Any:
        """Execute the tool with given parameters."""
        return await self.execute(**kwargs)

    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        """Execute the tool with given parameters."""

    def validate_before_approval(self, **kwargs) -> Optional[str]:
        """requires_approval 工具的确认前校验:返回错误文案则不产生挂起(让注定
        失败的调用在确认卡出现之前就报错),返回 None 表示可以挂起等待确认。"""
        return None

    def approval_preview(self, **kwargs) -> Dict[str, Any]:
        """requires_approval 工具的确认卡附加展示信息(如附件名),并入 payload。"""
        return {}

    def to_param(self) -> Dict:
        """Convert tool to function call format.

        Returns:
            Dictionary with tool metadata in OpenAI function calling format
        """
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }

    def success_response(self, data: Union[Dict[str, Any], str]) -> ToolResult:
        """Create a successful tool result.

        Args:
            data: Result data (dictionary or string)

        Returns:
            ToolResult with success=True and formatted output
        """
        if isinstance(data, str):
            text = data
        else:
            text = json.dumps(data, indent=2)
        logger.debug(f"Created success response for {self.__class__.__name__}")
        return ToolResult(output=text)

    def fail_response(self, msg: str) -> ToolResult:
        """Create a failed tool result.

        Args:
            msg: Error message describing the failure

        Returns:
            ToolResult with success=False and error message
        """
        logger.debug(f"Tool {self.__class__.__name__} returned failed result: {msg}")
        return ToolResult(error=msg)


class CLIResult(ToolResult):
    """A ToolResult that can be rendered as a CLI output."""


class ToolFailure(ToolResult):
    """A ToolResult that represents a failure."""
