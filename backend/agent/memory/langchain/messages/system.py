"""System message."""

from typing import Any, Literal, cast, overload
from backend.agent.memory.langchain.messages.base import BaseMessage, BaseMessageChunk


class SystemMessage(BaseMessage):
    """Message for priming AI behavior."""

    type: Literal["system"] = "system"
    """The type of the message (used for serialization)."""

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
        **kwargs: Any,
    ) -> None:
        """Specify `content` as positional arg."""
        if content is None:
            content = ""
        super().__init__(content=content, type="system", **kwargs)


class SystemMessageChunk(SystemMessage, BaseMessageChunk):
    """System Message chunk."""

    type: Literal["SystemMessageChunk"] = "SystemMessageChunk"  # type: ignore[assignment]
    """The type of the message (used for serialization)."""








