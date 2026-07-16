"""StreamEvent data models for agent execution.

This module defines the event types that are sent over WebSocket
during agent execution.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any
from datetime import datetime
import uuid


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
    TOOL_PROGRESS = "tool_progress"

    # Output events
    ANSWER_START = "answer_start"
    ANSWER_CHUNK = "answer_chunk"
    ANSWER_END = "answer_end"
    ANSWER = "answer"

    # Resume domain events
    RESUME_UPDATED = "resume_updated"
    RESUME_PATCH = "resume_patch"
    RESUME_GENERATED = "resume_generated"

    # Suggestion buttons (shown after agent response)
    SUGGESTIONS = "suggestions"

    # 整份优化任务：服务端提示前端自动发起下一轮续跑请求（见设计方案七点二/七点五）
    AUTO_CONTINUE = "auto_continue"

    # B层结构路由：上一步是带工具的旁白步，通知前端清空流式答案缓冲
    # （该段文本已作为 ThoughtEvent 归位思考框）
    ANSWER_RESET = "answer_reset"

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
    event_id: str = field(default_factory=lambda: f"evt_{uuid.uuid4().hex}")
    run_id: str | None = None
    seq: int | None = None

    def bind_envelope(
        self,
        *,
        run_id: str,
        seq: int,
        event_id: str | None = None,
    ) -> "StreamEvent":
        """Bind request-scoped ordering metadata immediately before emission."""
        self.run_id = run_id
        self.seq = seq
        if event_id:
            self.event_id = event_id
        return self

    def _envelope(self) -> dict[str, Any]:
        """统一 canonical 外壳；业务字段只存放在 data 中。"""
        return {
            "id": self.event_id,
            "type": self.event_type.value,
            "session_id": self.session_id,
            "run_id": self.run_id,
            "seq": self.seq,
            "timestamp": self.timestamp,
            "data": self.data,
        }

    def to_dict(self) -> dict[str, Any]:
        """Convert event to dictionary for JSON serialization."""
        return self._envelope()

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "StreamEvent":
        """Create event from dictionary."""
        return cls(
            event_type=EventType(data["type"]),
            data=data["data"],
            timestamp=data.get("timestamp", 0),
            session_id=data.get("session_id"),
            event_id=data.get("id") or f"evt_{uuid.uuid4().hex}",
            run_id=data.get("run_id"),
            seq=data.get("seq"),
        )


@dataclass
class ThoughtEvent(StreamEvent):
    """Event representing agent thinking/reasoning.

    Format: {"type": "thought", "content": "...", "step_id": 1}
    """
    # Deprecated: CLTP 已提供标准的 think content chunks（过渡期保留）

    def __init__(
        self,
        thought: str,
        step_id: int,
        session_id: str | None = None,
        node_id: str | None = None,
        phase: str | None = None,
        is_complete: bool = True,
    ):
        data: dict[str, Any] = {
            "content": thought,
            "step_id": step_id,
            "is_complete": is_complete,
        }
        if node_id:
            data["node_id"] = node_id
        if phase:
            data["phase"] = phase
        super().__init__(
            event_type=EventType.THOUGHT,
            data=data,
            session_id=session_id,
        )

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
        step_id: int,
        tool_call_id: str,
        session_id: str | None = None,
    ):
        super().__init__(
            event_type=EventType.TOOL_CALL,
            data={
                "tool": tool_name,
                "args": tool_args,
                "tool_call_id": tool_call_id,  # ✅ 保存 tool_call_id
                "step_id": step_id,
            },
            session_id=session_id,
        )

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
        step_id: int,
        tool_call_id: str,
        is_error: bool = False,
        session_id: str | None = None,
        structured_data: dict[str, Any] | None = None,
    ):
        super().__init__(
            event_type=EventType.TOOL_ERROR if is_error else EventType.TOOL_RESULT,
            data={
                "tool": tool_name,
                "result": result,
                "is_error": is_error,
                "tool_call_id": tool_call_id,  # ✅ 保存 tool_call_id
                "structured_data": structured_data,
                "step_id": step_id,
            },
            session_id=session_id,
        )

@dataclass
class ToolProgressEvent(StreamEvent):
    """Formal user-visible progress for one running tool call."""

    def __init__(
        self,
        *,
        tool_call_id: str,
        stage_id: str,
        current: int | None = None,
        total: int | None = None,
        label: str | None = None,
        summary: str | None = None,
        stages: list[str] | None = None,
        session_id: str | None = None,
    ):
        super().__init__(
            event_type=EventType.TOOL_PROGRESS,
            data={
                "tool_call_id": tool_call_id,
                "stage_id": stage_id,
                "current": current,
                "total": total,
                "label": label,
                "summary": summary,
                "stages": stages,
            },
            session_id=session_id,
        )

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
        delta: str | None = None,
        event_seq: int | None = None,
    ):
        super().__init__(
            event_type=EventType.ANSWER,
            data={
                "content": content,
                "is_complete": is_complete,
                "delta": delta,
                "event_seq": event_seq,
            },
            session_id=session_id,
        )

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
class ResumeUpdatedEvent(StreamEvent):
    """Event emitted after cv_editor_agent successfully edits a resume.

    Carries the full updated resume JSON so the frontend can replace its
    local resume state without re-applying a diff.

    Format: {"type": "resume_updated", "resume_data": {...}}
    """

    def __init__(
        self,
        resume_data: dict[str, Any],
        session_id: str | None = None,
    ):
        super().__init__(
            event_type=EventType.RESUME_UPDATED,
            data={"resume_data": resume_data},
            session_id=session_id,
        )

@dataclass
class ResumePatchEvent(StreamEvent):
    """Agent 修改简历字段，携带 before/after diff"""

    def __init__(
        self,
        patch_id: str,
        paths: list,
        before: dict,
        after: dict,
        summary: str,
        session_id: str | None = None,
        operation: str = "set",
    ):
        super().__init__(
            event_type=EventType.RESUME_PATCH,
            data={
                "patch_id": patch_id,
                "paths": paths,
                "before": before,
                "after": after,
                "summary": summary,
                "operation": operation,
            },
            session_id=session_id,
        )

@dataclass
class ResumeGeneratedEvent(StreamEvent):
    """Agent 全量生成简历"""

    def __init__(self, resume: dict, summary: str, session_id: str | None = None):
        super().__init__(
            event_type=EventType.RESUME_GENERATED,
            data={"resume": resume, "summary": summary},
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


@dataclass
class SuggestionsEvent(StreamEvent):
    """Event carrying suggestion buttons to display after agent response.

    Format: {"type": "suggestions", "items": [{"text": "...", "msg": "..."}, ...]}
    """

    def __init__(
        self,
        items: list[dict],
        session_id: str | None = None,
    ):
        super().__init__(
            event_type=EventType.SUGGESTIONS,
            data={"items": items},
            session_id=session_id,
        )

@dataclass
class AnswerResetEvent(StreamEvent):
    """B层结构路由：上一步是带工具调用的旁白步，其流式文本已作为
    ThoughtEvent 归位思考框——通知前端清空流式答案缓冲，让答案区只留
    最终正文。仅作用于未提交的实时缓冲，不回收已落时间线的内容。

    Format: {"type": "answer_reset"}
    """

    def __init__(self, session_id: str | None = None):
        super().__init__(
            event_type=EventType.ANSWER_RESET,
            data={},
            session_id=session_id,
        )


@dataclass
class AutoContinueEvent(StreamEvent):
    """整份优化任务：本请求已收尾，但任务还没做完，提示前端自动发起下一轮。

    一致性审阅（reviewing）永远独占一次全新请求，绝不与模块处理（optimizing）
    共用同一次请求的步数预算——见设计方案七点二明确决策、五点六记录的资源
    竞争教训。这个事件只是"提示"，真正决定发不发、发几次由后端
    `_progress_by_session.continue_count` 硬上限控制，前端只负责照做。

    `message` 是给用户看的状态文案；`next_user_input` 是前端应该实际重新
    提交的下一轮 user_input（带 `AUTO_CONTINUE_PREFIX` 前缀，见
    optimize_progress.py），两者分开是因为不能把内部协议前缀展示给用户
    ——独立 review 发现：早期版本只有 message 一个字段，会诱使前端直接
    回显它当下一轮输入，那样用户就会在聊天记录里看到裸露的
    `[[AUTO_CONTINUE_OPTIMIZE]]` 标记。

    Format: {"type": "auto_continue", "message": "...", "next_user_input": "...",
             "reason": "optimizing"|"reviewing"}
    """

    def __init__(
        self,
        message: str,
        reason: str,
        next_user_input: str,
        session_id: str | None = None,
    ):
        super().__init__(
            event_type=EventType.AUTO_CONTINUE,
            data={
                "message": message,
                "reason": reason,
                "next_user_input": next_user_input,
            },
            session_id=session_id,
        )
