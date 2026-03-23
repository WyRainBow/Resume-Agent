from typing import Dict, Optional

from backend.agent.utils.json_path import exists_path


class PathGenerator:
    """Generate apply_path for optimization suggestions."""

    @staticmethod
    def generate_path(module: str, issue: Dict, resume_data: Dict) -> Optional[str]:
        if module == "work_experience":
            return PathGenerator._generate_experience_path(issue, resume_data)
        if module == "education":
            return PathGenerator._generate_education_path(resume_data)
        if module == "skills":
            return PathGenerator._generate_skills_path(resume_data)
        return None

    @staticmethod
    def validate_path(path: str, resume_data: Dict) -> bool:
        return exists_path(resume_data, path)

    @staticmethod
    def _generate_experience_path(issue: Dict, resume_data: Dict) -> Optional[str]:
        experiences = resume_data.get("experience") or []
        if not experiences:
            return "experience"

        issue_id = issue.get("id", "")
        index = 0
        for token in issue_id.split("-"):
            if token.isdigit():
                index = int(token)
                break

        index = min(max(index, 0), len(experiences) - 1)
        path = f"experience[{index}].details"
        return path

    @staticmethod
    def _generate_education_path(resume_data: Dict) -> Optional[str]:
        education = resume_data.get("education") or []
        if not education:
            return "education"
        return "education[0].description"

    @staticmethod
    def _generate_skills_path(resume_data: Dict) -> Optional[str]:
        if "skillContent" in resume_data:
            return "skillContent"
        return "skills"
