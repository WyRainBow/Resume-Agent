"""
简历数据的 Pydantic 模型定义
用于 Instructor 结构化输出
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class Contact(BaseModel):
    """联系方式"""
    phone: Optional[str] = Field(None, description="电话号码")
    email: Optional[str] = Field(None, description="邮箱地址")
    location: Optional[str] = Field(None, description="所在地")


class ExperienceItem(BaseModel):
    """经历项（工作/实习）"""
    company: Optional[str] = Field(None, description="公司名称")
    position: Optional[str] = Field(None, description="职位")
    duration: Optional[str] = Field(None, description="时间段")
    location: Optional[str] = Field(None, description="地点")
    achievements: List[str] = Field(default_factory=list, description="成就/工作内容")


class ProjectItem(BaseModel):
    """项目项"""
    name: Optional[str] = Field(None, description="项目名称")
    role: Optional[str] = Field(None, description="角色")
    duration: Optional[str] = Field(None, description="时间段")
    stack: List[str] = Field(default_factory=list, description="技术栈")
    highlights: List[str] = Field(default_factory=list, description="项目亮点")


class CompetitionItem(BaseModel):
    """竞赛项"""
    name: Optional[str] = Field(None, description="竞赛名称")
    award: Optional[str] = Field(None, description="奖项")
    date: Optional[str] = Field(None, description="时间")
    description: Optional[str] = Field(None, description="描述")


class OpenSourceItem(BaseModel):
    """开源贡献项"""
    project: Optional[str] = Field(None, description="项目名称")
    role: Optional[str] = Field(None, description="角色/贡献")
    url: Optional[str] = Field(None, description="链接")
    description: Optional[str] = Field(None, description="描述")


class EducationItem(BaseModel):
    """教育经历项"""
    school: Optional[str] = Field(None, description="学校")
    degree: Optional[str] = Field(None, description="学位")
    major: Optional[str] = Field(None, description="专业")
    duration: Optional[str] = Field(None, description="时间段")
    gpa: Optional[str] = Field(None, description="GPA")


class AwardItem(BaseModel):
    """奖项"""
    title: Optional[str] = Field(None, description="奖项名称")
    issuer: Optional[str] = Field(None, description="颁发方")
    date: Optional[str] = Field(None, description="时间")


class CertificationItem(BaseModel):
    """证书"""
    name: Optional[str] = Field(None, description="证书名称")
    issuer: Optional[str] = Field(None, description="颁发机构")
    date: Optional[str] = Field(None, description="获得时间")


class PublicationItem(BaseModel):
    """论文/出版物"""
    title: Optional[str] = Field(None, description="标题")
    authors: List[str] = Field(default_factory=list, description="作者")
    venue: Optional[str] = Field(None, description="发表venue")
    date: Optional[str] = Field(None, description="发表时间")


class Resume(BaseModel):
    """
    简历完整模型
    
    灵活设计：
    - 所有字段都是 Optional
    - 用户有什么字段就填什么
    - 不强制要求任何字段
    """
    name: Optional[str] = Field(None, description="姓名")
    contact: Optional[Contact] = Field(None, description="联系方式")
    summary: Optional[str] = Field(None, description="个人简介/求职意向")
    
    """
    工作相关
    """
    experience: Optional[List[ExperienceItem]] = Field(None, description="工作经历")
    internships: Optional[List[ExperienceItem]] = Field(None, description="实习经历")
    
    """
    项目相关
    """
    projects: Optional[List[ProjectItem]] = Field(None, description="项目经验")
    
    """
    学术/竞赛相关
    """
    competitions: Optional[List[CompetitionItem]] = Field(None, description="竞赛经历")
    publications: Optional[List[PublicationItem]] = Field(None, description="论文发表")
    
    """
    开源/社区
    """
    opensource: Optional[List[OpenSourceItem]] = Field(None, description="开源贡献")
    
    """
    技能/教育
    """
    skills: Optional[List[str]] = Field(None, description="专业技能")
    education: Optional[List[EducationItem]] = Field(None, description="教育经历")
    
    """
    荣誉/证书
    """
    awards: Optional[List[AwardItem]] = Field(None, description="获奖荣誉")
    certifications: Optional[List[CertificationItem]] = Field(None, description="资格证书")
