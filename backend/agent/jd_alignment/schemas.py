from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


StageKey = Literal[
    "fetch_jd",
    "structure_jd",
    "extract_requirements",
    "analyze_resume",
    "generate_patch",
    "generate_learning_path",
]

StageStatus = Literal["pending", "in_progress", "completed", "error"]
ModuleKey = Literal[
    "basic",
    "experience",
    "projects",
    "skills",
    "education",
    "openSource",
    "awards",
]

MODULE_PATH_MAP: dict[ModuleKey, str] = {
    "basic": "basic",
    "experience": "experience",
    "projects": "projects",
    "skills": "skillContent",
    "education": "education",
    "openSource": "openSource",
    "awards": "awards",
}

MODULE_LABEL_MAP: dict[ModuleKey, str] = {
    "basic": "基本信息",
    "experience": "工作经历",
    "projects": "项目经历",
    "skills": "技能",
    "education": "教育经历",
    "openSource": "开源经历",
    "awards": "奖项荣誉",
}

STAGE_LABEL_MAP: dict[StageKey, str] = {
    "fetch_jd": "获取 JD",
    "structure_jd": "结构化 JD",
    "extract_requirements": "提炼岗位要求",
    "analyze_resume": "分析简历差距",
    "generate_patch": "生成 Patch",
    "generate_learning_path": "生成学习路径",
}


class StructuredJD(BaseModel):
    title: str
    company_name: str = ""
    summary: str = ""
    responsibilities: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    tools_and_stack: list[str] = Field(default_factory=list)
    seniority: str = ""
    keywords: list[str] = Field(default_factory=list)
    source_url: str = ""


class JDRequirements(BaseModel):
    responsibilities: list[str] = Field(default_factory=list)
    must_have_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    domain_focus: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)


class JDMatchAnalysis(BaseModel):
    match_score: float
    summary: str
    core_gaps: list[str] = Field(default_factory=list)
    priority_updates: list[str] = Field(default_factory=list)
    current_must_have_stack: list[str] = Field(default_factory=list)
    future_stack: list[str] = Field(default_factory=list)


class ModulePatchDraft(BaseModel):
    module_key: ModuleKey
    summary: str
    value: Any


class LearningPhase(BaseModel):
    phase_name: str
    goal: str
    topics: list[str] = Field(default_factory=list)
    suggested_projects: list[str] = Field(default_factory=list)
    resume_ready_outcomes: list[str] = Field(default_factory=list)


class PatchBatch(BaseModel):
    patch_id: str
    module_key: ModuleKey
    module_label: str
    summary: str
    paths: list[str]
    before: dict[str, Any]
    after: dict[str, Any]
    status: Literal["pending", "applied", "rejected"] = "pending"


class StageEvent(BaseModel):
    stage: StageKey
    label: str
    status: StageStatus
    message: str = ""


class JDAnalysisBundle(BaseModel):
    structured_jd: StructuredJD
    requirements: JDRequirements
    match: JDMatchAnalysis
    patch_batches: list[PatchBatch]
    learning_path: list[LearningPhase]

    def to_report(self) -> dict[str, Any]:
        return {
            "structured_jd": self.structured_jd.model_dump(),
            "requirements": self.requirements.model_dump(),
            "match": self.match.model_dump(),
        }
