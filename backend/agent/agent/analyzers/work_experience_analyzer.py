from typing import Dict, List, Optional

from backend.agent.agent.module.base_module_analyzer import BaseModuleAnalyzer
from backend.agent.agent.registry import AgentRegistry


@AgentRegistry.register("work_experience_analyzer")
class WorkExperienceAnalyzerAgent(BaseModuleAnalyzer):
    """工作经历专项分析 Agent（轻量规则版）"""

    name: str = "WorkExperienceAnalyzerAgent"
    module_name: str = "work_experience"
    module_display_name: str = "工作经历"

    async def analyze(self, resume_data: Dict) -> Dict:
        experiences: List[Dict] = resume_data.get("experience", []) or []
        total_items = len(experiences)
        if total_items == 0:
            return self._empty_analysis()

        score = min(90, 60 + total_items * 10)
        priority_score = max(10, 100 - score)
        highlights = []
        issues = []

        for idx, exp in enumerate(experiences[:3]):
            company = exp.get("company") or "未知公司"
            position = exp.get("position") or "未知岗位"
            highlights.append(f"{company} - {position}")
            details = exp.get("details") or exp.get("description") or ""
            if not details:
                issues.append(
                    {
                        "id": f"work-missing-detail-{idx}",
                        "problem": f"{company} 的经历缺少细节描述",
                        "severity": "medium",
                        "suggestion": "补充职责、行动和成果，尽量量化指标",
                    }
                )

        result = {
            "module": self.module_name,
            "module_display_name": self.module_display_name,
            "score": score,
            "priority_score": priority_score,
            "analysis_type": "simple",
            "total_items": total_items,
            "analyzed_items": min(total_items, 3),
            "strengths": [],
            "weaknesses": [],
            "issues": issues,
            "highlights": highlights,
            "details": {"sampled_items": min(total_items, 3)},
        }
        self._analysis_result = result
        return result

    async def optimize(self, resume_data: Dict, issue_id: Optional[str] = None) -> Dict:
        experiences: List[Dict] = resume_data.get("experience", []) or []
        if not experiences:
            return {
                "issue_id": "work-missing",
                "module": self.module_name,
                "current": "无工作经历",
                "optimized": "补充至少一段完整的工作经历（公司、岗位、时间、职责、成果）。",
                "explanation": "工作经历是简历的核心部分，应体现岗位胜任力。",
                "apply_path": "experience",
            }

        target_index = 0
        if issue_id and issue_id.endswith("-"):
            try:
                target_index = int(issue_id.split("-")[-1])
            except (ValueError, IndexError):
                target_index = 0

        target_index = min(max(target_index, 0), len(experiences) - 1)
        target = experiences[target_index]
        current = target.get("details") or target.get("description") or "（空）"
        optimized = (
            "使用 STAR 法则补充：背景、任务、行动、结果，并加入量化指标（如提升 30% 效率）。"
        )

        return {
            "issue_id": issue_id or f"work-missing-detail-{target_index}",
            "module": self.module_name,
            "current": current,
            "optimized": optimized,
            "explanation": "具体成果和量化指标有助于提高可信度。",
            "apply_path": f"experience[{target_index}].details",
        }

    def _empty_analysis(self) -> Dict:
        return {
            "module": self.module_name,
            "module_display_name": self.module_display_name,
            "score": 0,
            "priority_score": 100,
            "analysis_type": "simple",
            "total_items": 0,
            "analyzed_items": 0,
            "strengths": [],
            "weaknesses": [],
            "issues": [
                {
                    "id": "work-missing",
                    "problem": "工作经历为空",
                    "severity": "high",
                    "suggestion": "补充至少一段工作经历",
                }
            ],
            "highlights": [],
            "details": {},
        }
