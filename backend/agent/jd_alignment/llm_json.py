from __future__ import annotations

from typing import Any

from backend.agent.llm import LLM
from backend.parsers.json_parser import try_json_repair


async def ask_json(
    llm: LLM,
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
) -> dict[str, Any]:
    response = await llm.ask(
        messages=[{"role": "user", "content": user_prompt}],
        system_msgs=[{"role": "system", "content": system_prompt}],
        stream=False,
        temperature=temperature,
    )
    data, error = try_json_repair(response)
    if data is None or not isinstance(data, dict):
        raise ValueError(error or "LLM did not return valid JSON")
    return data
