"""
CV Reader Tool - 读取简历上下文的工具

用于在 Agent 对话中获取简历的具体模块信息
"""

from typing import Optional
from backend.agent.tool.base import BaseTool


def strip_html(html: str) -> str:
    """简单的 HTML 标签移除，保留纯文本"""
    if not html:
        return ""
    import re
    clean = re.sub(r'<[^>]+>', '', html)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


class ReadCVContext(BaseTool):
    """读取当前加载的简历上下文"""

    name: str = "read_cv_context"
    description: str = """Read the current CV/Resume context.

Use this tool when you need to reference specific details from the resume.
Returns the resume content in a structured, readable format."""

    parameters: dict = {
        "type": "object",
        "properties": {
            "section": {
                "type": "string",
                "description": "The specific section to read. Default is 'all' for full resume.",
                "enum": [
                    "all", "basic", "education", "experience",
                    "projects", "skills", "awards", "opensource"
                ],
                "default": "all"
            }
        }
    }

    _resume_data: Optional[dict] = None

    class Config:
        arbitrary_types_allowed = True

    def set_resume_data(self, resume_data: dict):
        """设置当前简历数据"""
        self._resume_data = resume_data

    async def execute(self, section: str = "all") -> str:
        """执行读取简历上下文"""
        if not self._resume_data:
            return "No resume data loaded."

        if section == "all":
            return self._format_full_resume()
        return self._format_section(section)

    def _format_full_resume(self) -> str:
        """格式化完整简历"""
        resume = self._resume_data
        lines = ["# CV/Resume Context\n", "=" * 50, "\n"]

        basic = resume.get("basic", {})
        if basic:
            lines.append("## Basic Information")
            lines.append(f"Name: {basic.get('name', 'N/A')}")
            lines.append(f"Target Position: {basic.get('title', 'N/A')}")
            if basic.get('email'):
                lines.append(f"Email: {basic.get('email')}")
            if basic.get('phone'):
                lines.append(f"Phone: {basic.get('phone')}")
            if basic.get('location'):
                lines.append(f"Location: {basic.get('location')}")
            lines.append("")

        # 教育经历
        education = resume.get("education", [])
        if education:
            # 去重：根据学校名称和学位去重
            seen = set()
            unique_education = []
            for edu in education:
                school = edu.get('school', '')
                degree = edu.get('degree', '')
                key = f"{school}_{degree}"
                if key not in seen and school:
                    seen.add(key)
                    unique_education.append(edu)

            if unique_education:
                lines.append("## Education")
                for edu in unique_education:
                    degree = edu.get('degree', '')
                    major = edu.get('major', '')
                    degree_major = f"{degree} in {major}" if degree and major else (degree or major or '')
                    lines.append(f"- **{edu.get('school')}** | {degree_major}")
                    lines.append(f"  Period: {edu.get('startDate')} - {edu.get('endDate')}")
                    if edu.get('description'):
                        lines.append(f"  Description: {strip_html(edu.get('description'))}")
                    lines.append("")

        # 工作经历
        experience = resume.get("experience", [])
        if experience:
            lines.append("## Work Experience")
            for exp in experience:
                lines.append(f"- **{exp.get('company')}** | {exp.get('position')}")
                lines.append(f"  Period: {exp.get('date')}")
                if exp.get('details'):
                    lines.append(f"  Details: {strip_html(exp.get('details'))}")
                lines.append("")

        # 项目经历
        projects = resume.get("projects", [])
        if projects:
            lines.append("## Projects")
            for proj in projects:
                lines.append(f"- **{proj.get('name')}** | {proj.get('role')}")
                lines.append(f"  Period: {proj.get('date')}")
                if proj.get('description'):
                    lines.append(f"  Description: {strip_html(proj.get('description'))}")
                if proj.get('link'):
                    lines.append(f"  Link: {proj.get('link')}")
                lines.append("")

        # 开源经历
        opensource = resume.get("openSource", [])
        if opensource:
            lines.append("## Open Source")
            for os in opensource:
                lines.append(f"- **{os.get('name')}**")
                if os.get('role'):
                    lines.append(f"  Role: {os.get('role')}")
                if os.get('description'):
                    lines.append(f"  Description: {strip_html(os.get('description'))}")
                if os.get('repo'):
                    lines.append(f"  Repo: {os.get('repo')}")
                lines.append("")

        # 技能
        skills = resume.get("skillContent", "")
        if skills:
            lines.append("## Skills")
            lines.append(strip_html(skills))
            lines.append("")

        # 荣誉奖项
        awards = resume.get("awards", [])
        if awards:
            lines.append("## Awards")
            for award in awards:
                lines.append(f"- **{award.get('title')}**")
                if award.get('issuer'):
                    lines.append(f"  Issuer: {award.get('issuer')}")
                if award.get('date'):
                    lines.append(f"  Date: {award.get('date')}")
                lines.append("")

        return "\n".join(lines)

    def _format_section(self, section: str) -> str:
        """格式化单个模块"""
        resume = self._resume_data

        section_map = {
            "basic": ("Basic Information", self._format_basic),
            "education": ("Education", self._format_education),
            "experience": ("Work Experience", self._format_experience),
            "projects": ("Projects", self._format_projects),
            "skills": ("Skills", self._format_skills),
            "awards": ("Awards", self._format_awards),
            "opensource": ("Open Source", self._format_opensource),
        }

        if section not in section_map:
            return f"Unknown section: {section}"

        title, formatter = section_map[section]
        content = formatter(resume)
        return f"## {title}\n\n{content}" if content else f"No data for {title}"

    def _format_basic(self, resume: dict) -> str:
        basic = resume.get("basic", {})
        return "\n".join([
            f"Name: {basic.get('name', 'N/A')}",
            f"Position: {basic.get('title', 'N/A')}",
            f"Email: {basic.get('email', 'N/A')}",
            f"Phone: {basic.get('phone', 'N/A')}",
            f"Location: {basic.get('location', 'N/A')}",
        ])

    def _format_education(self, resume: dict) -> str:
        education = resume.get("education", [])
        if not education:
            return "No education data."

        # 去重：根据学校名称和学位去重
        seen = set()
        unique_education = []
        for edu in education:
            school = edu.get('school', '')
            degree = edu.get('degree', '')
            # 创建唯一标识
            key = f"{school}_{degree}"
            if key not in seen and school:
                seen.add(key)
                unique_education.append(edu)

        if not unique_education:
            return "No education data."

        lines = []
        for edu in unique_education:
            degree = edu.get('degree', '')
            major = edu.get('major', '')
            # 格式化学位和专业信息
            degree_major = f"{degree} in {major}" if degree and major else (degree or major or '')
            lines.append(f"- **{edu.get('school')}** | {degree_major}")
            lines.append(f"  {edu.get('startDate')} - {edu.get('endDate')}")
        return "\n".join(lines)

    def _format_experience(self, resume: dict) -> str:
        experience = resume.get("experience", [])
        if not experience:
            return "No experience data."
        lines = []
        for exp in experience:
            lines.append(f"- **{exp.get('company')}** | {exp.get('position')}")
            lines.append(f"  {exp.get('date')}")
        return "\n".join(lines)

    def _format_projects(self, resume: dict) -> str:
        projects = resume.get("projects", [])
        if not projects:
            return "No projects data."
        lines = []
        for proj in projects:
            lines.append(f"- **{proj.get('name')}** | {proj.get('role')}")
            lines.append(f"  {proj.get('date')}")
        return "\n".join(lines)

    def _format_skills(self, resume: dict) -> str:
        return strip_html(resume.get("skillContent", "")) or "No skills data."

    def _format_awards(self, resume: dict) -> str:
        awards = resume.get("awards", [])
        if not awards:
            return "No awards data."
        return "\n".join(f"- **{a.get('title')}**" for a in awards)

    def _format_opensource(self, resume: dict) -> str:
        opensource = resume.get("openSource", [])
        if not opensource:
            return "No open source data."
        return "\n".join(f"- **{os.get('name')}**" for os in opensource)
