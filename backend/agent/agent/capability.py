from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ResumeCapability:
    """Resume capability definition for tool routing and prompt addendum."""

    name: str
    tool_whitelist: List[str] = field(default_factory=list)
    instructions_addendum: str = ""


class CapabilityRegistry:
    """Registry for Resume capabilities."""

    _capabilities: Dict[str, ResumeCapability] = {}

    @classmethod
    def register(cls, capability: ResumeCapability) -> None:
        cls._capabilities[capability.name] = capability

    @classmethod
    def get(cls, name: Optional[str]) -> ResumeCapability:
        if not name:
            return cls._capabilities["full"]
        return cls._capabilities.get(name, cls._capabilities["full"])

    @classmethod
    def list(cls) -> List[str]:
        return list(cls._capabilities.keys())


ANALYZE_CAPABILITY = ResumeCapability(
    name="analyze",
    tool_whitelist=["cv_reader_agent", "cv_analyzer_agent", "education_analyzer"],
    instructions_addendum="专注于简历分析，不执行编辑操作。",
)

EDIT_CAPABILITY = ResumeCapability(
    name="edit",
    tool_whitelist=["cv_reader_agent", "cv_editor_agent"],
    instructions_addendum="专注于简历编辑，必要时先读取结构（output_mode=structure）。",
)

OPTIMIZE_CAPABILITY = ResumeCapability(
    name="optimize",
    tool_whitelist=[
        "cv_reader_agent",
        "cv_analyzer_agent",
        "education_analyzer",
        "cv_editor_agent",
    ],
    instructions_addendum="专注于简历优化，优先给出可执行的修改建议。",
)

FULL_CAPABILITY = ResumeCapability(
    name="full",
    tool_whitelist=[],
    instructions_addendum="",
)


CapabilityRegistry.register(ANALYZE_CAPABILITY)
CapabilityRegistry.register(EDIT_CAPABILITY)
CapabilityRegistry.register(OPTIMIZE_CAPABILITY)
CapabilityRegistry.register(FULL_CAPABILITY)
