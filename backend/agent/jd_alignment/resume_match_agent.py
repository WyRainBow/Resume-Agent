from __future__ import annotations

from backend.agent.jd_alignment.llm_json import ask_json
from backend.agent.jd_alignment.prompts import (
    build_match_system_prompt,
    build_match_user_prompt,
)
from backend.agent.jd_alignment.schemas import JDMatchAnalysis, JDRequirements, StructuredJD
from backend.agent.llm import LLM


class ResumeMatchAgent:
    def __init__(self, llm: LLM):
        self.llm = llm

    async def run(
        self,
        *,
        structured_jd: StructuredJD,
        requirements: JDRequirements,
        resume_data: dict,
    ) -> JDMatchAnalysis:
        data = await ask_json(
            self.llm,
            system_prompt=build_match_system_prompt(),
            user_prompt=build_match_user_prompt(
                structured_jd.model_dump(),
                requirements.model_dump(),
                resume_data,
            ),
        )
        return JDMatchAnalysis.model_validate(data)
