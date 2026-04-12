from __future__ import annotations

import json
import re
from typing import Any

from openai.types.chat import ChatCompletionMessage

ANTHROPIC_VERSION = "2023-06-01"
DATA_URL_PATTERN = re.compile(r"^data:(?P<media>[^;]+);base64,(?P<data>.+)$")


class AnthropicAPIError(RuntimeError):
    def __init__(self, status_code: int, message: str):
        super().__init__(f"Anthropic API error {status_code}: {message}")
        self.status_code = status_code


def build_chat_completion_message(
    content: str | None,
    tool_calls: list[dict[str, Any]],
) -> ChatCompletionMessage | None:
    payload: dict[str, Any] = {"role": "assistant", "content": content}
    if tool_calls:
        payload["tool_calls"] = tool_calls
    try:
        return ChatCompletionMessage.model_validate(payload)
    except AttributeError:
        return ChatCompletionMessage(**payload)


def content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    parts: list[str] = []
    for item in content:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict) and item.get("type") == "text":
            parts.append(item.get("text", ""))
    return "".join(parts)


def messages_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/messages"):
        return base
    if not base.endswith("/v1"):
        base = f"{base}/v1"
    return f"{base}/messages"


def request_headers(api_key: str) -> dict[str, str]:
    return {
        "content-type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
    }


def raise_http_error(status_code: int, raw_body: str) -> AnthropicAPIError:
    try:
        payload = json.loads(raw_body)
        message = (
            payload.get("error", {}).get("message")
            or payload.get("message")
            or raw_body
        )
    except json.JSONDecodeError:
        message = raw_body
    return AnthropicAPIError(status_code, message.strip() or "Unknown error")
