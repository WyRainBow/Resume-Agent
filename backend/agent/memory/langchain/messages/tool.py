"""Messages for tools."""

import json
from typing import Any, Literal, cast, overload
from uuid import UUID
from pydantic import Field, model_validator
from typing_extensions import NotRequired, TypedDict, override

from backend.agent.memory.langchain.messages.base import BaseMessage, BaseMessageChunk, merge_content
from backend.agent.memory.langchain.utils import merge_dicts, merge_obj


class ToolOutputMixin:
    """Mixin for objects that tools can return directly."""


class ToolMessage(BaseMessage, ToolOutputMixin):
    """Message for passing the result of executing a tool back to a model."""

    tool_call_id: str
    """Tool call that this message is responding to."""

    type: Literal["tool"] = "tool"
    """The type of the message (used for serialization)."""

    artifact: Any = None
    """Artifact of the Tool execution which is not meant to be sent to the model."""

    status: Literal["success", "error"] = "success"
    """Status of the tool invocation."""

    name: str = ""
    """Name of the tool that was called."""

    @model_validator(mode="before")
    @classmethod
    def coerce_args(cls, values: dict) -> dict:
        """Coerce the model arguments to the correct types."""
        content = values.get("content", "")
        if isinstance(content, tuple):
            content = list(content)

        if not isinstance(content, (str, list)):
            try:
                values["content"] = str(content)
            except ValueError as e:
                msg = (
                    "ToolMessage content should be a string or a list of string/dicts. "
                    f"Received:\n\n{content=}\n\n which could not be coerced into a "
                    "string."
                )
                raise ValueError(msg) from e
        elif isinstance(content, list):
            values["content"] = []
            for i, x in enumerate(content):
                if not isinstance(x, (str, dict)):
                    try:
                        values["content"].append(str(x))
                    except ValueError as e:
                        msg = (
                            "ToolMessage content should be a string or a list of "
                            "string/dicts. Received a list but "
                            f"element ToolMessage.content[{i}] is not a dict and could "
                            f"not be coerced to a string.:\n\n{x}"
                        )
                        raise ValueError(msg) from e
                else:
                    values["content"].append(x)

        tool_call_id = values.get("tool_call_id", "")
        if isinstance(tool_call_id, (UUID, int, float)):
            values["tool_call_id"] = str(tool_call_id)
        return values

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
        tool_call_id: str = "",
        name: str = "",
        artifact: Any = None,
        status: Literal["success", "error"] = "success",
        **kwargs: Any,
    ) -> None:
        """Initialize a `ToolMessage`."""
        if content is None:
            content = ""
        super().__init__(
            content=content,
            type="tool",
            tool_call_id=tool_call_id,
            name=name,
            artifact=artifact,
            status=status,
            **kwargs,
        )


class ToolMessageChunk(ToolMessage, BaseMessageChunk):
    """Tool Message chunk."""

    type: Literal["ToolMessageChunk"] = "ToolMessageChunk"  # type: ignore[assignment]

    @override
    def __add__(self, other: Any) -> BaseMessageChunk:  # type: ignore[override]
        if isinstance(other, ToolMessageChunk):
            if self.tool_call_id != other.tool_call_id:
                msg = "Cannot concatenate ToolMessageChunks with different tool_call_ids."
                raise ValueError(msg)

            return self.__class__(
                tool_call_id=self.tool_call_id,
                content=merge_content(self.content, other.content),
                artifact=merge_obj(self.artifact, other.artifact),
                additional_kwargs=merge_dicts(
                    self.additional_kwargs, other.additional_kwargs
                ),
                response_metadata=merge_dicts(
                    self.response_metadata, other.response_metadata
                ),
                id=self.id,
                status=_merge_status(self.status, other.status),
                name=self.name or other.name,
            )

        return super().__add__(other)


class ToolCall(TypedDict):
    """Represents an AI's request to call a tool."""

    name: str
    """The name of the tool to be called."""
    args: dict[str, Any]
    """The arguments to the tool call."""
    id: str | None
    """An identifier associated with the tool call."""
    type: NotRequired[Literal["tool_call"]]


def tool_call(
    *,
    name: str,
    args: dict[str, Any],
    id: str | None,
) -> ToolCall:
    """Create a tool call."""
    return ToolCall(name=name, args=args, id=id, type="tool_call")


class ToolCallChunk(TypedDict):
    """A chunk of a tool call (yielded when streaming)."""

    name: str | None
    """The name of the tool to be called."""
    args: str | None
    """The arguments to the tool call."""
    id: str | None
    """An identifier associated with the tool call."""
    index: int | None
    """The index of the tool call in a sequence."""
    type: NotRequired[Literal["tool_call_chunk"]]


def tool_call_chunk(
    *,
    name: str | None = None,
    args: str | None = None,
    id: str | None = None,
    index: int | None = None,
) -> ToolCallChunk:
    """Create a tool call chunk."""
    return ToolCallChunk(
        name=name, args=args, id=id, index=index, type="tool_call_chunk"
    )


class InvalidToolCall(TypedDict):
    """An invalid tool call."""

    name: str | None
    args: str | None
    id: str | None
    error: str | None
    type: NotRequired[Literal["invalid_tool_call"]]


def invalid_tool_call(
    *,
    name: str | None = None,
    args: str | None = None,
    id: str | None = None,
    error: str | None = None,
) -> InvalidToolCall:
    """Create an invalid tool call."""
    return InvalidToolCall(
        name=name, args=args, id=id, error=error, type="invalid_tool_call"
    )


def default_tool_parser(
    raw_tool_calls: list[dict],
) -> tuple[list[ToolCall], list[InvalidToolCall]]:
    """Best-effort parsing of tools."""
    tool_calls = []
    invalid_tool_calls = []
    for raw_tool_call in raw_tool_calls:
        if "function" not in raw_tool_call:
            continue
        function_name = raw_tool_call["function"]["name"]
        try:
            function_args = json.loads(raw_tool_call["function"]["arguments"])
            parsed = tool_call(
                name=function_name or "",
                args=function_args or {},
                id=raw_tool_call.get("id"),
            )
            tool_calls.append(parsed)
        except json.JSONDecodeError:
            invalid_tool_calls.append(
                invalid_tool_call(
                    name=function_name,
                    args=raw_tool_call["function"]["arguments"],
                    id=raw_tool_call.get("id"),
                    error=None,
                )
            )
    return tool_calls, invalid_tool_calls


def default_tool_chunk_parser(raw_tool_calls: list[dict]) -> list[ToolCallChunk]:
    """Best-effort parsing of tool chunks."""
    tool_call_chunks = []
    for tool_call in raw_tool_calls:
        if "function" not in tool_call:
            function_args = None
            function_name = None
        else:
            function_args = tool_call["function"]["arguments"]
            function_name = tool_call["function"]["name"]
        parsed = tool_call_chunk(
            name=function_name,
            args=function_args,
            id=tool_call.get("id"),
            index=tool_call.get("index"),
        )
        tool_call_chunks.append(parsed)
    return tool_call_chunks


def _merge_status(
    left: Literal["success", "error"], right: Literal["success", "error"]
) -> Literal["success", "error"]:
    return "error" if "error" in {left, right} else "success"








