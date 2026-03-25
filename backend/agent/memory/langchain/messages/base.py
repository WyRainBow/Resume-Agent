"""Base message class."""

from typing import Any, cast, overload, Union, List, Dict
from pydantic import BaseModel, ConfigDict, Field


class BaseMessage(BaseModel):
    """Base message class.

    Messages are the inputs and outputs of a chat model.
    """

    content: Union[str, List[Union[str, Dict]]]
    """The contents of the message."""

    additional_kwargs: dict = Field(default_factory=dict)
    """Reserved for additional payload data associated with the message."""

    response_metadata: dict = Field(default_factory=dict)
    """Examples: response headers, logprobs, token counts, model name."""

    type: str
    """The type of the message. Must be a string that is unique to the message type."""

    name: str | None = None
    """An optional name for the message."""

    id: str | None = Field(default=None)
    """An optional unique identifier for the message."""

    model_config = ConfigDict(
        extra="allow",
    )

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
        """Initialize a `BaseMessage`."""
        if content is None:
            content = ""
        super().__init__(content=content, **kwargs)

    @property
    def text(self) -> str:
        """Get the text content of the message as a string."""
        if isinstance(self.content, str):
            return self.content
        else:
            # must be a list
            blocks = [
                block
                for block in self.content
                if isinstance(block, str)
                or (isinstance(block, dict) and block.get("type") == "text" and isinstance(block.get("text"), str))
            ]
            return "".join(
                block if isinstance(block, str) else block["text"] for block in blocks
            )

    def __str__(self) -> str:
        return self.text


def merge_content(
    first_content: str | list[str | dict],
    *contents: str | list[str | dict],
) -> str | list[str | dict]:
    """Merge multiple message contents."""
    from backend.agent.memory.langchain.utils import merge_lists

    merged: str | list[str | dict]
    merged = "" if first_content is None else first_content

    for content in contents:
        # If current is a string
        if isinstance(merged, str):
            # If the next chunk is also a string, then merge them naively
            if isinstance(content, str):
                merged += content
            # If the next chunk is a list, add the current to the start of the list
            else:
                merged = [merged, *content]
        elif isinstance(content, list):
            # If both are lists
            merged = merge_lists(cast("list", merged), content)  # type: ignore[assignment]
        # If the first content is a list, and the second content is a string
        # If the last element of the first content is a string
        # Add the second content to the last element
        elif merged and isinstance(merged[-1], str):
            merged[-1] += content
        # If second content is an empty string, treat as a no-op
        elif content == "":
            pass
        # Otherwise, add the second content as a new element of the list
        elif merged:
            merged.append(content)
    return merged


class BaseMessageChunk(BaseMessage):
    """Message chunk, which can be concatenated with other Message chunks."""

    def __add__(self, other: Any) -> "BaseMessageChunk":
        """Message chunks support concatenation with other message chunks."""
        from backend.agent.memory.langchain.utils import merge_dicts

        if isinstance(other, BaseMessageChunk):
            return self.__class__(
                id=self.id,
                type=self.type,
                content=merge_content(self.content, other.content),
                additional_kwargs=merge_dicts(
                    self.additional_kwargs, other.additional_kwargs
                ),
                response_metadata=merge_dicts(
                    self.response_metadata, other.response_metadata
                ),
            )
        if isinstance(other, list) and all(
            isinstance(o, BaseMessageChunk) for o in other
        ):
            content = merge_content(self.content, *(o.content for o in other))
            additional_kwargs = merge_dicts(
                self.additional_kwargs, *(o.additional_kwargs for o in other)
            )
            response_metadata = merge_dicts(
                self.response_metadata, *(o.response_metadata for o in other)
            )
            return self.__class__(
                id=self.id,
                content=content,
                additional_kwargs=additional_kwargs,
                response_metadata=response_metadata,
            )
        msg = (
            'unsupported operand type(s) for +: "'
            f"{self.__class__.__name__}"
            f'" and "{other.__class__.__name__}"'
        )
        raise TypeError(msg)








