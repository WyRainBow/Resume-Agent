from __future__ import annotations

from typing import AsyncGenerator

from backend.agent.jd_alignment.learning_path_agent import LearningPathAgent
from backend.agent.jd_alignment.parser_agent import JDParserAgent
from backend.agent.jd_alignment.requirement_agent import JDRequirementAgent
from backend.agent.jd_alignment.resume_match_agent import ResumeMatchAgent
from backend.agent.jd_alignment.resume_patch_agent import ResumePatchAgent
from backend.agent.jd_alignment.schemas import (
    JDAnalysisBundle,
    STAGE_LABEL_MAP,
    StageEvent,
    StageKey,
    StructuredJD,
)
from backend.agent.llm import LLM


class JDAlignmentOrchestrator:
    def __init__(self, llm: LLM):
        self.parser_agent = JDParserAgent(llm)
        self.requirement_agent = JDRequirementAgent(llm)
        self.resume_match_agent = ResumeMatchAgent(llm)
        self.resume_patch_agent = ResumePatchAgent(llm)
        self.learning_path_agent = LearningPathAgent(llm)

    async def stream(
        self,
        *,
        raw_text: str,
        source_url: str | None,
        structured_seed: dict | None,
        resume_data: dict,
    ) -> AsyncGenerator[tuple[str, StageEvent | JDAnalysisBundle], None]:
        yield "stage", self._event("fetch_jd", "completed", "JD 已就绪")
        yield "stage", self._event("structure_jd", "in_progress")
        structured_jd = await self._get_structured_jd(raw_text, source_url, structured_seed)
        yield "stage", self._event("structure_jd", "completed", "JD 结构化完成")

        yield "stage", self._event("extract_requirements", "in_progress")
        requirements = await self.requirement_agent.run(structured_jd)
        yield "stage", self._event("extract_requirements", "completed", "岗位要求提炼完成")

        yield "stage", self._event("analyze_resume", "in_progress")
        match = await self.resume_match_agent.run(
            structured_jd=structured_jd,
            requirements=requirements,
            resume_data=resume_data,
        )
        yield "stage", self._event("analyze_resume", "completed", "简历差距分析完成")

        yield "stage", self._event("generate_patch", "in_progress")
        patch_batches = await self.resume_patch_agent.run(
            structured_jd=structured_jd,
            match_analysis=match,
            resume_data=resume_data,
        )
        yield "stage", self._event("generate_patch", "completed", "Patch 生成完成")

        yield "stage", self._event("generate_learning_path", "in_progress")
        learning_path = await self.learning_path_agent.run(
            structured_jd=structured_jd,
            match_analysis=match,
        )
        yield "stage", self._event("generate_learning_path", "completed", "学习路径生成完成")
        yield "result", JDAnalysisBundle(
            structured_jd=structured_jd,
            requirements=requirements,
            match=match,
            patch_batches=patch_batches,
            learning_path=learning_path,
        )

    async def _get_structured_jd(
        self,
        raw_text: str,
        source_url: str | None,
        structured_seed: dict | None,
    ) -> StructuredJD:
        if structured_seed:
            return StructuredJD.model_validate(structured_seed)
        return await self.parser_agent.run(raw_text, source_url)

    def _event(self, stage: StageKey, status, message: str = "") -> StageEvent:
        return StageEvent(stage=stage, label=STAGE_LABEL_MAP[stage], status=status, message=message)
