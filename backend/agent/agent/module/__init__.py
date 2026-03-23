"""
模块分析器 - 简历各模块独立分析器

每个模块分析器负责分析简历的一个特定部分：
- EducationAnalyzer: 教育经历分析
- WorkAnalyzer: 工作经历分析
- InternshipAnalyzer: 实习经历分析
- SkillsAnalyzer: 专业技能分析
- SummaryAnalyzer: 个人总结分析
- OpenSourceAnalyzer: 开源经历分析
"""

from backend.agent.agent.module.base_module_analyzer import BaseModuleAnalyzer
from backend.agent.agent.module.education_analyzer import EducationAnalyzer

__all__ = [
    "BaseModuleAnalyzer",
    "EducationAnalyzer",
]
