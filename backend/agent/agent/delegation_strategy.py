from typing import Dict, List, Optional

from backend.agent.memory.conversation_state import Intent


class AgentDelegationStrategy:
    """Agent delegation strategies by intent."""

    STRATEGIES: Dict[str, Dict[str, object]] = {
        "analyze_resume": {
            "analyzers": ["work_experience_analyzer", "skills_analyzer"],
            "parallel": True,
        },
        "optimize_section": {
            "analyzers": ["{section}_analyzer"],
            "optimizer": "resume_optimizer",
            "parallel": False,
        },
        "full_optimize": {
            "analyzers": ["work_experience_analyzer", "skills_analyzer"],
            "optimizer": "resume_optimizer",
            "parallel": True,
        },
    }

    @classmethod
    def resolve(cls, intent: Intent, section: Optional[str] = None) -> Optional[Dict[str, object]]:
        if intent == Intent.ANALYZE_RESUME:
            return cls.STRATEGIES["analyze_resume"].copy()
        if intent == Intent.OPTIMIZE_SECTION:
            strategy = cls.STRATEGIES["optimize_section"].copy()
            if section:
                mapped = cls._map_section_to_analyzer(section)
                if mapped:
                    strategy["analyzers"] = [mapped]
                else:
                    strategy["analyzers"] = []
            return strategy
        if intent == Intent.FULL_OPTIMIZE:
            return cls.STRATEGIES["full_optimize"].copy()
        return None

    @staticmethod
    def _map_section_to_analyzer(section: str) -> Optional[str]:
        normalized = section.lower()
        if "工作" in normalized:
            return "work_experience_analyzer"
        if "教育" in normalized:
            return None
        if "技能" in normalized or "技术" in normalized:
            return "skills_analyzer"
        return None
