"""
简历诊断引导系统

核心组件：
- ResumeDiagnosis: 简历诊断器
- DiagnosisReport: 诊断报告
- GuidanceEngine: 引导策略引擎
- FollowUpSystem: 渐进式追问系统
"""

from .resume_diagnosis import ResumeDiagnosis
from .diagnosis_report import DiagnosisReport, DimensionResult, Issue
from .guidance_engine import GuidanceEngine
from .followup_system import FollowUpSystem

__all__ = [
    "ResumeDiagnosis",
    "DiagnosisReport",
    "DimensionResult",
    "Issue",
    "GuidanceEngine",
    "FollowUpSystem"
]
