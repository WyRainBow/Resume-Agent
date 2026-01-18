from typing import Dict, List, Optional

from backend.agent.agent.registry import AgentRegistry
from backend.agent.agent.utils.path_generator import PathGenerator


@AgentRegistry.register("resume_optimizer")
class ResumeOptimizerAgent:
    """简历优化建议 Agent（聚合分析结果生成优化建议）"""

    name: str = "ResumeOptimizerAgent"

    def generate_suggestions(
        self,
        analysis_results: List[Dict],
        resume_data: Optional[Dict] = None,
    ) -> List[Dict]:
        suggestions: List[Dict] = []

        for result in analysis_results:
            # 优先使用已有优化建议
            if result.get("optimization_suggestions"):
                for suggestion in result["optimization_suggestions"]:
                    if resume_data and not suggestion.get("apply_path"):
                        module = result.get("module")
                        apply_path = PathGenerator.generate_path(module, suggestion, resume_data)
                        if apply_path and PathGenerator.validate_path(apply_path, resume_data):
                            suggestion["apply_path"] = apply_path
                    suggestions.append(suggestion)
                continue

            issues = result.get("issues") or []
            for issue in issues[:3]:
                apply_path = issue.get("apply_path")
                if resume_data and not apply_path:
                    module = result.get("module")
                    apply_path = PathGenerator.generate_path(module, issue, resume_data)
                    if apply_path and not PathGenerator.validate_path(apply_path, resume_data):
                        apply_path = None

                suggestions.append(
                    {
                        "title": issue.get("problem", "优化建议"),
                        "current": issue.get("current", ""),
                        "optimized": issue.get("suggestion", ""),
                        "explanation": issue.get("suggestion", ""),
                        "apply_path": apply_path,
                        "source_module": result.get("module"),
                    }
                )

        return suggestions

    def optimize(self, analysis_results: List[Dict], resume_data: Optional[Dict] = None) -> Dict:
        suggestions = self.generate_suggestions(analysis_results, resume_data=resume_data)
        return {
            "optimization_suggestions": suggestions,
            "total": len(suggestions),
        }
