from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from backend.agent.config import LLMSettings, PROJECT_ROOT, config

DEFAULT_PROFILE_ENV = "AGENT_DEFAULT_LLM_PROFILE"
NON_SELECTABLE_PROFILES = frozenset({"default", "vision"})
PROFILE_ORDER = ("kimi", "deepseek", "doubao", "openai")
PROFILE_METADATA: dict[str, dict[str, str]] = {
    "kimi": {
        "label": "Kimi",
        "provider": "kimi",
        "description": "Kimi Code / kimi-for-coding",
        "api_key_env": "KIMI_API_KEY",
    },
    "deepseek": {
        "label": "DeepSeek",
        "provider": "deepseek",
        "description": "DeepSeek via DashScope compatible API",
        "api_key_env": "DASHSCOPE_API_KEY",
    },
    "doubao": {
        "label": "Doubao",
        "provider": "doubao",
        "description": "Doubao via Volcengine Ark",
        "api_key_env": "DOUBAO_API_KEY",
    },
    "openai": {
        "label": "OpenAI",
        "provider": "openai",
        "description": "OpenAI compatible API",
        "api_key_env": "OPENAI_API_KEY",
    },
}
UNSUPPORTED_PROFILE_REASONS: dict[str, str] = {}
PROJECT_ENV_PATH = Path(PROJECT_ROOT) / ".env"


def _is_placeholder(value: str) -> bool:
    return value.startswith("${") and value.endswith("}")


def _strip_env_value(value: str) -> str:
    cleaned = value.strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {'"', "'"}:
        return cleaned[1:-1]
    return cleaned


def _read_project_env_values() -> dict[str, str]:
    if not PROJECT_ENV_PATH.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in PROJECT_ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = _strip_env_value(value)
    return values


def _resolve_profile_api_key(profile_name: str, settings: LLMSettings) -> str:
    env_key = PROFILE_METADATA.get(profile_name, {}).get("api_key_env")
    if env_key:
        project_env = _read_project_env_values()
        return project_env.get(env_key, "").strip()
    return (settings.api_key or "").strip()


def _format_label(profile_name: str) -> str:
    meta = PROFILE_METADATA.get(profile_name, {})
    return meta.get("label", profile_name.replace("_", " ").title())


def _format_description(profile_name: str, settings: LLMSettings) -> str:
    meta = PROFILE_METADATA.get(profile_name, {})
    return meta.get("description", settings.model)


def _iter_selectable_profile_names() -> list[str]:
    ordered = [name for name in PROFILE_ORDER if name in config.llm]
    extras = [
        name
        for name in config.llm
        if name not in NON_SELECTABLE_PROFILES and name not in ordered
    ]
    return ordered + sorted(extras)


def get_default_profile_name() -> str:
    selectable = _iter_selectable_profile_names()
    override = os.getenv(DEFAULT_PROFILE_ENV, "").strip().lower()
    if override in selectable and is_profile_supported(override):
        return override
    for name in selectable:
        if is_profile_supported(name):
            return name
    return "default"


def resolve_profile_name(requested_profile: str | None) -> str:
    selectable = _iter_selectable_profile_names()
    normalized = (requested_profile or "").strip().lower()
    if normalized in selectable:
        return normalized
    return get_default_profile_name()


def is_profile_configured(profile_name: str) -> bool:
    settings = config.llm.get(profile_name)
    if settings is None:
        return False
    api_key = _resolve_profile_api_key(profile_name, settings)
    base_url = (settings.base_url or "").strip()
    model = (settings.model or "").strip()
    return all(
        (
            api_key and not _is_placeholder(api_key),
            base_url and not _is_placeholder(base_url),
            model and not _is_placeholder(model),
        )
    )


def is_profile_supported(profile_name: str) -> bool:
    return profile_name not in UNSUPPORTED_PROFILE_REASONS


def get_profile_disabled_reason(profile_name: str) -> str | None:
    if not is_profile_supported(profile_name):
        return UNSUPPORTED_PROFILE_REASONS[profile_name]
    if not is_profile_configured(profile_name):
        return "尚未配置 API Key"
    return None


def get_profile_settings(profile_name: str) -> LLMSettings:
    resolved = resolve_profile_name(profile_name)
    if resolved in config.llm:
        return config.llm[resolved]
    return config.llm["default"]


def build_profile_option(profile_name: str) -> dict[str, Any]:
    settings = get_profile_settings(profile_name)
    meta = PROFILE_METADATA.get(profile_name, {})
    return {
        "id": profile_name,
        "label": _format_label(profile_name),
        "provider": meta.get("provider", profile_name),
        "description": _format_description(profile_name, settings),
        "model": settings.model,
        "configured": is_profile_configured(profile_name),
        "supported": is_profile_supported(profile_name),
        "available": is_profile_configured(profile_name)
        and is_profile_supported(profile_name),
        "disabled_reason": get_profile_disabled_reason(profile_name),
        "is_default": profile_name == get_default_profile_name(),
    }


def list_model_options() -> list[dict[str, Any]]:
    return [build_profile_option(name) for name in _iter_selectable_profile_names()]
