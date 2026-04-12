"""Kimi Code client using the Anthropic Messages protocol."""

from __future__ import annotations

import json
from typing import Any, Dict, Iterable, Iterator, Optional

import requests

KIMI_API_FORMAT = "anthropic-messages"
KIMI_ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_KIMI_BASE_URL = "https://api.kimi.com/coding"
DEFAULT_KIMI_MODEL = "kimi-for-coding"
DEFAULT_MAX_TOKENS = 4000
DEFAULT_TEMPERATURE = 0.1


def _normalize_base_url(base_url: str) -> str:
    normalized = (base_url or DEFAULT_KIMI_BASE_URL).strip().rstrip("/")
    if normalized.endswith("/v1"):
        return normalized
    return f"{normalized}/v1"


def _build_headers(api_key: str) -> Dict[str, str]:
    return {
        "content-type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": KIMI_ANTHROPIC_VERSION,
    }


def _build_payload(
    prompt: str,
    model: Optional[str],
    stream: bool,
    max_tokens: int,
    temperature: float,
) -> Dict[str, Any]:
    return {
        "model": model or DEFAULT_KIMI_MODEL,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": stream,
        "messages": [{"role": "user", "content": prompt}],
    }


def _extract_text_blocks(content: Iterable[Dict[str, Any]]) -> str:
    parts: list[str] = []
    for block in content:
        if block.get("type") == "text" and block.get("text"):
            parts.append(block["text"])
    return "".join(parts).strip()


def _raise_for_error(response: requests.Response) -> None:
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict) and error.get("message"):
            raise Exception(error["message"])

    response.raise_for_status()


def call_kimi_api(
    prompt: str,
    *,
    api_key: str,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    temperature: float = DEFAULT_TEMPERATURE,
) -> Dict[str, Any]:
    url = f"{_normalize_base_url(base_url or DEFAULT_KIMI_BASE_URL)}/messages"
    response = requests.post(
        url,
        headers=_build_headers(api_key),
        json=_build_payload(prompt, model, False, max_tokens, temperature),
        timeout=60,
    )
    if response.status_code != 200:
        _raise_for_error(response)

    payload = response.json()
    content = _extract_text_blocks(payload.get("content", []))
    usage = payload.get("usage", {})
    return {"content": content, "usage": usage, "model": payload.get("model", model)}


def call_kimi_api_stream(
    prompt: str,
    *,
    api_key: str,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    temperature: float = DEFAULT_TEMPERATURE,
) -> Iterator[str]:
    url = f"{_normalize_base_url(base_url or DEFAULT_KIMI_BASE_URL)}/messages"
    response = requests.post(
        url,
        headers=_build_headers(api_key),
        json=_build_payload(prompt, model, True, max_tokens, temperature),
        timeout=90,
        stream=True,
    )
    if response.status_code != 200:
        _raise_for_error(response)

    current_event: Optional[str] = None
    for raw_line in response.iter_lines(decode_unicode=True):
        if raw_line is None:
            continue
        line = raw_line.strip()
        if not line:
            current_event = None
            continue
        if line.startswith("event:"):
            current_event = line.split(":", 1)[1].strip()
            continue
        if not line.startswith("data:"):
            continue
        data = line.split(":", 1)[1].strip()
        if data == "[DONE]":
            break

        payload = json.loads(data)
        if current_event == "content_block_delta":
            delta = payload.get("delta", {})
            text = delta.get("text", "")
            if text:
                yield text
