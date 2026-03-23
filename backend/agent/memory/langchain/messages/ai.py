"""AI message."""

import json
from typing import Any, Literal, cast, overload
from pydantic import Field, model_validator
from typing_extensions import override

from backend.agent.memory.langchain.messages.base import BaseMessage, BaseMessageChunk
from backend.agent.memory.langchain.messages.tool import (
    ToolCall,
    ToolCallChunk,
    InvalidToolCall,
    tool_call,
    tool_call_chunk,
    default_tool_parser,
    default_tool_chunk_parser,
)


from typing_extensions import TypedDict, NotRequired


class UsageMetadata(TypedDict, total=False):
    """Usage metadata for a message, such as token counts."""
    input_tokens: int
    output_tokens: int
    total_tokens: int


class AIMessage(BaseMessage):
    """Message from an AI."""

    tool_calls: list[ToolCall] = Field(default_factory=list)
    """If present, tool calls associated with the message."""

    invalid_tool_calls: list[InvalidToolCall] = Field(default_factory=list)
    """If present, tool calls with parsing errors associated with the message."""

    usage_metadata: UsageMetadata | None = None
    """If present, usage metadata for a message, such as token counts."""

    type: Literal["ai"] = "ai"
    """The type of the message (used for deserialization)."""

    @overload
    def __init__(
        self,
        content: str | list[str | dict],
        **kwargs: Any,
    ) -> None: ...

    @overload
    def __init__(
        self,
        content: str | list[str | dict] | None = None,
        **kwargs: Any,
    ) -> None: ...

    def __init__(
        self,
        content: str | list[str | dict] | None = None,
        tool_calls: list[ToolCall] | None = None,
        invalid_tool_calls: list[InvalidToolCall] | None = None,
        usage_metadata: UsageMetadata | None = None,
        **kwargs: Any,
    ) -> None:
        """Initialize an `AIMessage`."""
        if content is None:
            content = ""
        if tool_calls is None:
            tool_calls = []
        if invalid_tool_calls is None:
            invalid_tool_calls = []
        super().__init__(
            content=content,
            type="ai",
            tool_calls=tool_calls,
            invalid_tool_calls=invalid_tool_calls,
            usage_metadata=usage_metadata,
            **kwargs,
        )

    @model_validator(mode="before")
    @classmethod
    def _backwards_compat_tool_calls(cls, values: dict) -> Any:
        """Handle backwards compatibility for tool calls."""
        check_additional_kwargs = not any(
            values.get(k)
            for k in ("tool_calls", "invalid_tool_calls", "tool_call_chunks")
        )
        if check_additional_kwargs and (
            raw_tool_calls := values.get("additional_kwargs", {}).get("tool_calls")
        ):
            try:
                parsed_tool_calls, parsed_invalid_tool_calls = default_tool_parser(
                    raw_tool_calls
                )
                values["tool_calls"] = parsed_tool_calls
                values["invalid_tool_calls"] = parsed_invalid_tool_calls
            except Exception:
                pass

        # Ensure "type" is properly set on all tool call-like dicts.
        if tool_calls := values.get("tool_calls"):
            values["tool_calls"] = [
                tool_call(
                    **{k: v for k, v in tc.items() if k not in {"type", "extras"}}
                )
                for tc in tool_calls
            ]
        if invalid_tool_calls := values.get("invalid_tool_calls"):
            values["invalid_tool_calls"] = [
                InvalidToolCall(**{k: v for k, v in tc.items() if k != "type"})
                for tc in invalid_tool_calls
            ]

        return values


class AIMessageChunk(AIMessage, BaseMessageChunk):
    """Message chunk from an AI (yielded when streaming)."""

    type: Literal["AIMessageChunk"] = "AIMessageChunk"  # type: ignore[assignment]
    """The type of the message (used for deserialization)."""

    tool_call_chunks: list[ToolCallChunk] = Field(default_factory=list)
    """If provided, tool call chunks associated with the message."""

    chunk_position: Literal["last"] | None = None
    """Optional span represented by an aggregated `AIMessageChunk`."""

