"""Utility functions for working with messages.

Includes:
- Serialization/deserialization (message_to_dict, messages_from_dict)
- Formatting (get_buffer_string)
- Sliding window (trim_messages) - LangChain compatible
"""

from typing import Sequence, Literal

from backend.agent.memory.langchain.messages.base import BaseMessage
from backend.agent.memory.langchain.messages import (
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)


def message_to_dict(message: BaseMessage) -> dict:
    """Convert a Message to a dictionary.

    Args:
        message: Message to convert.

    Returns:
        Message as a dict. The dict will have a `type` key with the message type
        and a `data` key with the message data as a dict.
    """
    return {"type": message.type, "data": message.model_dump()}


def messages_to_dict(messages: Sequence[BaseMessage]) -> list[dict]:
    """Convert a sequence of Messages to a list of dictionaries.

    Args:
        messages: Sequence of messages (as `BaseMessage`s) to convert.

    Returns:
        List of messages as dicts.
    """
    return [message_to_dict(m) for m in messages]


def _message_from_dict(message: dict) -> BaseMessage:
    """Convert a message dict to a BaseMessage."""
    type_ = message["type"]
    data = message.get("data", message)

    # Remove type from data if present to avoid duplicate
    data = {k: v for k, v in data.items() if k != "type"}

    if type_ == "human":
        return HumanMessage(**data)
    if type_ == "ai":
        return AIMessage(**data)
    if type_ == "system":
        return SystemMessage(**data)
    if type_ == "tool":
        return ToolMessage(**data)

    # Fallback to AIMessage for unknown types
    return AIMessage(**data)


def messages_from_dict(messages: Sequence[dict]) -> list[BaseMessage]:
    """Convert a sequence of messages from dicts to `Message` objects.

    Args:
        messages: Sequence of messages (as dicts) to convert.

    Returns:
        list of messages (BaseMessages).
    """
    return [_message_from_dict(m) for m in messages]


def get_buffer_string(
    messages: Sequence[BaseMessage], human_prefix: str = "Human", ai_prefix: str = "AI"
) -> str:
    """Convert a sequence of messages to strings and concatenate them into one string.

    Args:
        messages: Messages to be converted to strings.
        human_prefix: The prefix to prepend to contents of `HumanMessage`s.
        ai_prefix: The prefix to prepend to contents of `AIMessage`.

    Returns:
        A single string concatenation of all input messages.
    """
    string_messages = []
    for m in messages:
        if isinstance(m, HumanMessage):
            role = human_prefix
        elif isinstance(m, AIMessage):
            role = ai_prefix
        elif isinstance(m, SystemMessage):
            role = "System"
        elif isinstance(m, ToolMessage):
            role = "Tool"
        else:
            role = "Unknown"
        message = f"{role}: {m.text}"
        if isinstance(m, AIMessage):
            if m.tool_calls:
                message += f"\nTool Calls: {m.tool_calls}"
        string_messages.append(message)

    return "\n".join(string_messages)


def _is_message_type(
    message: BaseMessage,
    type_: str | type[BaseMessage] | Sequence[str | type[BaseMessage]],
) -> bool:
    """Check if a message is of a specific type.

    Args:
        message: The message to check.
        type_: The type(s) to check against. Can be string names or classes.

    Returns:
        True if the message matches any of the specified types.
    """
    types = [type_] if isinstance(type_, (str, type)) else list(type_)
    types_str = [t for t in types if isinstance(t, str)]
    types_types = tuple(t for t in types if isinstance(t, type))

    return message.type in types_str or isinstance(message, types_types)


def trim_messages(
    messages: Sequence[BaseMessage],
    *,
    max_messages: int,
    strategy: Literal["first", "last"] = "last",
    start_on: str | type[BaseMessage] | Sequence[str | type[BaseMessage]] | None = None,
    include_system: bool = False,
) -> list[BaseMessage]:
    """Trim messages to keep only the specified number of messages.

    This is the LangChain-compatible sliding window implementation.

    Args:
        messages: Sequence of messages to trim.
        max_messages: Maximum number of messages to keep.
        strategy: Strategy for trimming.
            - 'first': Keep the first N messages.
            - 'last': Keep the last N messages (default, sliding window).
        start_on: The message type to start on (only for strategy='last').
            If specified, messages before the first occurrence of this type
            are ignored (except SystemMessage if include_system=True).
            Can be string names (e.g. 'human', 'ai') or BaseMessage classes.
        include_system: Whether to keep the SystemMessage if there is one at
            index 0 (only for strategy='last'). The SystemMessage is preserved
            outside the max_messages count.

    Returns:
        List of trimmed messages.

    Raises:
        ValueError: If invalid arguments are provided.

    Example:
        Keep only the last 10 messages, preserving SystemMessage:

        >>> messages = [SystemMessage("You are helpful"), ...]
        >>> trimmed = trim_messages(messages, max_messages=10, include_system=True)

        Keep the last 6 messages, starting from a HumanMessage:

        >>> trimmed = trim_messages(
        ...     messages,
        ...     max_messages=6,
        ...     strategy="last",
        ...     start_on="human",
        ...     include_system=True
        ... )
    """
    # Validate arguments
    if start_on and strategy == "first":
        raise ValueError("start_on parameter is only valid with strategy='last'")
    if include_system and strategy == "first":
        raise ValueError("include_system parameter is only valid with strategy='last'")

    messages = list(messages)
    if len(messages) == 0:
        return []

    if strategy == "first":
        # Simple case: keep first N messages
        return messages[:max_messages]

    # strategy == "last"
    # Handle system message preservation
    system_message = None
    if include_system and len(messages) > 0 and isinstance(messages[0], SystemMessage):
        system_message = messages[0]
        messages = messages[1:]

    # Keep last N messages
    if len(messages) > max_messages:
        messages = messages[-max_messages:]

    # Apply start_on filter if specified
    if start_on:
        for i, msg in enumerate(messages):
            if _is_message_type(msg, start_on):
                messages = messages[i:]
                break

    # Add back system message if needed
    if system_message:
        messages = [system_message, *messages]

    return messages

