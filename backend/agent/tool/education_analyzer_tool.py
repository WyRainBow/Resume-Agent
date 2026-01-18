"""
教育经历分析工具

将 EducationAnalyzer 包装成 Manus 可调用的工具。
只负责分析教育背景并提供优化建议示例，不直接修改简历。
"""

import json
from typing import Optional

from backend.agent.tool.base import BaseTool, ToolResult
from backend.agent.tool.resume_data_store import ResumeDataStore


class EducationAnalyzerTool(BaseTool):
    """教育经历分析工具

    【注意】本工具仅负责简历中「教育经历」模块的分析，不涉及其他模块。

    分析范围：
    - 院校层次与知名度
    - 专业匹配度
    - 学术表现（GPA、排名）
    - 主修课程覆盖度
    - 荣誉奖项含金量

    输出内容：
    1. 分析结果（评分、问题、亮点）
    2. 优化建议示例（供 editor 工具使用）
    3. 不直接修改简历，修改由 editor 工具完成

    不负责：
    - 工作经历分析（使用 work_analyzer）
    - 实习经历分析（使用 internship_analyzer）
    - 专业技能分析（使用 skills_analyzer）
    - 直接修改简历（使用 editor 工具）
    """

    name: str = "education_analyzer"
    description: str = """Analyze the EDUCATION section of a resume.

【Scope】This tool ONLY analyzes education background:
- University/School level and reputation
- Major relevance to target position
- Academic performance (GPA, ranking)
- Core courses coverage
- Honors and awards

【NOT responsible for】
- Work experience (use work_analyzer)
- Internship experience (use internship_analyzer)
- Skills analysis (use skills_analyzer)
- Direct resume modification (use editor tool)

【When to use】
- "分析教育经历" (analyze education)
- "教育背景怎么样" (how is my education background)
- "评估我的专业" (evaluate my major)

【Returns】
1. Analysis results: score, issues, highlights
2. Optimization suggestions with before/after examples
3. These examples are for the editor tool to use

Parameters:
- target_position: (optional) Target job position for matching analysis (e.g., '后端开发工程师')"""

    parameters: dict = {
        "type": "object",
        "properties": {
            "target_position": {
                "type": "string",
                "description": "Target job position for matching analysis (e.g., '后端开发工程师')"
            }
        },
        "required": []
    }

    class Config:
        arbitrary_types_allowed = True

    async def execute(
        self,
        target_position: Optional[str] = None,
    ) -> ToolResult:
        """执行教育经历分析

        Args:
            target_position: 目标岗位

        Returns:
            分析结果 + 优化建议示例（供 editor 工具使用）
        """
        # 获取简历数据
        resume_data = ResumeDataStore.get_data(self.session_id)
        if not resume_data:
            return self.fail_response(
                "No resume data loaded. Please use cv_reader_agent tool first to read resume data."
            )

        if not isinstance(resume_data, dict):
            return self.fail_response(
                f"Invalid resume data type: {type(resume_data)}. Expected dict."
            )

        try:
            # 导入 EducationAnalyzer（延迟导入避免循环依赖）
            from backend.agent.agent.module.education_analyzer import EducationAnalyzer

            # 创建分析器实例
            analyzer = EducationAnalyzer()

            # 设置目标岗位
            if target_position:
                analyzer.set_target_position(target_position)

            # 执行分析
            analysis_result = await analyzer.analyze(resume_data)

            # 获取优化建议（供 editor 使用）
            optimization_suggestions = await analyzer._get_education_optimization_suggestions(resume_data, analysis_result)

            # 格式化输出
            output = self._format_output(analysis_result, optimization_suggestions)

            return self.success_response(output)

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            return self.fail_response(f"EducationAnalyzer error: {str(e)}\n\n{error_detail}")

    def _format_output(self, analysis_result: dict, optimization_suggestions: list) -> str:
        """格式化输出结果

        将分析结果和优化建议组合成格式化的输出
        """
        output = "## 📚 教育经历分析\n\n"

        # 1. 综合评分
        score = analysis_result.get("score", 0)
        score_emoji = "✅" if score >= 80 else "⚠️" if score >= 60 else "❌"
        output += f"**综合评分**: {score}/100 {score_emoji}\n\n"

        # 2. 详细分析
        details = analysis_result.get("details", {})

        # 院校信息
        institution = details.get("institution", {})
        if institution:
            output += "**院校信息**\n"
            output += f"- 院校: {institution.get('name', 'N/A')}\n"
            output += f"- 层次: 📖 {institution.get('level', '未知')}\n\n"

        # 学历专业
        degree = details.get("degree", {})
        if degree:
            output += "**学历专业**\n"
            output += f"- 学历: {degree.get('type', 'N/A')}\n"
            output += f"- 专业: {degree.get('major', 'N/A')}\n"
            match_score = degree.get('match_score', 0)
            match_emoji = "✅" if match_score >= 80 else "⚠️" if match_score >= 60 else "❌"
            output += f"- 匹配度: {match_score}/100 {match_emoji}\n\n"

        # 学术表现
        gpa = details.get("gpa", {})
        if gpa:
            output += "**学术表现**\n"
            output += f"- 评估: {gpa.get('assessment', '未知')}\n\n"

        # 课程分析
        courses = details.get("courses", {})
        if courses:
            output += "**课程分析**\n"
            if courses.get("missing_courses"):
                output += f"- 建议补充: {', '.join(courses['missing_courses'][:5])}\n"
            output += "\n"

        # 3. 优势
        strengths = analysis_result.get("strengths", [])
        if strengths:
            output += "**✨ 优势**\n"
            for s in strengths:
                output += f"- {s.get('item', '')}: {s.get('description', '')}\n"
            output += "\n"

        # 4. 问题列表（按严重程度分组）
        issues = analysis_result.get("issues", [])
        if issues:
            high_issues = [i for i in issues if i.get("severity") == "high"]
            medium_issues = [i for i in issues if i.get("severity") == "medium"]
            low_issues = [i for i in issues if i.get("severity") == "low"]

            if high_issues:
                output += "**🔴 高优先级问题**\n"
                for i in high_issues:
                    output += f"- {i.get('problem', '')}\n"
                    output += f"  💡 建议: {i.get('suggestion', '')}\n"
                output += "\n"

            if medium_issues:
                output += "**🟡 中优先级问题**\n"
                for i in medium_issues:
                    output += f"- {i.get('problem', '')}\n"
                    output += f"  💡 建议: {i.get('suggestion', '')}\n"
                output += "\n"

            if low_issues:
                output += "**🟢 低优先级问题**\n"
                for i in low_issues:
                    output += f"- {i.get('problem', '')}\n"
                output += "\n"

        # 5. 优化建议示例（供 editor 工具使用）
        if optimization_suggestions:
            output += "---\n\n"
            output += "## 💡 优化建议示例\n\n"
            output += "以下优化建议可以供 editor 工具修改简历时参考：\n\n"

            for idx, suggestion in enumerate(optimization_suggestions, 1):
                output += f"### 建议优化 {idx}: {suggestion.get('title', '')}\n\n"

                # 修改前后对比
                output += "**❌ 当前内容**:\n```\n"
                output += suggestion.get('current', '无')
                output += "\n```\n\n"

                output += "**✅ 优化后内容**:\n```\n"
                output += suggestion.get('optimized', '无')
                output += "\n```\n\n"

                # 说明
                output += f"**💡 说明**: {suggestion.get('explanation', '')}\n\n"

                # 应用路径（供 editor 使用）
                if suggestion.get('apply_path'):
                    output += f"**📍 应用位置**: `{suggestion.get('apply_path')}`\n\n"

                output += "---\n\n"

        # 6. JSON 结果（供程序解析）
        output += "## 📋 完整分析结果 (JSON)\n\n"
        full_result = {
            "analysis": analysis_result,
            "optimization_suggestions": optimization_suggestions
        }
        json_output = json.dumps(full_result, ensure_ascii=False, indent=2)
        output += f"```json\n{json_output}\n```"

        return output


# 便捷函数
async def analyze_education(
    resume_data: dict, target_position: str = "后端开发工程师"
) -> dict:
    """分析教育经历的便捷函数

    Args:
        resume_data: 简历数据
        target_position: 目标岗位

    Returns:
        分析结果字典
    """
    # 设置简历数据
    ResumeDataStore.set_data(resume_data)

    # 创建工具并执行分析
    tool = EducationAnalyzerTool()
    result = await tool.execute(target_position=target_position)

    if result.error:
        raise Exception(result.error)

    # 解析 JSON 结果
    from backend.agent.agent.module.education_analyzer import EducationAnalyzer

    analyzer = EducationAnalyzer()
    return await analyzer.analyze(resume_data)
