from __future__ import annotations

from backend.agent.jd_alignment.llm_json import ask_json
from backend.agent.jd_alignment.prompts import (
    build_parser_system_prompt,
    build_parser_user_prompt,
)
from backend.agent.jd_alignment.schemas import StructuredJD
from backend.agent.llm import LLM


class JDParserAgent:
    def __init__(self, llm: LLM):
        self.llm = llm

    async def run(self, raw_text: str, source_url: str | None = None) -> StructuredJD:
        data = await ask_json(
            self.llm,
            system_prompt=build_parser_system_prompt(),
            user_prompt=build_parser_user_prompt(raw_text, source_url),
        )
        return StructuredJD.model_validate(data)
