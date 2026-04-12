from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import httpx
from openai.types.chat import ChatCompletionMessage

from backend.agent.llm_adapters.anthropic_common import (
    AnthropicAPIError,
    build_chat_completion_message,
)


@dataclass
class ToolUseState:
    tool_id: str
    name: str
    initial_input: Any = field(default_factory=dict)
    input_chunks: list[str] = field(default_factory=list)

    def append_input(self, piece: str) -> None:
        if piece:
            self.input_chunks.append(piece)

    def build_arguments(self) -> str:
        raw = "".join(self.input_chunks).strip()
        payload = json.loads(raw) if raw else (self.initial_input or {})
        return json.dumps(payload, ensure_ascii=False)


async def iter_sse_events(response: httpx.Response):
    event_name = "message"
    data_lines: list[str] = []
    async for line in response.aiter_lines():
        if not line:
            if data_lines:
                yield {"event": event_name, "data": json.loads("\n".join(data_lines))}
            event_name = "message"
            data_lines = []
            continue
        if line.startswith("event:"):
            event_name = line[6:].strip()
            continue
        if line.startswith("data:"):
            data_lines.append(line[5:].strip())


def consume_stream_event(
    event: dict[str, Any],
    text_parts: list[str],
    tool_states: dict[int, ToolUseState],
) -> str | None:
    payload = event["data"]
    event_type = payload.get("type")
    if event_type == "content_block_start":
        return handle_block_start(payload, text_parts, tool_states)
    if event_type == "content_block_delta":
        return handle_block_delta(payload, text_parts, tool_states)
    if event_type == "error":
        detail = payload.get("error", {}).get("message") or json.dumps(
            payload, ensure_ascii=False
        )
        raise AnthropicAPIError(500, detail)
    return None


def handle_block_start(
    payload: dict[str, Any],
    text_parts: list[str],
    tool_states: dict[int, ToolUseState],
) -> str | None:
    block = payload.get("content_block") or {}
    index = int(payload.get("index", 0))
    if block.get("type") == "text":
        text = block.get("text", "")
        if text:
            text_parts.append(text)
        return text or None
    if block.get("type") == "tool_use":
        tool_states[index] = ToolUseState(
            tool_id=block.get("id", f"toolu_{index}"),
            name=block.get("name", ""),
            initial_input=block.get("input") or {},
        )
    return None


def handle_block_delta(
    payload: dict[str, Any],
    text_parts: list[str],
    tool_states: dict[int, ToolUseState],
) -> str | None:
    delta = payload.get("delta") or {}
    delta_type = delta.get("type")
    if delta_type == "text_delta":
        text = delta.get("text", "")
        if text:
            text_parts.append(text)
        return text or None
    if delta_type == "input_json_delta":
        index = int(payload.get("index", 0))
        tool_states.setdefault(
            index,
            ToolUseState(tool_id=f"toolu_{index}", name=""),
        ).append_input(delta.get("partial_json", ""))
    return None


def normalize_stream_result(
    text_parts: list[str],
    tool_states: dict[int, ToolUseState],
) -> ChatCompletionMessage | None:
    tool_calls = [
        {
            "id": state.tool_id,
            "type": "function",
            "function": {"name": state.name, "arguments": state.build_arguments()},
        }
        for _, state in sorted(tool_states.items())
    ]
    return build_chat_completion_message("".join(text_parts) or None, tool_calls)
