from backend.agent.agent.module.education_analyzer import EducationAnalyzer
from backend.agent.agent.registry import AgentRegistry


@AgentRegistry.register("education_analyzer_agent")
class EducationAnalyzerAgent(EducationAnalyzer):
    """教育背景专项分析 Agent（复用现有 EducationAnalyzer 模块）"""

    name: str = "EducationAnalyzerAgent"
