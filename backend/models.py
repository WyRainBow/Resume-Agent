"""
Pydantic 数据模型定义
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal, List, Dict, Any


class RewriteRequest(BaseModel):
    """重写请求"""
    provider: Literal["zhipu", "doubao", "deepseek"] = Field(default="doubao")
    resume: Dict[str, Any]
    path: str = Field(..., description="JSON 路径，如 summary 或 experience[0].achievements[1]")
    instruction: str = Field(..., description="修改意图，如：更量化、更贴合后端 JD")
    locale: Literal["zh", "en"] = Field(default="zh")


class AITestRequest(BaseModel):
    """AI 测试请求"""
    provider: Literal["zhipu", "doubao", "deepseek"] = Field(default="doubao")
    prompt: str = Field(..., description="测试提示词")


class ResumeGenerateRequest(BaseModel):
    """简历生成请求"""
    provider: Literal["zhipu", "doubao", "deepseek"] = Field(default="deepseek")
    instruction: str = Field(..., description="一句话或少量信息，说明岗位/经历/技能等")
    locale: Literal["zh", "en"] = Field(default="zh", description="输出语言")


class ResumeGenerateResponse(BaseModel):
    """简历生成响应"""
    resume: Dict[str, Any]
    provider: str


class ResumeJSON(BaseModel):
    """简历 JSON 结构"""
    name: Optional[str] = None
    contact: Optional[Dict[str, Optional[str]]] = None
    summary: Optional[str] = None
    experience: Optional[List[Dict[str, Any]]] = None
    projects: Optional[List[Dict[str, Any]]] = None
    skills: Optional[List[str]] = None
    education: Optional[List[Dict[str, Any]]] = None
    awards: Optional[List[Dict[str, Any]]] = None


class RenderPDFRequest(BaseModel):
    """PDF 渲染请求"""
    resume: Dict[str, Any]
    demo: Optional[bool] = False
    section_order: Optional[List[str]] = None
    engine: Optional[str] = "latex"


class SaveKeysRequest(BaseModel):
    """保存 API Key 请求"""
    zhipu_key: Optional[str] = None
    doubao_key: Optional[str] = None
    deepseek_key: Optional[str] = None


class ChatMessage(BaseModel):
    """聊天消息"""
    role: str
    content: str


class ChatRequest(BaseModel):
    """聊天请求"""
    messages: List[ChatMessage]
    provider: Optional[str] = None


class SectionParseRequest(BaseModel):
    """单模块 AI 解析请求"""
    text: str = Field(..., description="用户粘贴的模块文本")
    section_type: str = Field(..., description="模块类型: contact/education/experience/projects/skills/awards/summary/opensource")
    provider: Optional[Literal["zhipu", "doubao", "deepseek"]] = Field(default=None)
    model: Optional[str] = Field(default=None, description="可选，指定具体模型 (如 deepseek-chat, deepseek-reasoner)")


class ResumeParseRequest(BaseModel):
    """简历解析请求"""
    text: str = Field(..., description="用户粘贴的简历文本")
    provider: Optional[Literal["zhipu", "doubao", "deepseek"]] = Field(default=None)
    model: Optional[str] = Field(default=None, description="可选，指定具体模型 (如 deepseek-chat, deepseek-reasoner)")


class FormatTextRequest(BaseModel):
    """格式化文本请求"""
    text: str = Field(..., description="简历文本内容")
    provider: Literal['zhipu', 'doubao', 'deepseek'] = Field(default='doubao', description="AI 提供商")
    use_ai: bool = Field(default=True, description="是否允许使用 AI（最后一层）")


class FormatTextResponse(BaseModel):
    """格式化文本响应"""
    success: bool
    data: Optional[Dict[str, Any]]
    method: str
    error: Optional[str]
