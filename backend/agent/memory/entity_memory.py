"""
EntityMemory - 实体记忆系统

参考 CrewAI Entity Memory 设计，针对简历优化场景自动提取和记忆实体。
包括目标岗位、目标公司、核心技能、工作年限、项目经历等。
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pydantic import BaseModel


@dataclass
class Skill:
    """技能实体"""
    name: str
    category: str  # programming | language | domain | soft_skill | tool
    years: Optional[float] = None
    proficiency: Optional[str] = None  # beginner | intermediate | expert | master
    projects: int = 0
    mentions: int = 1  # 提及次数

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Skill":
        return cls(**data)


@dataclass
class Company:
    """公司实体"""
    name: str
    duration: Optional[str] = None  # "2年" | "2020-2022"
    role: Optional[str] = None
    is_target: bool = False  # 是否是目标公司
    mentions: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Company":
        return cls(**data)


@dataclass
class Project:
    """项目实体"""
    name: str
    tech_stack: List[str] = field(default_factory=list)
    role: Optional[str] = None
    duration: Optional[str] = None
    description: Optional[str] = None
    achievements: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Project":
        return cls(**data)


@dataclass
class Targets:
    """目标信息"""
    role: Optional[str] = None
    companies: List[str] = field(default_factory=list)
    industry: Optional[str] = None
    locations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Targets":
        return cls(**data)


@dataclass
class ExtractedEntities:
    """从简历中提取的实体"""
    skills: List[Skill] = field(default_factory=list)
    companies: List[Company] = field(default_factory=list)
    projects: List[Project] = field(default_factory=list)
    work_years: Optional[float] = None
    education: Optional[str] = None
    languages: List[str] = field(default_factory=list)
    certifications: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "skills": [s.to_dict() for s in self.skills],
            "companies": [c.to_dict() for c in self.companies],
            "projects": [p.to_dict() for p in self.projects],
            "work_years": self.work_years,
            "education": self.education,
            "languages": self.languages,
            "certifications": self.certifications
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExtractedEntities":
        return cls(
            skills=[Skill.from_dict(s) for s in data.get("skills", [])],
            companies=[Company.from_dict(c) for c in data.get("companies", [])],
            projects=[Project.from_dict(p) for p in data.get("projects", [])],
            work_years=data.get("work_years"),
            education=data.get("education"),
            languages=data.get("languages", []),
            certifications=data.get("certifications", [])
        )


@dataclass
class Association:
    """实体关联"""
    skill: str
    related_projects: List[str] = field(default_factory=list)
    related_companies: List[str] = field(default_factory=list)
    target_company_match: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Association":
        return cls(**data)


class EntityMemory:
    """
    实体记忆系统

    功能：
    - extract() 从文本中提取实体
    - get() 获取实体信息
    - update() 更新实体信息
    - search() 搜索相关实体
    """

    # 常见技能词库
    COMMON_SKILLS = {
        "programming": [
            "Python", "Java", "JavaScript", "TypeScript", "Go", "Rust", "C++", "C#", "Ruby",
            "Swift", "Kotlin", "PHP", "Scala", "R", "MATLAB", "Shell", "Bash"
        ],
        "domain": [
            "LLM", "Machine Learning", "Deep Learning", "AI", "NLP", "Computer Vision",
            "Data Science", "MLOps", "Blockchain", "Web3", "DevOps"
        ],
        "framework": [
            "React", "Vue", "Angular", "Django", "Flask", "FastAPI", "Spring", "Express",
            "Next.js", "Nuxt.js", "TensorFlow", "PyTorch", "Keras"
        ],
        "tool": [
            "Docker", "Kubernetes", "Git", "Jenkins", "AWS", "Azure", "GCP", "Linux",
            "Nginx", "Redis", "MongoDB", "PostgreSQL", "MySQL", "Elasticsearch"
        ],
        "soft_skill": [
            "leadership", "communication", "teamwork", "problem-solving", "agile",
            "scrum", "mentoring", "presentation"
        ]
    }

    # 常见公司词库
    COMMON_COMPANIES = [
        "Google", "Meta", "Facebook", "Amazon", "Apple", "Microsoft", "Netflix",
        "字节跳动", "ByteDance", "阿里巴巴", "Alibaba", "腾讯", "Tencent", "百度",
        "京东", "美团", "滴滴", "华为", "小米", "OPPO", "vivo",
        "OpenAI", "Anthropic", "DeepMind", "NVIDIA", "Tesla", "SpaceX"
    ]

    def __init__(self, storage_path: str = "data/entities"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

        self.targets: Targets = Targets()
        self.extracted: ExtractedEntities = ExtractedEntities()
        self.associations: List[Association] = []

        # 从文件加载
        self._load_from_disk()

    def _get_storage_file(self) -> Path:
        return self.storage_path / "entity_memory.json"

    def _load_from_disk(self) -> None:
        """从磁盘加载实体记忆"""
        file_path = self._get_storage_file()
        if not file_path.exists():
            return

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            self.targets = Targets.from_dict(data.get("targets", {}))
            self.extracted = ExtractedEntities.from_dict(data.get("extracted", {}))
            self.associations = [
                Association.from_dict(a) for a in data.get("associations", [])
            ]
        except Exception:
            pass

    def _save_to_disk(self) -> None:
        """保存实体记忆到磁盘"""
        data = {
            "updated_at": datetime.now().isoformat(),
            "targets": self.targets.to_dict(),
            "extracted": self.extracted.to_dict(),
            "associations": [a.to_dict() for a in self.associations]
        }

        file_path = self._get_storage_file()
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def extract(self, text: str, source: str = "conversation") -> Dict[str, Any]:
        """
        从文本中提取实体

        Args:
            text: 输入文本
            source: 来源 (conversation | resume)

        Returns:
            提取的实体字典
        """
        extracted = {
            "skills": [],
            "companies": [],
            "targets": {}
        }

        # 提取技能
        for category, skills in self.COMMON_SKILLS.items():
            for skill in skills:
                if skill.lower() in text.lower():
                    extracted["skills"].append({
                        "name": skill,
                        "category": category
                    })

        # 提取公司
        for company in self.COMMON_COMPANIES:
            if company in text:
                extracted["companies"].append({"name": company})

        # 提取目标信息
        target_patterns = {
            "role": r"(?:目标|应聘|申请)(?:岗位|职位|工作|角色)[:：]?\s*([^\n，。；,.]{2,20})",
            "companies": r"(?:目标|投递|应聘)(?:公司|企业)[:：]?\s*([^\n，。；,.]+)",
            "industry": r"(?:行业|领域)[:：]?\s*([^\n，。；,.]{2,15})"
        }

        for key, pattern in target_patterns.items():
            match = re.search(pattern, text)
            if match:
                value = match.group(1).strip()
                if key == "companies":
                    # 分割公司列表
                    extracted["targets"][key] = [
                        c.strip() for c in re.split(r"[,，、和与及]", value)
                    ]
                else:
                    extracted["targets"][key] = value

        return extracted

    def update_targets(self, **kwargs) -> None:
        """
        更新目标信息

        Args:
            **kwargs: 目标字段 (role, companies, industry, locations)
        """
        if "role" in kwargs and kwargs["role"]:
            self.targets.role = kwargs["role"]
        if "companies" in kwargs and kwargs["companies"]:
            if isinstance(kwargs["companies"], str):
                self.targets.companies = [kwargs["companies"]]
            else:
                self.targets.companies = list(kwargs["companies"])
        if "industry" in kwargs and kwargs["industry"]:
            self.targets.industry = kwargs["industry"]
        if "locations" in kwargs and kwargs["locations"]:
            if isinstance(kwargs["locations"], str):
                self.targets.locations = [kwargs["locations"]]
            else:
                self.targets.locations = list(kwargs["locations"])

        self._save_to_disk()

    def update_skills(self, skills: List[Dict[str, Any]]) -> None:
        """
        更新技能列表

        Args:
            skills: 技能列表
        """
        skill_map = {s.name: s for s in self.extracted.skills}

        for skill_data in skills:
            name = skill_data.get("name")
            if not name:
                continue

            if name in skill_map:
                # 更新现有技能
                existing = skill_map[name]
                existing.mentions += 1
                if "years" in skill_data:
                    existing.years = skill_data["years"]
                if "proficiency" in skill_data:
                    existing.proficiency = skill_data["proficiency"]
                if "projects" in skill_data:
                    existing.projects = skill_data["projects"]
            else:
                # 添加新技能
                self.extracted.skills.append(Skill(
                    name=name,
                    category=skill_data.get("category", "programming"),
                    years=skill_data.get("years"),
                    proficiency=skill_data.get("proficiency"),
                    projects=skill_data.get("projects", 0)
                ))

        self._save_to_disk()

    def update_companies(self, companies: List[Dict[str, Any]]) -> None:
        """
        更新公司列表

        Args:
            companies: 公司列表
        """
        company_map = {c.name: c for c in self.extracted.companies}

        for company_data in companies:
            name = company_data.get("name")
            if not name:
                continue

            # 检查是否是目标公司
            is_target = name in self.targets.companies

            if name in company_map:
                # 更新现有公司
                existing = company_map[name]
                existing.mentions += 1
                existing.is_target = existing.is_target or is_target
                if "duration" in company_data:
                    existing.duration = company_data["duration"]
                if "role" in company_data:
                    existing.role = company_data["role"]
            else:
                # 添加新公司
                self.extracted.companies.append(Company(
                    name=name,
                    duration=company_data.get("duration"),
                    role=company_data.get("role"),
                    is_target=is_target
                ))

        self._save_to_disk()

    def update_projects(self, projects: List[Dict[str, Any]]) -> None:
        """
        更新项目列表

        Args:
            projects: 项目列表
        """
        project_map = {p.name: p for p in self.extracted.projects}

        for project_data in projects:
            name = project_data.get("name")
            if not name:
                continue

            if name in project_map:
                # 更新现有项目
                existing = project_map[name]
                if "tech_stack" in project_data:
                    existing.tech_stack = project_data["tech_stack"]
                if "role" in project_data:
                    existing.role = project_data["role"]
                if "achievements" in project_data:
                    existing.achievements = project_data["achievements"]
            else:
                # 添加新项目
                self.extracted.projects.append(Project(
                    name=name,
                    tech_stack=project_data.get("tech_stack", []),
                    role=project_data.get("role"),
                    duration=project_data.get("duration"),
                    description=project_data.get("description"),
                    achievements=project_data.get("achievements", [])
                ))

        self._save_to_disk()

    def get(self, key: str, default: Any = None) -> Any:
        """
        获取实体信息

        Args:
            key: 实体键 (target_role, target_companies, skills, companies, projects, work_years)
            default: 默认值

        Returns:
            实体信息
        """
        key_map = {
            "target_role": lambda: self.targets.role,
            "target_companies": lambda: self.targets.companies,
            "target_industry": lambda: self.targets.industry,
            "skills": lambda: [s.to_dict() for s in self.extracted.skills],
            "companies": lambda: [c.to_dict() for c in self.extracted.companies],
            "projects": lambda: [p.to_dict() for p in self.extracted.projects],
            "work_years": lambda: self.extracted.work_years,
            "education": lambda: self.extracted.education,
        }

        func = key_map.get(key)
        if func:
            return func()
        return default

    def get_skill(self, name: str) -> Optional[Skill]:
        """
        获取指定技能

        Args:
            name: 技能名称

        Returns:
            技能对象
        """
        for skill in self.extracted.skills:
            if skill.name.lower() == name.lower():
                return skill
        return None

    def get_skills_by_category(self, category: str) -> List[Skill]:
        """
        按类别获取技能

        Args:
            category: 技能类别

        Returns:
            技能列表
        """
        return [s for s in self.extracted.skills if s.category == category]

    def get_target_companies(self) -> List[str]:
        """获取目标公司列表"""
        return self.targets.companies

    def get_target_role(self) -> Optional[str]:
        """获取目标岗位"""
        return self.targets.role

    def search(self, query: str) -> List[Dict[str, Any]]:
        """
        搜索相关实体

        Args:
            query: 搜索关键词

        Returns:
            匹配的实体列表
        """
        results = []
        query_lower = query.lower()

        # 搜索技能
        for skill in self.extracted.skills:
            if query_lower in skill.name.lower():
                results.append({
                    "type": "skill",
                    "name": skill.name,
                    "category": skill.category,
                    "proficiency": skill.proficiency
                })

        # 搜索公司
        for company in self.extracted.companies:
            if query_lower in company.name.lower():
                results.append({
                    "type": "company",
                    "name": company.name,
                    "is_target": company.is_target,
                    "role": company.role
                })

        # 搜索项目
        for project in self.extracted.projects:
            if query_lower in project.name.lower():
                results.append({
                    "type": "project",
                    "name": project.name,
                    "tech_stack": project.tech_stack,
                    "role": project.role
                })

        return results

    def get_matching_skills(self, target_role: Optional[str] = None) -> Dict[str, Any]:
        """
        获取与目标岗位匹配的技能

        Args:
            target_role: 目标岗位（如果不指定则使用记忆中的）

        Returns:
            匹配分析结果
        """
        role = target_role or self.targets.role
        if not role:
            return {"matched": [], "missing": []}

        # 简单的关键词匹配规则
        role_skill_requirements = {
            "Senior Software Engineer": ["Python", "Java", "System Design", "Architecture"],
            "Software Engineer": ["Python", "JavaScript", "Git", "SQL"],
            "Frontend Engineer": ["JavaScript", "React", "Vue", "CSS", "HTML"],
            "Backend Engineer": ["Python", "Java", "SQL", "Redis", "API"],
            "Full Stack Engineer": ["JavaScript", "Python", "React", "SQL"],
            "Data Scientist": ["Python", "Machine Learning", "Statistics", "SQL"],
            "ML Engineer": ["Python", "TensorFlow", "PyTorch", "MLOps"],
            "DevOps Engineer": ["Docker", "Kubernetes", "AWS", "Linux", "CI/CD"],
            "Product Manager": ["Agile", "Scrum", "communication", "leadership"],
        }

        user_skills = {s.name.lower() for s in self.extracted.skills}

        # 查找匹配的岗位类型
        required_skills = []
        for job_title, skills in role_skill_requirements.items():
            if job_title.lower() in role.lower():
                required_skills = skills
                break

        matched = []
        missing = []

        for skill in required_skills:
            if any(skill.lower() in s.name.lower() for s in self.extracted.skills):
                matched.append(skill)
            else:
                missing.append(skill)

        return {
            "role": role,
            "matched": matched,
            "missing": missing,
            "match_rate": len(matched) / len(required_skills) if required_skills else 0
        }

    def add_association(self, skill: str, **kwargs) -> None:
        """
        添加实体关联

        Args:
            skill: 技能名称
            **kwargs: 关联信息
        """
        # 查找或创建关联
        for assoc in self.associations:
            if assoc.skill.lower() == skill.lower():
                if "related_projects" in kwargs:
                    assoc.related_projects.extend(kwargs["related_projects"])
                if "related_companies" in kwargs:
                    assoc.related_companies.extend(kwargs["related_companies"])
                if "target_company_match" in kwargs:
                    assoc.target_company_match.extend(kwargs["target_company_match"])
                self._save_to_disk()
                return

        # 创建新关联
        self.associations.append(Association(
            skill=skill,
            related_projects=kwargs.get("related_projects", []),
            related_companies=kwargs.get("related_companies", []),
            target_company_match=kwargs.get("target_company_match", [])
        ))
        self._save_to_disk()

    def clear(self) -> None:
        """清除所有实体记忆"""
        self.targets = Targets()
        self.extracted = ExtractedEntities()
        self.associations = []
        self._save_to_disk()

    def to_dict(self) -> Dict[str, Any]:
        """导出为字典"""
        return {
            "targets": self.targets.to_dict(),
            "extracted": self.extracted.to_dict(),
            "associations": [a.to_dict() for a in self.associations]
        }

    def __repr__(self) -> str:
        return f"EntityMemory(skills={len(self.extracted.skills)}, " \
               f"companies={len(self.extracted.companies)}, " \
               f"projects={len(self.extracted.projects)}, " \
               f"target_role={self.targets.role})"
