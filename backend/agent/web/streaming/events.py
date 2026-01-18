"""StreamEvent data models for agent execution.

This module defines the event types that are sent over WebSocket
during agent execution.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any
from datetime import datetime


class EventType(str, Enum):
    """Types of events that can be streamed during agent execution."""

    # Agent lifecycle events
    AGENT_START = "agent_start"
    AGENT_END = "agent_end"
    AGENT_ERROR = "agent_error"

    # Thinking events
    THOUGHT_START = "thought_start"
    THOUGHT_END = "thought_end"
    THOUGHT = "thought"

    # Tool execution events
    TOOL_CALL_START = "tool_call_start"
    TOOL_CALL_END = "tool_call_end"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    TOOL_ERROR = "tool_error"

    # Output events
    ANSWER_START = "answer_start"
    ANSWER_CHUNK = "answer_chunk"
    ANSWER_END = "answer_end"
    ANSWER = "answer"

    # System events
    SYSTEM = "system"
    WARNING = "warning"
    DEBUG = "debug"


@dataclass
class StreamEvent:
    """Base event class for streaming agent execution.

    Attributes:
        event_type: The type of event
        data: Event-specific data
        timestamp: When the event occurred
        session_id: Optional session identifier
    """

    event_type: EventType
    data: dict[str, Any]
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())
    session_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert event to dictionary for JSON serialization."""
        return {
            "type": self.event_type.value,
            "data": self.data,
            "timestamp": self.timestamp,
            "session_id": self.session_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "StreamEvent":
        """Create event from dictionary."""
        return cls(
            event_type=EventType(data["type"]),
            data=data["data"],
            timestamp=data.get("timestamp", 0),
            session_id=data.get("session_id"),
        )


@dataclass
class ThoughtEvent(StreamEvent):
    """Event representing agent thinking/reasoning.

    Format: {"type": "thought", "content": "..."}
    """
    # Deprecated: CLTP 已提供标准的 think content chunks（过渡期保留）

    def __init__(self, thought: str, session_id: str | None = None):
        super().__init__(
            event_type=EventType.THOUGHT,
            data={"content": thought},
            session_id=session_id,
        )

    def to_dict(self) -> dict[str, Any]:
        """Override to return frontend-compatible format."""
        return {
            "type": self.event_type.value,
            "content": self.data["content"],
        }


@dataclass
class ToolCallEvent(StreamEvent):
    """Event representing a tool being called.

    Format compatible with frontend expectations:
    {
      "type": "tool_call",
      "tool": "tool_name",
      "args": {...},
      "tool_call_id": "call_xxx"  // ✅ 上下文传递：关联 ToolMessage
    }
    """

    def __init__(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        session_id: str | None = None,
        tool_call_id: str | None = None,  # ✅ 添加 tool_call_id 用于上下文关联
    ):
        super().__init__(
            event_type=EventType.TOOL_CALL,
            data={
                "tool": tool_name,
                "args": tool_args,
                "tool_call_id": tool_call_id,  # ✅ 保存 tool_call_id
            },
            session_id=session_id,
        )

    def to_dict(self) -> dict[str, Any]:
        """Override to return frontend-compatible format."""
        result = {
            "type": self.event_type.value,
            "tool": self.data["tool"],
            "args": self.data["args"],
        }
        # ✅ 只有存在 tool_call_id 时才添加该字段
        if self.data.get("tool_call_id"):
            result["tool_call_id"] = self.data["tool_call_id"]
        return result


@dataclass
class ToolResultEvent(StreamEvent):
    """Event representing a tool execution result.

    Format compatible with frontend expectations:
    {
      "type": "tool_result",
      "tool": "tool_name",
      "result": "...",
      "tool_call_id": "call_xxx"  // ✅ 上下文传递：关联 ToolCall
    }
    """

    def __init__(
        self,
        tool_name: str,
        result: str,
        is_error: bool = False,
        session_id: str | None = None,
        tool_call_id: str | None = None,  # ✅ 添加 tool_call_id 用于上下文关联
    ):
        super().__init__(
            event_type=EventType.TOOL_ERROR if is_error else EventType.TOOL_RESULT,
            data={
                "tool": tool_name,
                "result": result,
                "is_error": is_error,
                "tool_call_id": tool_call_id,  # ✅ 保存 tool_call_id
            },
            session_id=session_id,
        )

    def to_dict(self) -> dict[str, Any]:
        """Override to return frontend-compatible format."""
        result = {
            "type": self.event_type.value,
            "tool": self.data["tool"],
            "result": self.data["result"],
        }
        # ✅ 只有存在 tool_call_id 时才添加该字段
        if self.data.get("tool_call_id"):
            result["tool_call_id"] = self.data["tool_call_id"]
        return result


@dataclass
class AnswerEvent(StreamEvent):
    """Event representing the final answer from the agent.

    Format: {"type": "answer", "content": "..."}
    """
    # Deprecated: CLTP 已提供标准的 plain content chunks（过渡期保留）

    def __init__(
        self,
        content: str,
        is_complete: bool = True,
        session_id: str | None = None,
    ):
        super().__init__(
            event_type=EventType.ANSWER,
            data={
                "content": content,
                "is_complete": is_complete,
            },
            session_id=session_id,
        )

    def to_dict(self) -> dict[str, Any]:
        """Override to return frontend-compatible format."""
        return {
            "type": self.event_type.value,
            "content": self.data["content"],
        }


@dataclass
class AgentStartEvent(StreamEvent):
    """Event marking the start of agent execution."""

    def __init__(
        self,
        agent_name: str,
        task: str,
        session_id: str | None = None,
    ):
        super().__init__(
            event_type=EventType.AGENT_START,
            data={
                "agent_name": agent_name,
                "task": task,
            },
            session_id=session_id,
        )


@dataclass
class AgentEndEvent(StreamEvent):
    """Event marking the end of agent execution."""

    def __init__(
        self,
        agent_name: str,
        success: bool,
        session_id: str | None = None,
    ):
        super().__init__(
            event_type=EventType.AGENT_END,
            data={
                "agent_name": agent_name,
                "success": success,
            },
            session_id=session_id,
        )


@dataclass
class AgentErrorEvent(StreamEvent):
    """Event representing an error during agent execution."""

    def __init__(
        self,
        error_message: str,
        error_type: str | None = None,
        session_id: str | None = None,
    ):
        super().__init__(
            event_type=EventType.AGENT_ERROR,
            data={
                "error_message": error_message,
                "error_type": error_type,
            },
            session_id=session_id,
        )


@dataclass
class SystemEvent(StreamEvent):
    """Event for system messages."""

    def __init__(
        self,
        message: str,
        level: str = "info",
        session_id: str | None = None,
    ):
        super().__init__(
            event_type=EventType.SYSTEM,
            data={
                "message": message,
                "level": level,
            },
            session_id=session_id,
        )
