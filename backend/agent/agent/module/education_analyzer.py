"""
教育经历分析器

专门负责分析简历中的教育背景信息。
"""

import json
from typing import Any, Dict, List, Optional

from pydantic import Field

from backend.agent.agent.module.base_module_analyzer import BaseModuleAnalyzer
from backend.agent.llm import LLM
from backend.agent.prompt.module.education_prompt import (
    EDUCATION_ANALYSIS_PROMPT,
    EDUCATION_OPTIMIZATION_PROMPT,
    EDUCATION_SYSTEM_PROMPT,
    analyze_course_coverage,
    assess_gpa_level,
    detect_institution_level,
    match_major_with_backend,
)
from backend.agent.schema import Message
from backend.agent.tool import ToolCollection, Terminate
from backend.agent.tool.cv_reader_tool import ReadCVContext


class EducationAnalyzer(BaseModuleAnalyzer):
    """教育经历分析器

    分析简历中的教育背景信息，包括：
    - 院校层次与知名度
    - 专业匹配度
    - 学术表现（GPA、排名）
    - 主修课程覆盖度
    - 荣誉奖项含金量

    评分维度：
    - 专业匹配 (30分)
    - 课程匹配 (30分)
    - 学术表现 (30分)
    - 荣誉奖项 (10分)
    """

    name: str = "EducationAnalyzer"
    module_name: str = "education"
    module_display_name: str = "教育经历"

    system_prompt: str = EDUCATION_SYSTEM_PROMPT

    # 可用工具
    available_tools: ToolCollection = Field(
        default_factory=lambda: ToolCollection(
            ReadCVContext(),
            Terminate(),
        )
    )

    # 目标岗位（影响评分权重）
    _target_position: str = "后端开发工程师"

    # 当前分析结果
    _analysis_result: Optional[Dict] = None

    class Config:
        arbitrary_types_allowed = True
        extra = "allow"

    def set_target_position(self, position: str) -> None:
        """设置目标岗位

        Args:
            position: 目标岗位名称
        """
        self._target_position = position

    async def analyze(self, resume_data: Dict) -> Dict:
        """分析教育经历

        Args:
            resume_data: 简历数据字典

        Returns:
            分析结果 JSON
        """
        education_list = resume_data.get("education", [])

        if not education_list:
            return self._empty_analysis()

        total_items = len(education_list)
        analyzed_items = 0

        # 初始化结果结构
        result = {
            "module": self.module_name,
            "module_display_name": self.module_display_name,
            "score": 0,
            "priority_score": 0,
            "total_items": total_items,
            "analyzed_items": 0,
            "strengths": [],
            "weaknesses": [],
            "issues": [],
            "highlights": [],
            "details": {},
        }

        # 分析每一段教育经历（通常取最高学历）
        main_education = self._get_highest_degree(education_list)
        analyzed_items = 1

        # 1. 院校分析
        institution_info = self._analyze_institution(main_education)

        # 2. 学历和专业分析
        degree_info = self._analyze_degree(main_education)

        # 3. GPA 分析
        gpa_info = self._analyze_gpa(main_education)

        # 4. 课程分析
        course_info = self._analyze_courses(main_education)

        # 5. 荣誉奖项分析
        honors_info = self._analyze_honors(main_education)

        # 6. 汇总亮点和问题
        strengths, weaknesses, issues = self._summarize_findings(
            institution_info, degree_info, gpa_info, course_info, honors_info
        )

        # 7. 计算总分
        score = self._calculate_score(
            degree_info, course_info, gpa_info, honors_info
        )

        # 8. 计算优先级分数
        priority_score = self._calculate_priority_score(score, issues)

        result.update(
            {
                "analyzed_items": analyzed_items,
                "score": score,
                "priority_score": priority_score,
                "strengths": strengths,
                "weaknesses": weaknesses,
                "issues": issues,
                "highlights": [s["item"] for s in strengths],
                "details": {
                    "institution": institution_info,
                    "degree": degree_info,
                    "gpa": gpa_info,
                    "courses": course_info,
                    "honors": honors_info,
                },
            }
        )

        self._analysis_result = result
        return result

    def _empty_analysis(self) -> Dict:
        """返回空教育经历的分析结果"""
        return {
            "module": self.module_name,
            "module_display_name": self.module_display_name,
            "score": 0,
            "priority_score": 100,  # 高优先级：需要补充
            "total_items": 0,
            "analyzed_items": 0,
            "strengths": [],
            "weaknesses": [],
            "issues": [
                {
                    "id": "edu-missing",
                    "problem": "教育经历为空",
                    "severity": "high",
                    "suggestion": "请添加教育经历，包括院校、专业、学历等信息",
                }
            ],
            "highlights": [],
            "details": {},
        }

    def _get_highest_degree(self, education_list: List[Dict]) -> Dict:
        """获取最高学历的教育经历

        优先级：博士 > 硕士 > 本科 > 专科
        """
        if not education_list:
            return {}

        degree_priority = {"博士": 4, "硕士": 3, "本科": 2, "专科": 1}

        # 按学历排序，返回最高学历
        sorted_edu = sorted(
            education_list,
            key=lambda x: degree_priority.get(
                self._extract_degree_type(x.get("degree", "")), 0
            ),
            reverse=True,
        )

        return sorted_edu[0]

    def _extract_degree_type(self, degree: str) -> str:
        """提取学历类型"""
        if "博士" in degree:
            return "博士"
        elif "硕士" in degree or "研究生" in degree:
            return "硕士"
        elif "本科" in degree or "学士" in degree:
            return "本科"
        elif "专科" in degree or "大专" in degree:
            return "专科"
        return ""

    def _analyze_institution(self, education: Dict) -> Dict:
        """分析院校信息"""
        name = education.get("school", "")
        level = detect_institution_level(name)

        # 计算匹配分数
        level_scores = {
            "985": 95,
            "211": 85,
            "双一流": 80,
            "普通本科": 60,
            "专科": 30,
            "未知": 50,
        }
        match_score = level_scores.get(level, 50)

        return {
            "name": name,
            "level": level,
            "match_score": match_score,
        }

    def _analyze_degree(self, education: Dict) -> Dict:
        """分析学历和专业"""
        degree = education.get("degree", "")
        major = education.get("major", "")

        degree_type = self._extract_degree_type(degree)
        match_score = match_major_with_backend(major)

        return {
            "type": degree_type or "未知",
            "major": major,
            "match_score": match_score,
        }

    def _analyze_gpa(self, education: Dict) -> Dict:
        """分析 GPA"""
        # 尝试从不同字段获取 GPA
        gpa = education.get("gpa") or education.get("GPA")
        ranking = education.get("ranking") or education.get("rank")

        # 解析 GPA
        gpa_value = None
        gpa_scale = "4.0"

        if gpa:
            if isinstance(gpa, (int, float)):
                gpa_value = float(gpa)
            elif isinstance(gpa, str):
                # 解析格式如 "3.6/4.0" 或 "3.6"
                if "/" in gpa:
                    parts = gpa.split("/")
                    try:
                        gpa_value = float(parts[0])
                        gpa_scale = parts[1].strip()
                    except ValueError:
                        pass
                else:
                    try:
                        gpa_value = float(gpa)
                    except ValueError:
                        pass

        assessment = assess_gpa_level(gpa_value, float(gpa_scale.split("/")[0]) if "/" in gpa_scale else 4.0)

        return {
            "value": gpa_value,
            "scale": gpa_scale,
            "ranking": ranking or None,
            "assessment": assessment,
        }

    def _analyze_courses(self, education: Dict) -> Dict:
        """分析主修课程"""
        courses = education.get("courses", [])

        if isinstance(courses, str):
            # 如果是字符串，尝试分割
            courses = [c.strip() for c in courses.split(",")]

        return analyze_course_coverage(courses)

    def _analyze_honors(self, education: Dict) -> Dict:
        """分析荣誉奖项"""
        honors = education.get("honors") or education.get("awards", [])

        if isinstance(honors, str):
            honors = [honors]

        scholarships = []
        awards = []

        for honor in honors:
            honor_lower = honor.lower()
            if "奖学金" in honor or "scholarship" in honor_lower:
                scholarships.append(honor)
            else:
                awards.append(honor)

        # 评估荣誉丰富度
        total_count = len(scholarships) + len(awards)
        if total_count >= 5:
            assessment = "荣誉丰富"
        elif total_count >= 2:
            assessment = "有一定荣誉"
        elif total_count >= 1:
            assessment = "有基本荣誉"
        else:
            assessment = "无荣誉信息"

        return {
            "scholarships": scholarships,
            "awards": awards,
            "count": total_count,
            "assessment": assessment,
        }

    def _summarize_findings(
        self, institution_info: Dict, degree_info: Dict, gpa_info: Dict,
        course_info: Dict, honors_info: Dict
    ) -> tuple[List[Dict], List[Dict], List[Dict]]:
        """汇总亮点和问题"""
        strengths = []
        weaknesses = []
        issues = []

        # 1. 专业匹配度
        if degree_info["match_score"] >= 80:
            strengths.append(
                self._create_strength(
                    item="专业匹配度高",
                    description=f"【{degree_info['major']}】与目标岗位高度相关",
                    evidence=f"{degree_info['major']}"
                )
            )
        elif degree_info["match_score"] < 60:
            weaknesses.append(
                self._create_weakness(
                    item="专业匹配度一般",
                    description=f"【{degree_info['major']}】与后端开发相关性一般",
                    suggestion="通过项目经历和技能证书来弥补专业差距"
                )
            )

        # 2. 院校层次
        if institution_info["level"] in ["985", "211"]:
            strengths.append(
                self._create_strength(
                    item="院校背景优秀",
                    description=f"【{institution_info['name']}】属于{institution_info['level']}院校",
                    evidence=institution_info["name"]
                )
            )

        # 3. GPA
        if gpa_info["value"] is None:
            issues.append(
                self._create_issue(
                    issue_id="edu-gpa",
                    problem="缺少 GPA/排名信息",
                    severity="medium",
                    suggestion="建议补充 GPA 或专业排名信息"
                )
            )
        elif gpa_info["assessment"] == "优秀":
            strengths.append(
                self._create_strength(
                    item="学术表现优秀",
                    description=f"GPA {gpa_info['value']}/{gpa_info['scale']}{', ' + gpa_info['ranking'] if gpa_info['ranking'] else ''}",
                    evidence=f"GPA: {gpa_info['value']}"
                )
            )

        # 4. 课程覆盖
        if course_info["match_score"] >= 70:
            strengths.append(
                self._create_strength(
                    item="核心课程完整",
                    description=f"覆盖 {len(course_info['core_courses'])} 门核心课程",
                    evidence=", ".join(course_info["core_courses"][:3])
                )
            )
        else:
            weaknesses.append(
                self._create_weakness(
                    item="核心课程不足",
                    description=f"仅覆盖 {len(course_info['core_courses'])} 门核心课程",
                    suggestion="通过项目经历体现相关技能"
                )
            )

        if course_info["missing_courses"]:
            issues.append(
                self._create_issue(
                    issue_id="edu-courses",
                    problem=f"缺少重要课程：{', '.join(course_info['missing_courses'][:3])}",
                    severity="low",
                    suggestion="可以通过在线课程或项目经验来补充相关技能"
                )
            )

        # 5. 荣誉奖项
        if honors_info["count"] == 0:
            issues.append(
                self._create_issue(
                    issue_id="edu-honors",
                    problem="缺少荣誉奖项信息",
                    severity="low",
                    suggestion="如有奖学金或竞赛奖项，建议补充"
                )
            )
        elif honors_info["count"] >= 3:
            strengths.append(
                self._create_strength(
                    item="荣誉奖项丰富",
                    description=f"有 {honors_info['count']} 项荣誉",
                    evidence=", ".join(honors_info["scholarships"][:2])
                )
            )

        return strengths, weaknesses, issues

    def _calculate_score(
        self, degree_info: Dict, course_info: Dict,
        gpa_info: Dict, honors_info: Dict
    ) -> int:
        """计算总分"""
        score = 0

        # 1. 专业匹配 (30分)
        score += int(degree_info["match_score"] * 0.3)

        # 2. 课程匹配 (30分)
        score += int(course_info["match_score"] * 0.3)

        # 3. 学术表现 (30分)
        if gpa_info["value"] is not None:
            gpa_scores = {"优秀": 30, "良好": 20, "一般": 10, "较差": 5}
            score += gpa_scores.get(gpa_info["assessment"], 10)

            # 排名加分
            if gpa_info["ranking"]:
                if "前10%" in gpa_info["ranking"] or "top10%" in gpa_info["ranking"].lower():
                    score += 10
                elif "前20%" in gpa_info["ranking"] or "top20%" in gpa_info["ranking"].lower():
                    score += 5

        # 4. 荣誉奖项 (10分)
        honors_scores = {
            "荣誉丰富": 10,
            "有一定荣誉": 7,
            "有基本荣誉": 4,
            "无荣誉信息": 0,
        }
        score += honors_scores.get(honors_info["assessment"], 0)

        return min(score, 100)

    async def optimize(self, resume_data: Dict, issue_id: Optional[str] = None) -> Dict:
        """生成优化建议和示例

        Args:
            resume_data: 简历数据
            issue_id: 要优化的问题 ID
        """
        if not self._analysis_result:
            await self.analyze(resume_data)

        issues = self._analysis_result.get("issues", [])
        if not issues:
            return {
                "issue_id": "none",
                "module": self.module_name,
                "current": "",
                "optimized": "",
                "explanation": "没有需要优化的问题",
            }

        # 找到目标问题
        target_issue = None
        if issue_id:
            for issue in issues:
                if issue.get("id") == issue_id:
                    target_issue = issue
                    break
        else:
            target_issue = issues[0]

        if not target_issue:
            return {
                "issue_id": "not_found",
                "module": self.module_name,
                "current": "",
                "optimized": "",
                "explanation": f"未找到问题 ID: {issue_id}",
            }

        # 根据问题类型生成优化建议
        problem = target_issue.get("problem", "")

        if "GPA" in problem or "排名" in problem:
            return self._optimize_gpa(resume_data)
        elif "课程" in problem:
            return self._optimize_courses(resume_data)
        elif "荣誉" in problem:
            return self._optimize_honors(resume_data)
        else:
            return self._general_optimization(resume_data, target_issue)

    def _optimize_gpa(self, resume_data: Dict) -> Dict:
        """GPA 优化建议"""
        education = resume_data.get("education", [])
        if not education:
            return {"error": "无教育经历"}

        main_edu = self._get_highest_degree(education)
        current_gpa = main_edu.get("gpa") or main_edu.get("GPA", "")
        current_ranking = main_edu.get("ranking") or main_edu.get("rank", "")

        # 构建当前内容描述
        if current_gpa:
            current_text = f"GPA: {current_gpa}"
            if current_ranking:
                current_text += f" | 排名: {current_ranking}"
        elif current_ranking:
            current_text = f"专业排名: {current_ranking}"
        else:
            current_text = "未填写"

        # 优化示例
        optimized_text = "GPA: 3.6/4.0 (专业排名前15%)"

        return {
            "issue_id": "edu-gpa",
            "module": self.module_name,
            "current": current_text,
            "optimized": optimized_text + "  # 请替换为你的实际数据",
            "explanation": "补充 GPA 和专业排名信息，可以更好地展示你的学术能力。如果 GPA 不高，可以只写排名。",
            "apply_path": "education[0].gpa",
            "placeholder_fields": ["GPA数值", "专业排名"],
            "examples": [
                "GPA: 3.6/4.0 (专业排名前15%)",
                "GPA: 3.8/4.0",
                "专业排名: 前10%",
                "GPA: 3.9/4.0 (专业排名前3%) - 国家奖学金获得者",
            ],
            "before_after": {
                "before": current_text,
                "after": "GPA: 3.6/4.0 (专业排名前15%)"
            }
        }

    def _optimize_courses(self, resume_data: Dict) -> Dict:
        """课程优化建议"""
        education = resume_data.get("education", [])
        if not education:
            return {"error": "无教育经历"}

        main_edu = self._get_highest_degree(education)
        current_courses = main_edu.get("courses", [])

        # 构建当前内容描述
        if current_courses:
            if isinstance(current_courses, list):
                current_text = "、".join(current_courses[:5]) + ("..." if len(current_courses) > 5 else "")
            else:
                current_text = str(current_courses)
        else:
            current_text = "未填写"

        # 推荐的后端核心课程
        recommended_courses = [
            "数据结构与算法",
            "操作系统",
            "计算机网络",
            "数据库原理",
            "软件工程",
        ]

        optimized_text = "数据结构与算法、操作系统、计算机网络、数据库原理、Java程序设计、Web开发技术"

        return {
            "issue_id": "edu-courses",
            "module": self.module_name,
            "current": current_text,
            "optimized": optimized_text,
            "explanation": "列出与后端开发相关的核心课程，展示你的专业基础。建议选择 5-8 门成绩较好的课程。",
            "apply_path": "education[0].courses",
            "placeholder_fields": [],
            "recommended_courses": recommended_courses,
            "before_after": {
                "before": current_text,
                "after": optimized_text
            },
            "tips": [
                "优先列出与目标岗位相关的核心课程",
                "按课程重要性排序，核心课程放前面",
                "如果课程太多，只列出成绩较好的 5-8 门",
                "可以包含实践类课程，如项目实战、课程设计等"
            ]
        }

    def _optimize_honors(self, resume_data: Dict) -> Dict:
        """荣誉奖项优化建议"""
        education = resume_data.get("education", [])
        current_text = "未填写"
        current_honors = []

        if education:
            main_edu = self._get_highest_degree(education)
            honors = main_edu.get("honors") or main_edu.get("awards", [])
            if honors:
                current_honors = honors if isinstance(honors, list) else [honors]
                current_text = "、".join(str(h) for h in current_honors[:3])

        optimized_text = "国家奖学金 (2023)、校级一等奖学金 (2022, 2023)、ACM程序设计竞赛省级二等奖、优秀学生干部"

        return {
            "issue_id": "edu-honors",
            "module": self.module_name,
            "current": current_text,
            "optimized": optimized_text,
            "explanation": "补充奖学金和竞赛奖项，可以展示你的学术能力和综合素质。按时间倒序排列，突出最高级别的荣誉。",
            "apply_path": "education[0].honors",
            "placeholder_fields": ["奖学金名称", "竞赛奖项"],
            "examples": [
                "国家奖学金 (2023)",
                "校级一等奖学金 (2022, 2023)",
                "优秀学生干部",
                "ACM程序设计竞赛省级二等奖",
                "全国大学生数学建模竞赛一等奖",
            ],
            "before_after": {
                "before": current_text,
                "after": optimized_text
            },
            "tips": [
                "按含金量排序：国家级 > 省级 > 校级",
                "奖学金优先，竞赛奖项次之",
                "可以标注时间，如 (2022, 2023) 表示多次获得",
                "如果没有奖学金，可以写项目经历或实习评价"
            ]
        }

    def _general_optimization(self, resume_data: Dict, issue: Dict) -> Dict:
        """通用优化建议"""
        return {
            "issue_id": issue.get("id", "unknown"),
            "module": self.module_name,
            "current": "需要优化",
            "optimized": "优化后的内容",
            "explanation": issue.get("suggestion", "请根据建议进行优化"),
        }

    def format_analysis_as_markdown(self, analysis: Dict) -> str:
        """格式化为教育经历分析报告"""
        lines = []

        # 标题
        lines.append("## 📚 教育经历分析")
        lines.append("")

        # 整体评分
        score = analysis.get("score", 0)
        score_emoji = "✅" if score >= 80 else "⚠️" if score >= 60 else "❌"
        lines.append(f"**综合评分**: {score}/100 {score_emoji}")
        lines.append("")

        # 详细信息
        details = analysis.get("details", {})

        # 院校信息
        institution = details.get("institution", {})
        if institution:
            level_emoji = {"985": "🌟", "211": "⭐", "双一流": "✨"}.get(
                institution.get("level", ""), "📖"
            )
            lines.append(f"**院校信息**")
            lines.append(f"- 院校: {institution.get('name', 'N/A')}")
            lines.append(f"- 层次: {level_emoji} {institution.get('level', 'N/A')}")
            lines.append("")

        # 学历专业
        degree = details.get("degree", {})
        if degree:
            lines.append(f"**学历专业**")
            lines.append(f"- 学历: {degree.get('type', 'N/A')}")
            lines.append(f"- 专业: {degree.get('major', 'N/A')}")
            match_score = degree.get("match_score", 0)
            match_emoji = "✅" if match_score >= 80 else "⚠️" if match_score >= 60 else "❌"
            lines.append(f"- 匹配度: {match_score}/100 {match_emoji}")
            lines.append("")

        # GPA
        gpa = details.get("gpa", {})
        if gpa:
            lines.append(f"**学术表现**")
            gpa_value = gpa.get("value")
            if gpa_value:
                lines.append(f"- GPA: {gpa_value}/{gpa.get('scale', '4.0')}")
            if gpa.get("ranking"):
                lines.append(f"- 排名: {gpa.get('ranking')}")
            lines.append(f"- 评估: {gpa.get('assessment', 'N/A')}")
            lines.append("")

        # 课程
        courses = details.get("courses", {})
        if courses:
            lines.append(f"**课程分析**")
            core_courses = courses.get("core_courses", [])
            if core_courses:
                lines.append(f"- 已覆盖核心课程: {', '.join(core_courses[:4])}")
            missing = courses.get("missing_courses", [])
            if missing:
                lines.append(f"- 建议补充: {', '.join(missing[:3])}")
            lines.append("")

        # 荣誉
        honors = details.get("honors", {})
        if honors and honors.get("count", 0) > 0:
            lines.append(f"**荣誉奖项**")
            scholarships = honors.get("scholarships", [])
            if scholarships:
                lines.append(f"- 奖学金: {', '.join(scholarships)}")
            awards = honors.get("awards", [])
            if awards:
                lines.append(f"- 其他奖项: {', '.join(awards[:3])}")
            lines.append("")

        # 亮点
        strengths = analysis.get("strengths", [])
        if strengths:
            lines.append("**✨ 优势**")
            for s in strengths:
                lines.append(f"- {s.get('item')}: {s.get('description')}")
            lines.append("")

        # 问题
        issues = analysis.get("issues", [])
        if issues:
            high_issues = [i for i in issues if i.get("severity") == "high"]
            medium_issues = [i for i in issues if i.get("severity") == "medium"]
            low_issues = [i for i in issues if i.get("severity") == "low"]

            if high_issues:
                lines.append("**🔴 高优先级问题**")
                for i in high_issues:
                    lines.append(f"- {i.get('problem')}")
                    lines.append(f"  💡 {i.get('suggestion')}")
                lines.append("")

            if medium_issues:
                lines.append("**🟡 中优先级问题**")
                for i in medium_issues:
                    lines.append(f"- {i.get('problem')}")
                    lines.append(f"  💡 {i.get('suggestion')}")
                lines.append("")

            if low_issues:
                lines.append("**🟢 低优先级问题**")
                for i in low_issues:
                    lines.append(f"- {i.get('problem')}")
                lines.append("")

        return "\n".join(lines)

    async def _get_education_optimization_suggestions(self, resume_data: Dict, analysis_result: Dict) -> List[Dict]:
        """获取所有优化建议列表（供 editor 工具使用）

        Args:
            resume_data: 简历数据
            analysis_result: 分析结果

        Returns:
            优化建议列表，每个建议包含 title, current, optimized, explanation, apply_path
        """
        suggestions = []
        issues = analysis_result.get("issues", [])

        # 获取教育经历
        education = resume_data.get("education", [])
        if not education:
            return suggestions

        main_edu = self._get_highest_degree(education)

        # 遍历所有问题，为每个问题生成优化建议
        for issue in issues:
            problem = issue.get("problem", "")

            if "GPA" in problem or "排名" in problem:
                suggestion = self._optimize_gpa(resume_data)
                suggestion["title"] = "补充 GPA/排名信息"
                suggestions.append(suggestion)

            elif "课程" in problem:
                suggestion = self._optimize_courses(resume_data)
                suggestion["title"] = "优化主修课程列表"
                suggestions.append(suggestion)

            elif "荣誉" in problem:
                suggestion = self._optimize_honors(resume_data)
                suggestion["title"] = "补充荣誉奖项信息"
                suggestions.append(suggestion)

        # 如果没有问题，返回通用建议
        if not suggestions:
            suggestions.append({
                "title": "教育背景已完善",
                "current": "当前教育背景信息完整",
                "optimized": "继续保持，可以添加更多细节",
                "explanation": "您的教育背景信息已经比较完整，可以考虑添加更多细节来增强竞争力。",
                "apply_path": "education[0]"
            })

        return suggestions
