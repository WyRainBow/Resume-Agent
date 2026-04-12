from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Optional

import httpx
from openai.types.chat import ChatCompletionMessage

from backend.agent.config import NetworkConfig, config
from backend.agent.llm_adapters.anthropic_common import (
    AnthropicAPIError,
    messages_url,
    raise_http_error,
    request_headers,
)
from backend.agent.llm_adapters.anthropic_payloads import (
    build_payload,
    normalize_message_response,
)
from backend.agent.llm_adapters.anthropic_streaming import (
    consume_stream_event,
    iter_sse_events,
    normalize_stream_result,
)


class AnthropicMessagesAdapter:
    def __init__(
        self,
        *,
        model: str,
        base_url: str,
        api_key: str,
        max_tokens: int,
        temperature: float,
        timeout: httpx.Timeout,
    ) -> None:
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.timeout = timeout
        self.network_config = config.network or NetworkConfig()

    async def ask(
        self,
        *,
        messages: list[dict[str, Any]],
        temperature: Optional[float],
        stream: bool,
    ) -> str:
        if stream:
            response = await self.ask_tool_stream(
                messages=messages,
                tools=None,
                tool_choice="none",
                temperature=temperature,
            )
        else:
            response = await self.ask_tool(
                messages=messages,
                tools=None,
                tool_choice="none",
                temperature=temperature,
            )
        if response is None or not response.content:
            raise ValueError("Empty response from anthropic messages API")
        return response.content

    async def ask_tool(
        self,
        *,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]],
        tool_choice: str,
        temperature: Optional[float],
    ) -> ChatCompletionMessage | None:
        payload = build_payload(
            model=self.model,
            max_tokens=self.max_tokens,
            default_temperature=self.temperature,
            messages=messages,
            tools=tools,
            tool_choice=tool_choice,
            temperature=temperature,
            stream=False,
        )
        data = await self._post_json(payload)
        return normalize_message_response(data.get("content", []))

    async def ask_tool_stream(
        self,
        *,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]],
        tool_choice: str,
        temperature: Optional[float],
        on_content_delta: Optional[Callable[[str], Awaitable[None]]] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> ChatCompletionMessage | None:
        payload = build_payload(
            model=self.model,
            max_tokens=self.max_tokens,
            default_temperature=self.temperature,
            messages=messages,
            tools=tools,
            tool_choice=tool_choice,
            temperature=temperature,
            stream=True,
        )
        text_parts: list[str] = []
        tool_states = {}
        with self.network_config.without_proxy():
            async with httpx.AsyncClient(
                headers=request_headers(self.api_key),
                timeout=self.timeout,
            ) as client:
                async with client.stream(
                    "POST",
                    messages_url(self.base_url),
                    json=payload,
                ) as resp:
                    if resp.is_error:
                        raise await self._build_http_error(resp)
                    async for event in iter_sse_events(resp):
                        if cancel_event and cancel_event.is_set():
                            raise asyncio.CancelledError(
                                "Cancelled while streaming anthropic response"
                            )
                        piece = consume_stream_event(event, text_parts, tool_states)
                        if piece and on_content_delta:
                            await on_content_delta(piece)
        return normalize_stream_result(text_parts, tool_states)

    async def _post_json(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self.network_config.without_proxy():
            async with httpx.AsyncClient(
                headers=request_headers(self.api_key),
                timeout=self.timeout,
            ) as client:
                response = await client.post(messages_url(self.base_url), json=payload)
        if response.is_error:
            raise raise_http_error(response.status_code, response.text)
        return response.json()

    async def _build_http_error(self, response: httpx.Response) -> AnthropicAPIError:
        body = (await response.aread()).decode("utf-8", "ignore")
        return raise_http_error(response.status_code, body)
