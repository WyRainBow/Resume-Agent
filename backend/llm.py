"""Unified LLM access for resume flows."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Dict, Iterator, Optional

from fastapi import HTTPException

from backend.kimi_client import (
    DEFAULT_KIMI_BASE_URL,
    DEFAULT_KIMI_MODEL,
    KIMI_API_FORMAT,
    call_kimi_api,
    call_kimi_api_stream,
)

CURRENT_DIR = Path(__file__).resolve().parent
ROOT = CURRENT_DIR.parent
for path in (CURRENT_DIR, ROOT):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

try:
    from backend import simple
except ImportError:
    import simple

DEFAULT_MODELS: Dict[str, str] = {
    "kimi": DEFAULT_KIMI_MODEL,
    "zhipu": os.getenv("ZHIPU_MODEL", "glm-4.5v"),
    "doubao": os.getenv("DOUBAO_MODEL", "doubao-seed-1-6-lite-251015"),
    "deepseek": "deepseek-v3.2",
}

SUPPORTED_MODELS: Dict[str, str] = {
    "kimi-for-coding": "Kimi For Coding (Anthropic Messages)",
    "deepseek-v3.2": "DeepSeek V3.2",
    "deepseek-reasoner": "DeepSeek Reasoner",
}


def _has_key(value: str) -> bool:
    return bool(value and value.strip())


def resolve_default_provider() -> str:
    configured = os.getenv("DEFAULT_AI_PROVIDER", "").strip()
    if configured:
        return configured

    if _has_key(os.getenv("KIMI_API_KEY", "")):
        return "kimi"
    if _has_key(os.getenv("DASHSCOPE_API_KEY", "")):
        return "deepseek"
    if _has_key(os.getenv("ZHIPU_API_KEY", "")):
        return "zhipu"
    if _has_key(os.getenv("DOUBAO_API_KEY", "")):
        return "doubao"
    return "kimi"


DEFAULT_AI_PROVIDER = resolve_default_provider()


def _require_key(provider: str, env_name: str) -> str:
    key = os.getenv(env_name, "").strip()
    if key:
        return key
    raise HTTPException(
        status_code=400,
        detail=f"缺少 {env_name}，请在项目根目录 .env 或系统环境中配置 {env_name}",
    )


def _validate_kimi_api_format() -> None:
    api_format = os.getenv("KIMI_API_FORMAT", KIMI_API_FORMAT).strip() or KIMI_API_FORMAT
    if api_format != KIMI_API_FORMAT:
        raise HTTPException(
            status_code=400,
            detail=f"KIMI_API_FORMAT 仅支持 {KIMI_API_FORMAT}，当前为 {api_format}",
        )


def _call_kimi(prompt: str, model: Optional[str], return_usage: bool):
    _validate_kimi_api_format()
    key = _require_key("kimi", "KIMI_API_KEY")
    base_url = os.getenv("KIMI_BASE_URL", DEFAULT_KIMI_BASE_URL)
    kimi_model = model or os.getenv("KIMI_MODEL", DEFAULT_KIMI_MODEL)
    result = call_kimi_api(
        prompt,
        api_key=key,
        base_url=base_url,
        model=kimi_model,
    )
    if return_usage:
        return result
    return result["content"]


def _call_deepseek(prompt: str, model: Optional[str]) -> str:
    key = _require_key("deepseek", "DASHSCOPE_API_KEY")
    simple.DEEPSEEK_API_KEY = key
    simple.DEEPSEEK_MODEL = model or os.getenv("DEEPSEEK_MODEL", simple.DEEPSEEK_MODEL)
    simple.DEEPSEEK_BASE_URL = os.getenv(
        "DEEPSEEK_BASE_URL", simple.DEEPSEEK_BASE_URL
    )
    return simple.call_deepseek_api(prompt, model=simple.DEEPSEEK_MODEL)


def _call_doubao(prompt: str) -> str:
    key = _require_key("doubao", "DOUBAO_API_KEY")
    simple.DOUBAO_API_KEY = key
    simple.DOUBAO_MODEL = os.getenv("DOUBAO_MODEL", simple.DOUBAO_MODEL)
    simple.DOUBAO_BASE_URL = os.getenv("DOUBAO_BASE_URL", simple.DOUBAO_BASE_URL)
    return simple.call_doubao_api(prompt)


def _call_zhipu(prompt: str, return_usage: bool):
    key = _require_key("zhipu", "ZHIPU_API_KEY")
    if getattr(simple, "ZHIPU_API_KEY", "") != key:
        simple._zhipu_client = None
        simple._last_zhipu_key = None
    simple.ZHIPU_API_KEY = key
    result = simple.call_zhipu_api(prompt)
    if return_usage:
        return result
    if isinstance(result, dict):
        return result.get("content", "")
    return result


def call_llm(
    provider: str,
    prompt: str,
    return_usage: bool = False,
    model: Optional[str] = None,
):
    if provider == "kimi":
        return _call_kimi(prompt, model, return_usage)
    if provider == "deepseek":
        return _call_deepseek(prompt, model)
    if provider == "doubao":
        return _call_doubao(prompt)
    if provider == "zhipu":
        return _call_zhipu(prompt, return_usage)
    raise ValueError(f"不支持的 provider: {provider}")


def call_llm_stream(provider: str, prompt: str, model: Optional[str] = None) -> Iterator[str]:
    if provider == "kimi":
        _validate_kimi_api_format()
        key = _require_key("kimi", "KIMI_API_KEY")
        base_url = os.getenv("KIMI_BASE_URL", DEFAULT_KIMI_BASE_URL)
        kimi_model = model or os.getenv("KIMI_MODEL", DEFAULT_KIMI_MODEL)
        yield from call_kimi_api_stream(
            prompt,
            api_key=key,
            base_url=base_url,
            model=kimi_model,
        )
        return

    if provider == "doubao":
        key = _require_key("doubao", "DOUBAO_API_KEY")
        simple.DOUBAO_API_KEY = key
        simple.DOUBAO_MODEL = os.getenv("DOUBAO_MODEL", simple.DOUBAO_MODEL)
        simple.DOUBAO_BASE_URL = os.getenv("DOUBAO_BASE_URL", simple.DOUBAO_BASE_URL)
        yield from simple.call_doubao_api_stream(prompt)
        return

    if provider == "deepseek":
        key = _require_key("deepseek", "DASHSCOPE_API_KEY")
        simple.DEEPSEEK_API_KEY = key
        simple.DEEPSEEK_MODEL = model or os.getenv(
            "DEEPSEEK_MODEL", simple.DEEPSEEK_MODEL
        )
        simple.DEEPSEEK_BASE_URL = os.getenv(
            "DEEPSEEK_BASE_URL", simple.DEEPSEEK_BASE_URL
        )
        yield from simple.call_deepseek_api_stream(prompt)
        return

    if provider == "zhipu":
        result = call_llm(provider, prompt, model=model)
        yield result
        return

    raise ValueError(f"不支持的 provider: {provider}")


def get_ai_config():
    default_provider = resolve_default_provider()
    return {
        "defaultProvider": default_provider,
        "defaultModel": DEFAULT_MODELS.get(default_provider, ""),
        "models": DEFAULT_MODELS,
        "supportedModels": SUPPORTED_MODELS,
    }
