from __future__ import annotations

from backend.agent.jd_alignment.llm_json import ask_json
from backend.agent.jd_alignment.prompts import (
    build_learning_path_system_prompt,
    build_learning_path_user_prompt,
)
from backend.agent.jd_alignment.schemas import JDMatchAnalysis, LearningPhase, StructuredJD
from backend.agent.llm import LLM


class LearningPathAgent:
    def __init__(self, llm: LLM):
        self.llm = llm

    async def run(
        self,
        *,
        structured_jd: StructuredJD,
        match_analysis: JDMatchAnalysis,
    ) -> list[LearningPhase]:
        data = await ask_json(
            self.llm,
            system_prompt=build_learning_path_system_prompt(),
            user_prompt=build_learning_path_user_prompt(
                structured_jd.model_dump(),
                match_analysis.model_dump(),
            ),
        )
        phases = data.get("phases")
        if not isinstance(phases, list):
            raise ValueError("learning path phases 必须是数组")
        return [LearningPhase.model_validate(item) for item in phases]
