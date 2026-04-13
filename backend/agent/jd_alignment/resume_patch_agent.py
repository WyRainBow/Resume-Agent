from __future__ import annotations

from copy import deepcopy
from uuid import uuid4

from backend.agent.jd_alignment.llm_json import ask_json
from backend.agent.jd_alignment.prompts import (
    build_patch_system_prompt,
    build_patch_user_prompt,
)
from backend.agent.jd_alignment.schemas import (
    JDMatchAnalysis,
    MODULE_LABEL_MAP,
    MODULE_PATH_MAP,
    ModulePatchDraft,
    PatchBatch,
    StructuredJD,
)
from backend.agent.llm import LLM
from backend.json_path import get_by_path, set_by_path


def _wrap_value(path: str, value):
    container = {}
    set_by_path(container, path, value)
    return container


def _validate_replacement_type(module_key: str, current_value, new_value) -> None:
    if module_key == "skills":
        if not isinstance(new_value, str):
            raise ValueError("skills 模块 patch 必须返回字符串")
        return
    if type(current_value) is not type(new_value):
        raise ValueError(f"{module_key} 模块 patch 类型不匹配")


class ResumePatchAgent:
    def __init__(self, llm: LLM):
        self.llm = llm

    async def run(
        self,
        *,
        structured_jd: StructuredJD,
        match_analysis: JDMatchAnalysis,
        resume_data: dict,
    ) -> list[PatchBatch]:
        raw = await ask_json(
            self.llm,
            system_prompt=build_patch_system_prompt(),
            user_prompt=build_patch_user_prompt(
                structured_jd.model_dump(),
                match_analysis.model_dump(),
                resume_data,
            ),
        )
        proposals = raw.get("patch_batches")
        if not isinstance(proposals, list):
            raise ValueError("patch_batches 必须是数组")
        return [self._build_batch(item, resume_data) for item in proposals]

    def _build_batch(self, payload: dict, resume_data: dict) -> PatchBatch:
        proposal = ModulePatchDraft.model_validate(payload)
        path = MODULE_PATH_MAP[proposal.module_key]
        _, _, current_value = get_by_path(resume_data, path)
        next_value = deepcopy(proposal.value)
        _validate_replacement_type(proposal.module_key, current_value, next_value)
        before = _wrap_value(path, deepcopy(current_value))
        after = _wrap_value(path, next_value)
        return PatchBatch(
            patch_id=f"jd_patch_{uuid4().hex}",
            module_key=proposal.module_key,
            module_label=MODULE_LABEL_MAP[proposal.module_key],
            summary=proposal.summary,
            paths=[path],
            before=before,
            after=after,
        )
