"""
诊断报告数据结构
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum


class IssueLevel(str, Enum):
    """问题严重程度"""
    CRITICAL = "critical"  # 关键问题，必须立即处理
    HIGH = "high"  # 高优先级
    MEDIUM = "medium"  # 中优先级
    LOW = "low"  # 低优先级


class IssueCategory(str, Enum):
    """问题类别"""
    CONTENT = "content"  # 内容问题
    STRUCTURE = "structure"  # 结构问题
    FORMAT = "format"  # 格式问题
    COMPLETENESS = "completeness"  # 完整性问题
    QUALITY = "quality"  # 质量问题


@dataclass
class Issue:
    """问题"""
    level: IssueLevel
    category: IssueCategory
    field: str  # 字段路径
    description: str  # 问题描述
    suggestion: str  # 改进建议
    severity_score: float = 0.0  # 严重程度分数 0-1


@dataclass
class DimensionResult:
    """维度诊断结果"""
    dimension: str  # 维度名称
    score: float  # 分数 0-1
    issues: List[Issue] = field(default_factory=list)
    details: Dict = field(default_factory=dict)  # 详细信息

    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            "dimension": self.dimension,
            "score": self.score,
            "issues": [
                {
                    "level": issue.level.value,
                    "category": issue.category.value,
                    "field": issue.field,
                    "description": issue.description,
                    "suggestion": issue.suggestion,
                    "severity_score": issue.severity_score
                }
                for issue in self.issues
            ],
            "details": self.details
        }


@dataclass
class DiagnosisReport:
    """诊断报告"""

    overall_score: float  # 总体分数 0-1
    dimensions: Dict[str, DimensionResult]  # 各维度结果
    priority_issues: List[Issue]  # 优先级问题列表（top 3-5）
    optimization_path: List[str]  # 优化路径建议
    diagnosis_level: str = ""  # 诊断级别：excellent, good, needs_improvement, needs_major_improvement

    def __post_init__(self):
        """计算诊断级别"""
        if self.overall_score >= 0.8:
            self.diagnosis_level = "excellent"
        elif self.overall_score >= 0.6:
            self.diagnosis_level = "good"
        elif self.overall_score >= 0.4:
            self.diagnosis_level = "needs_improvement"
        else:
            self.diagnosis_level = "needs_major_improvement"

    def to_message(self) -> str:
        """转换为用户友好的消息"""
        # 根据诊断级别生成不同的消息
        if self.diagnosis_level == "excellent":
            intro = "太棒了！您的简历整体非常完善。"
        elif self.diagnosis_level == "good":
            intro = "您的简历整体不错，还有一些提升空间。"
        elif self.diagnosis_level == "needs_improvement":
            intro = "您的简历需要一些优化，我帮您找出了几个关键问题。"
        else:
            intro = "坦白说，这份简历还比较\"骨感\"，我们需要一起把它充实起来！"

        # 列出优先级问题
        issues_section = "\n\n**发现的主要问题：**\n\n"
        for i, issue in enumerate(self.priority_issues[:5], 1):
            emoji = self._get_issue_emoji(issue.level)
            issues_section += f"{i}. {emoji} **{issue.description}**\n"
            issues_section += f"   - {issue.suggestion}\n\n"

        # 优化路径
        path_section = "\n**建议的优化路径：**\n\n"
        for i, step in enumerate(self.optimization_path, 1):
            path_section += f"{i}. {step}\n"

        return intro + issues_section + path_section

    def _get_issue_emoji(self, level: IssueLevel) -> str:
        """获取问题级别的 emoji"""
        emoji_map = {
            IssueLevel.CRITICAL: "❌",
            IssueLevel.HIGH: "⚠️",
            IssueLevel.MEDIUM: "💡",
            IssueLevel.LOW: "ℹ️"
        }
        return emoji_map.get(level, "•")

    def to_guidance_choices(self) -> List[Dict]:
        """生成引导选项"""
        choices = []
        for issue in self.priority_issues[:3]:
            choices.append({
                "id": f"optimize_{issue.field}",
                "text": issue.description,
                "priority": issue.level.value,
                "reason": issue.suggestion
            })
        return choices

    def to_dict(self) -> Dict:
        """转换为字典（用于调试和日志）"""
        return {
            "overall_score": self.overall_score,
            "diagnosis_level": self.diagnosis_level,
            "dimensions": {
                name: result.to_dict()
                for name, result in self.dimensions.items()
            },
            "priority_issues": [
                {
                    "level": issue.level.value,
                    "category": issue.category.value,
                    "field": issue.field,
                    "description": issue.description,
                    "suggestion": issue.suggestion,
                    "severity_score": issue.severity_score
                }
                for issue in self.priority_issues
            ],
            "optimization_path": self.optimization_path
        }
