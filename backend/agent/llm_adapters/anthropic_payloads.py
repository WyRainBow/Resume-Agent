from __future__ import annotations

import json
from typing import Any, Optional

from openai.types.chat import ChatCompletionMessage

from backend.agent.llm_adapters.anthropic_common import (
    DATA_URL_PATTERN,
    build_chat_completion_message,
    content_to_text,
)


def build_payload(
    *,
    model: str,
    max_tokens: int,
    default_temperature: float,
    messages: list[dict[str, Any]],
    tools: Optional[list[dict[str, Any]]],
    tool_choice: str,
    temperature: Optional[float],
    stream: bool,
) -> dict[str, Any]:
    system_text, request_messages = convert_messages(messages)
    payload: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": request_messages,
        "stream": stream,
        "temperature": temperature if temperature is not None else default_temperature,
    }
    if system_text:
        payload["system"] = system_text
    if tools:
        payload["tools"] = [convert_tool(tool) for tool in tools]
        payload["tool_choice"] = convert_tool_choice(tool_choice)
    return payload


def convert_messages(
    messages: list[dict[str, Any]]
) -> tuple[str | None, list[dict[str, Any]]]:
    system_parts: list[str] = []
    converted: list[dict[str, Any]] = []
    for message in messages:
        role = message.get("role")
        if role == "system":
            text = content_to_text(message.get("content"))
            if text:
                system_parts.append(text)
            continue
        if role == "tool":
            append_tool_result(converted, message)
            continue
        converted.append(convert_regular_message(message))
    system_text = "\n\n".join(part for part in system_parts if part)
    return (system_text or None), converted


def convert_regular_message(message: dict[str, Any]) -> dict[str, Any]:
    role = message.get("role")
    if role not in {"user", "assistant"}:
        raise ValueError(f"Unsupported anthropic message role: {role}")
    content = convert_content_blocks(message.get("content"))
    if role == "assistant":
        content.extend(convert_tool_calls(message.get("tool_calls")))
    return {"role": role, "content": content}


def append_tool_result(
    converted: list[dict[str, Any]], message: dict[str, Any]
) -> None:
    tool_call_id = (message.get("tool_call_id") or "").strip()
    if not tool_call_id:
        raise ValueError("Tool messages must include tool_call_id")
    block = {
        "type": "tool_result",
        "tool_use_id": tool_call_id,
        "content": content_to_text(message.get("content")),
    }
    if converted and converted[-1]["role"] == "user":
        converted[-1]["content"].append(block)
        return
    converted.append({"role": "user", "content": [block]})


def convert_content_blocks(content: Any) -> list[dict[str, Any]]:
    if content is None:
        return []
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    blocks: list[dict[str, Any]] = []
    for item in content:
        if isinstance(item, str):
            blocks.append({"type": "text", "text": item})
            continue
        block_type = item.get("type")
        if block_type == "text":
            blocks.append({"type": "text", "text": item.get("text", "")})
            continue
        if block_type == "image_url":
            blocks.append(convert_image(item))
            continue
        raise ValueError(f"Unsupported content block: {block_type}")
    return blocks


def convert_image(item: dict[str, Any]) -> dict[str, Any]:
    image_url = item.get("image_url")
    url = image_url.get("url") if isinstance(image_url, dict) else image_url
    if not isinstance(url, str):
        raise ValueError("Anthropic image conversion requires a data URL string")
    matched = DATA_URL_PATTERN.match(url)
    if not matched:
        raise ValueError("Anthropic image conversion only supports base64 data URLs")
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": matched.group("media"),
            "data": matched.group("data"),
        },
    }


def convert_tool_calls(tool_calls: Any) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for call in tool_calls or []:
        function = call.get("function", {}) if isinstance(call, dict) else call.function
        arguments = (
            function.get("arguments", "{}")
            if isinstance(function, dict)
            else function.arguments
        )
        blocks.append(
            {
                "type": "tool_use",
                "id": call.get("id") if isinstance(call, dict) else call.id,
                "name": function.get("name") if isinstance(function, dict) else function.name,
                "input": json.loads(arguments or "{}"),
            }
        )
    return blocks


def convert_tool(tool: dict[str, Any]) -> dict[str, Any]:
    function = tool.get("function") or {}
    return {
        "name": function.get("name"),
        "description": function.get("description", ""),
        "input_schema": function.get("parameters")
        or {"type": "object", "properties": {}},
    }


def convert_tool_choice(tool_choice: str) -> dict[str, str]:
    if tool_choice == "required":
        return {"type": "any"}
    return {"type": tool_choice}


def normalize_message_response(
    content_blocks: list[dict[str, Any]],
) -> ChatCompletionMessage | None:
    text_parts: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    for block in content_blocks:
        block_type = block.get("type")
        if block_type == "text":
            text_parts.append(block.get("text", ""))
            continue
        if block_type == "tool_use":
            tool_calls.append(
                {
                    "id": block.get("id"),
                    "type": "function",
                    "function": {
                        "name": block.get("name"),
                        "arguments": json.dumps(
                            block.get("input") or {}, ensure_ascii=False
                        ),
                    },
                }
            )
    return build_chat_completion_message("".join(text_parts) or None, tool_calls)
