"""Configuration management routes."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, HTTPException

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

try:
    from models import AITestRequest, ChatRequest, SaveKeysRequest
    from llm import call_llm, get_ai_config, resolve_default_provider
except ImportError:
    from backend.models import AITestRequest, ChatRequest, SaveKeysRequest
    from backend.llm import call_llm, get_ai_config, resolve_default_provider

router = APIRouter(prefix="/api", tags=["Config"])

ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT_DIR / ".env"
KEY_ENV_BY_PROVIDER: Dict[str, str] = {
    "kimi": "KIMI_API_KEY",
    "zhipu": "ZHIPU_API_KEY",
    "doubao": "DOUBAO_API_KEY",
    "deepseek": "DASHSCOPE_API_KEY",
}
PROVIDER_LABELS: Dict[str, str] = {
    "kimi": "Kimi",
    "zhipu": "智谱",
    "doubao": "豆包",
    "deepseek": "DeepSeek",
}


def _read_env_values() -> Dict[str, str]:
    values = {env_name: "" for env_name in KEY_ENV_BY_PROVIDER.values()}
    if ENV_PATH.exists():
        try:
            with open(ENV_PATH, "r", encoding="utf-8") as file:
                for raw_line in file:
                    line = raw_line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    key = key.strip()
                    if key in values:
                        values[key] = value.strip().strip('"').strip("'")
            return values
        except Exception:
            pass

    for env_name in values:
        values[env_name] = os.getenv(env_name, "")
    return values


def _build_status_payload(values: Dict[str, str]) -> Dict[str, Dict[str, object]]:
    payload: Dict[str, Dict[str, object]] = {}
    for provider, env_name in KEY_ENV_BY_PROVIDER.items():
        key = values.get(env_name, "")
        payload[provider] = {
            "configured": bool(key and len(key) > 10),
            "preview": f"{key[:8]}..." if key and len(key) > 10 else "",
        }
    return payload


def _write_env_values(updates: Dict[str, str]) -> None:
    existing_lines = []
    if ENV_PATH.exists():
        with open(ENV_PATH, "r", encoding="utf-8") as file:
            existing_lines = file.readlines()

    found = {env_name: False for env_name in updates}
    new_lines = []
    for line in existing_lines:
        replaced = False
        for env_name, value in updates.items():
            if line.startswith(f"{env_name}=") and value:
                new_lines.append(f"{env_name}={value}\n")
                found[env_name] = True
                replaced = True
                break
        if not replaced:
            new_lines.append(line)

    for env_name, value in updates.items():
        if value and not found[env_name]:
            new_lines.append(f"{env_name}={value}\n")

    with open(ENV_PATH, "w", encoding="utf-8") as file:
        file.writelines(new_lines)

    if load_dotenv:
        load_dotenv(dotenv_path=str(ENV_PATH), override=True)


def _sync_runtime_keys(body: SaveKeysRequest) -> None:
    try:
        try:
            from backend import simple
        except ImportError:
            import simple
    except Exception:
        return

    if body.zhipu_key:
        simple.ZHIPU_API_KEY = body.zhipu_key
        simple._zhipu_client = None
        simple._last_zhipu_key = None

    if body.doubao_key:
        simple.DOUBAO_API_KEY = body.doubao_key

    if body.deepseek_key:
        simple.DEEPSEEK_API_KEY = body.deepseek_key


def _pick_provider(provider: str | None) -> str:
    if provider:
        return provider
    return resolve_default_provider()


@router.get("/ai/config")
async def get_ai_config_endpoint():
    return get_ai_config()


@router.get("/config/keys")
async def get_keys_status():
    return _build_status_payload(_read_env_values())


@router.post("/config/keys")
async def save_keys(body: SaveKeysRequest):
    try:
        updates = {
            "KIMI_API_KEY": body.kimi_key or "",
            "ZHIPU_API_KEY": body.zhipu_key or "",
            "DOUBAO_API_KEY": body.doubao_key or "",
            "DASHSCOPE_API_KEY": body.deepseek_key or "",
        }
        _write_env_values(updates)
        _sync_runtime_keys(body)
        return {"success": True, "message": "API Key 已保存"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"保存失败: {exc}")


@router.get("/ai/test-keys")
async def test_ai_keys():
    values = _read_env_values()
    status = _build_status_payload(values)
    result: Dict[str, Dict[str, object]] = {}
    for provider in KEY_ENV_BY_PROVIDER:
        if not status[provider]["configured"]:
            result[provider] = {"configured": False}
            continue
        try:
            call_llm(provider, "你好", return_usage=False)
            result[provider] = {"configured": True, "ok": True}
        except HTTPException as exc:
            result[provider] = {
                "configured": True,
                "ok": False,
                "error": str(exc.detail) if exc.detail else f"HTTP {exc.status_code}",
            }
        except Exception as exc:
            result[provider] = {"configured": True, "ok": False, "error": str(exc)}
    return result


@router.post("/ai/test")
async def ai_test(body: AITestRequest):
    try:
        result = call_llm(body.provider, body.prompt, return_usage=True)
        if isinstance(result, dict):
            return {
                "provider": body.provider,
                "result": result.get("content", ""),
                "usage": result.get("usage", {}),
            }
        return {"provider": body.provider, "result": result, "usage": {}}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI 测试失败: {exc}")


@router.post("/chat")
async def chat_api(body: ChatRequest):
    try:
        prompt_parts = []
        for msg in body.messages:
            prompt_parts.append(f"{msg.role}: {msg.content}")
        prompt = "\n\n".join(prompt_parts) + "\n\n请回复："
        provider = _pick_provider(body.provider)
        result = call_llm(provider, prompt)
        return {"content": result, "provider": provider}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI 请求失败: {exc}")
