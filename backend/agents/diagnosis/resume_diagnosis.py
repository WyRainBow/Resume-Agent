"""
简历诊断器

对简历进行多维度诊断：
1. 完整性（Completeness）
2. 内容质量（Content Quality）
3. 结构与格式（Structure & Format）
4. 匹配度（Relevance）
"""

import re
from typing import Dict, List
from .diagnosis_report import DiagnosisReport, DimensionResult, Issue, IssueLevel, IssueCategory


class ResumeDiagnosis:
    """简历诊断器"""

    def __init__(self):
        # 完整性检查配置
        self.completeness_checks = {
            "basic": ["name", "email", "phone", "headline"],
            "summary": ["content"],
            "experience": ["company", "position", "date", "summary"],
            "projects": ["name", "description", "techStack"],
            "education": ["school", "major", "date"],
            "skills": ["keywords"]
        }

        # 内容质量检查配置
        self.quantifiable_pattern = re.compile(
            r'\d+%|\d+倍|\d+次|提升.*\d+|降低.*\d+|优化.*\d+|节省.*\d+'
        )
        self.vague_words = ["负责", "参与", "熟悉", "了解", "协助"]

    def diagnose(self, resume_data: Dict) -> DiagnosisReport:
        """
        执行完整诊断

        Args:
            resume_data: 简历数据（JSON格式）

        Returns:
            DiagnosisReport: 诊断报告
        """
        # 执行各维度诊断
        completeness_result = self._check_completeness(resume_data)
        quality_result = self._check_content_quality(resume_data)
        structure_result = self._check_structure(resume_data)
        relevance_result = self._check_relevance(resume_data)

        # 汇总维度结果
        dimensions = {
            "completeness": completeness_result,
            "content_quality": quality_result,
            "structure": structure_result,
            "relevance": relevance_result
        }

        # 计算总体分数
        overall_score = self._calculate_overall_score(dimensions)

        # 提取优先级问题
        priority_issues = self._extract_priority_issues(dimensions)

        # 生成优化路径
        optimization_path = self._generate_optimization_path(priority_issues, dimensions)

        # 创建诊断报告
        report = DiagnosisReport(
            overall_score=overall_score,
            dimensions=dimensions,
            priority_issues=priority_issues,
            optimization_path=optimization_path
        )

        return report

    def _check_completeness(self, resume_data: Dict) -> DimensionResult:
        """检查完整性"""
        issues = []
        total_fields = 0
        filled_fields = 0

        # 检查基本信息
        basic = resume_data.get("basic", {})
        for field in self.completeness_checks["basic"]:
            total_fields += 1
            if not basic.get(field):
                issues.append(Issue(
                    level=IssueLevel.CRITICAL if field in ["name", "headline"] else IssueLevel.HIGH,
                    category=IssueCategory.COMPLETENESS,
                    field=f"basic.{field}",
                    description=f"基本信息缺少{field}",
                    suggestion=f"请补充您的{field}信息",
                    severity_score=0.8 if field in ["name", "headline"] else 0.6
                ))
            else:
                filled_fields += 1

        # 检查个人总结
        sections = resume_data.get("sections", {})
        summary = sections.get("summary", {})
        if not summary.get("content"):
            issues.append(Issue(
                level=IssueLevel.CRITICAL,
                category=IssueCategory.COMPLETENESS,
                field="sections.summary.content",
                description="个人总结缺失",
                suggestion="这是HR看简历的第一眼，建议填写个人总结来突出您的核心优势",
                severity_score=0.9
            ))
        else:
            filled_fields += 1
        total_fields += 1

        # 检查工作经历
        experience = sections.get("experience", {}).get("items", [])
        if not experience:
            issues.append(Issue(
                level=IssueLevel.CRITICAL,
                category=IssueCategory.COMPLETENESS,
                field="sections.experience.items",
                description="工作/实习经历空白",
                suggestion="这是展示您能力和经验的核心模块，建议添加您的实习或工作经历",
                severity_score=0.95
            ))
        total_fields += 1

        # 检查项目经历
        projects = sections.get("projects", {}).get("items", [])
        if not projects:
            issues.append(Issue(
                level=IssueLevel.HIGH,
                category=IssueCategory.COMPLETENESS,
                field="sections.projects.items",
                description="项目经历空白",
                suggestion="对于技术岗，项目经历很重要，建议添加您的课程项目、个人项目或竞赛项目",
                severity_score=0.7
            ))
        total_fields += 1

        # 检查教育经历
        education = sections.get("education", {}).get("items", [])
        if not education:
            issues.append(Issue(
                level=IssueLevel.CRITICAL,
                category=IssueCategory.COMPLETENESS,
                field="sections.education.items",
                description="教育经历空白",
                suggestion="请补充您的教育背景",
                severity_score=0.85
            ))
        total_fields += 1

        # 计算完整性分数
        score = filled_fields / total_fields if total_fields > 0 else 0

        return DimensionResult(
            dimension="completeness",
            score=score,
            issues=issues,
            details={"filled_fields": filled_fields, "total_fields": total_fields}
        )

    def _check_content_quality(self, resume_data: Dict) -> DimensionResult:
        """检查内容质量"""
        issues = []

        sections = resume_data.get("sections", {})

        # 检查工作经历的内容质量
        experience_items = sections.get("experience", {}).get("items", [])
        for i, exp in enumerate(experience_items):
            summary = exp.get("summary", "")
            field_path = f"sections.experience.items[{i}].summary"

            # 检查量化数据
            if not self.quantifiable_pattern.search(summary):
                issues.append(Issue(
                    level=IssueLevel.HIGH,
                    category=IssueCategory.QUALITY,
                    field=field_path,
                    description=f"工作经历（{exp.get('company', '')}）缺少量化数据",
                    suggestion="建议添加具体的数字、百分比或成果，如'提升了30%效率'、'处理10万+并发请求'",
                    severity_score=0.7
                ))

            # 检查描述长度
            if len(summary) < 50:
                issues.append(Issue(
                    level=IssueLevel.MEDIUM,
                    category=IssueCategory.QUALITY,
                    field=field_path,
                    description=f"工作经历（{exp.get('company', '')}）描述过于简短",
                    suggestion="建议详细描述您的职责和成果，可以使用STAR法则来组织内容",
                    severity_score=0.5
                ))

            # 检查空泛词汇
            vague_count = sum(1 for word in self.vague_words if word in summary)
            if vague_count > len(summary) / 20:  # 空泛词汇占比过高
                issues.append(Issue(
                    level=IssueLevel.MEDIUM,
                    category=IssueCategory.QUALITY,
                    field=field_path,
                    description=f"工作经历（{exp.get('company', '')}）描述过于空泛",
                    suggestion="建议减少'负责'、'参与'等空泛词汇，改用具体的行动和成果来描述",
                    severity_score=0.4
                ))

        # 检查项目经历的内容质量（类似逻辑）
        project_items = sections.get("projects", {}).get("items", [])
        for i, proj in enumerate(project_items):
            description = proj.get("description", "")
            field_path = f"sections.projects.items[{i}].description"

            if not self.quantifiable_pattern.search(description) and len(description) > 0:
                issues.append(Issue(
                    level=IssueLevel.MEDIUM,
                    category=IssueCategory.QUALITY,
                    field=field_path,
                    description=f"项目经历（{proj.get('name', '')}）缺少量化数据",
                    suggestion="建议添加项目成果的具体数据，如'用户增长50%'、'性能提升3倍'",
                    severity_score=0.6
                ))

        # 计算质量分数（简化版）
        total_checks = len(experience_items) * 3 + len(project_items)
        failed_checks = len(issues)
        score = 1.0 - (failed_checks / max(total_checks, 1))

        return DimensionResult(
            dimension="content_quality",
            score=max(0, score),
            issues=issues,
            details={"experience_count": len(experience_items), "project_count": len(project_items)}
        )

    def _check_structure(self, resume_data: Dict) -> DimensionResult:
        """检查结构与格式"""
        issues = []

        sections = resume_data.get("sections", {})

        # 检查时间线一致性（简化版）
        experience_items = sections.get("experience", {}).get("items", [])
        for i in range(len(experience_items) - 1):
            current_exp = experience_items[i]
            next_exp = experience_items[i + 1]

            # 这里可以添加更复杂的时间线重叠检测逻辑
            # 暂时跳过，因为需要解析日期格式

        # 检查个人总结长度
        summary_content = sections.get("summary", {}).get("content", "")
        if len(summary_content) > 0 and len(summary_content) < 100:
            issues.append(Issue(
                level=IssueLevel.MEDIUM,
                category=IssueCategory.STRUCTURE,
                field="sections.summary.content",
                description="个人总结过短",
                suggestion="建议个人总结至少100字，充分展示您的核心优势和职业目标",
                severity_score=0.5
            ))

        # 计算结构分数
        score = 1.0 - (len(issues) / max(len(issues) + 1, 1))

        return DimensionResult(
            dimension="structure",
            score=score,
            issues=issues,
            details={}
        )

    def _check_relevance(self, resume_data: Dict) -> DimensionResult:
        """检查匹配度"""
        issues = []

        # 获取目标岗位
        headline = resume_data.get("basic", {}).get("headline", "")

        if not headline:
            issues.append(Issue(
                level=IssueLevel.HIGH,
                category=IssueCategory.QUALITY,
                field="basic.headline",
                description="缺少目标岗位",
                suggestion="建议填写您的目标岗位，以便我们能更好地优化简历内容",
                severity_score=0.6
            ))
            return DimensionResult(
                dimension="relevance",
                score=0.5,
                issues=issues,
                details={}
            )

        # 这里可以添加更复杂的匹配度检查逻辑
        # 例如：检查技能是否与目标岗位匹配
        # 暂时返回默认分数

        return DimensionResult(
            dimension="relevance",
            score=0.7,  # 默认分数
            issues=issues,
            details={"target_position": headline}
        )

    def _calculate_overall_score(self, dimensions: Dict[str, DimensionResult]) -> float:
        """计算总体分数"""
        # 加权平均
        weights = {
            "completeness": 0.4,
            "content_quality": 0.3,
            "structure": 0.2,
            "relevance": 0.1
        }

        total_score = 0.0
        for name, result in dimensions.items():
            total_score += result.score * weights.get(name, 0.25)

        return round(total_score, 2)

    def _extract_priority_issues(self, dimensions: Dict[str, DimensionResult]) -> List[Issue]:
        """提取优先级问题（top 5）"""
        all_issues = []

        for result in dimensions.values():
            all_issues.extend(result.issues)

        # 按严重程度排序
        all_issues.sort(key=lambda x: x.severity_score, reverse=True)

        return all_issues[:5]

    def _generate_optimization_path(self, priority_issues: List[Issue], dimensions: Dict[str, DimensionResult]) -> List[str]:
        """生成优化路径"""
        path = []

        # 根据优先级问题生成优化步骤
        for issue in priority_issues:
            if issue.category == IssueCategory.COMPLETENESS:
                path.append(f"完善{issue.description}")
            elif issue.category == IssueCategory.QUALITY:
                path.append(f"优化{issue.description}")
            elif issue.category == IssueCategory.STRUCTURE:
                path.append(f"调整{issue.description}")
            else:
                path.append(issue.suggestion[:20] + "...")

        # 添加通用的优化建议
        if len(path) < 4:
            path.extend([
                "检查并完善时间线",
                "优化技能关键词",
                "检查排版和格式"
            ])

        return path[:6]  # 最多返回6步
