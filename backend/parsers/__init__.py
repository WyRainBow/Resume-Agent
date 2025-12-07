"""
简历解析器模块
将复杂的解析逻辑拆分成独立的解析器
"""

from .json_parser import try_json_repair, try_regex_extract
from .internship_parser import parse_internships
from .project_parser import parse_projects
from .skill_parser import parse_skills
from .education_parser import parse_education
from .opensource_parser import parse_opensource
from .contact_parser import parse_contact, parse_name

__all__ = [
    'try_json_repair',
    'try_regex_extract',
    'parse_internships',
    'parse_projects',
    'parse_skills',
    'parse_education',
    'parse_opensource',
    'parse_contact',
    'parse_name',
]

