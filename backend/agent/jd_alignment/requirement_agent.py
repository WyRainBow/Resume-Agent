from __future__ import annotations

from backend.agent.jd_alignment.llm_json import ask_json
from backend.agent.jd_alignment.prompts import (
    build_requirement_system_prompt,
    build_requirement_user_prompt,
)
from backend.agent.jd_alignment.schemas import JDRequirements, StructuredJD
from backend.agent.llm import LLM


class JDRequirementAgent:
    def __init__(self, llm: LLM):
        self.llm = llm

    async def run(self, structured_jd: StructuredJD) -> JDRequirements:
        data = await ask_json(
            self.llm,
            system_prompt=build_requirement_system_prompt(),
            user_prompt=build_requirement_user_prompt(structured_jd.model_dump()),
        )
        return JDRequirements.model_validate(data)
