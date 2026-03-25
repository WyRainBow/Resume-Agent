from typing import Dict, Optional

from backend.agent.agent.module.base_module_analyzer import BaseModuleAnalyzer
from backend.agent.agent.registry import AgentRegistry


@AgentRegistry.register("skills_analyzer")
class SkillsAnalyzerAgent(BaseModuleAnalyzer):
    """技能专项分析 Agent（轻量规则版）"""

    name: str = "SkillsAnalyzerAgent"
    module_name: str = "skills"
    module_display_name: str = "技能"

    async def analyze(self, resume_data: Dict) -> Dict:
        skills_text = resume_data.get("skillContent") or resume_data.get("skills") or ""
        skills_text = skills_text.strip() if isinstance(skills_text, str) else ""

        if not skills_text:
            return self._empty_analysis()

        score = 75
        issues = []
        if len(skills_text) < 30:
            issues.append(
                {
                    "id": "skills-too-short",
                    "problem": "技能描述过短，缺少具体技术栈或熟练度",
                    "severity": "medium",
                    "suggestion": "补充核心技能栈、熟练度以及相关工具/框架",
                }
            )

        result = {
            "module": self.module_name,
            "module_display_name": self.module_display_name,
            "score": score,
            "priority_score": 100 - score,
            "analysis_type": "simple",
            "total_items": 1,
            "analyzed_items": 1,
            "strengths": [],
            "weaknesses": [],
            "issues": issues,
            "highlights": ["技能模块已填写"],
            "details": {"length": len(skills_text)},
        }
        self._analysis_result = result
        return result

    async def optimize(self, resume_data: Dict, issue_id: Optional[str] = None) -> Dict:
        current = resume_data.get("skillContent") or resume_data.get("skills") or ""
        optimized = "Java/Python、Spring Boot/Django、MySQL/Redis、Docker/K8s（熟练）"
        return {
            "issue_id": issue_id or "skills-optimization",
            "module": self.module_name,
            "current": current or "（空）",
            "optimized": optimized,
            "explanation": "列出核心技术栈并标注熟练度，提升可读性。",
            "apply_path": "skillContent",
        }

    def _empty_analysis(self) -> Dict:
        return {
            "module": self.module_name,
            "module_display_name": self.module_display_name,
            "score": 0,
            "priority_score": 90,
            "analysis_type": "simple",
            "total_items": 0,
            "analyzed_items": 0,
            "strengths": [],
            "weaknesses": [],
            "issues": [
                {
                    "id": "skills-missing",
                    "problem": "技能模块为空",
                    "severity": "high",
                    "suggestion": "补充核心技能栈、熟练度以及工具/框架",
                }
            ],
            "highlights": [],
            "details": {},
        }
