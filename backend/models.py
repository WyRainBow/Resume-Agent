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
    provider: Literal["zhipu", "doubao", "deepseek"] = Field(default="doubao")
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


class AgentReflectRequest(BaseModel):
    """Agent 反思请求"""
    original_text: str = Field(..., description="用户原始输入文本")
    current_json: Dict[str, Any] = Field(..., description="当前解析的 JSON")
    screenshot_base64: Optional[str] = Field(default=None, description="预览截图 Base64")
    max_iterations: int = Field(default=2, description="最大迭代次数")


class QuickFixRequest(BaseModel):
    """快速修正请求"""
    original_text: str = Field(..., description="用户原始输入文本")
    current_json: Dict[str, Any] = Field(..., description="当前解析的 JSON")


class VisionAnalyzeRequest(BaseModel):
    """视觉分析请求"""
    screenshot_base64: str = Field(..., description="截图 Base64")
    original_text: str = Field(..., description="原始文本")


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


class TemplateAnalyzeRequest(BaseModel):
    """模板分析请求 - 使用 GLM-4.5V 分析简历预览截图"""
    screenshot_base64: str = Field(..., description="简历预览截图 Base64 编码")
    current_json: Optional[Dict[str, Any]] = Field(default=None, description="当前简历 JSON（可选）")


class TemplateAnalyzeResponse(BaseModel):
    """模板分析响应"""
    appearance: str = Field(..., description="现有模板长什么样子")
    issues: List[str] = Field(..., description="存在什么问题")
    suggestions: List[str] = Field(..., description="模板修改建议")
    raw_analysis: str = Field(..., description="原始分析内容")


class ConversationRequest(BaseModel):
    """对话式简历生成请求"""
    message: str = Field(..., description="用户输入的消息")
    step: str = Field(..., description="当前对话步骤")
    collected_info: Dict[str, Any] = Field(default_factory=dict, description="已收集的信息")
    resume_data: Dict[str, Any] = Field(default_factory=dict, description="当前简历数据")


class ConversationResponse(BaseModel):
    """对话式简历生成响应"""
    reply: str = Field(..., description="AI 回复消息")
    next_step: str = Field(..., description="下一步骤")
    updated_info: Dict[str, Any] = Field(default_factory=dict, description="更新后的收集信息")
    is_complete: bool = Field(default=False, description="是否完成")
    resume_data: Optional[Dict[str, Any]] = Field(default=None, description="生成的完整简历数据")


# ============ CV Tools 对话模型 ============

class CVToolCallRequest(BaseModel):
    """CV 工具自然语言调用请求"""
    message: str = Field(..., description="用户自然语言消息")
    resume_data: Dict[str, Any] = Field(..., description="当前简历数据")
    conversation_history: Optional[List[Dict[str, str]]] = Field(default=None, description="对话历史")
    session_id: Optional[str] = Field(default=None, description="会话 ID（可选，用于维护对话状态）")


class ToolCallSpec(BaseModel):
    """工具调用规格"""
    name: Literal["CVReader", "CVEditor", "CVTemplateList", "TemplateSwitcher", "SmartFitToOnePage"] = Field(..., description="工具名称")
    params: Dict[str, Any] = Field(..., description="工具参数")


class CVToolCallResponse(BaseModel):
    """CV 工具调用响应"""
    success: bool = Field(..., description="是否成功解析为工具调用")
    reply: str = Field(..., description="AI 回复消息")
    tool_call: Optional[ToolCallSpec] = Field(default=None, description="解析出的工具调用")
    reasoning: Optional[str] = Field(default=None, description="推理过程")
    session_id: Optional[str] = Field(default=None, description="会话ID，用于多轮对话上下文保持")


# ============ 工具执行结果模型 ============

class ToolExecutionResult(BaseModel):
    """工具执行结果"""
    success: bool = Field(..., description="执行是否成功")
    tool_name: str = Field(..., description="工具名称")
    message: str = Field(..., description="执行消息")
    data: Optional[Any] = Field(default=None, description="返回数据")
    path: Optional[str] = Field(default=None, description="操作路径")
    execution_time: float = Field(default=0.0, description="执行时间（秒）")
    error: Optional[Dict[str, Any]] = Field(default=None, description="错误信息")


# ============ 会话管理模型 ============

class SessionCreateRequest(BaseModel):
    """创建会话请求"""
    user_id: Optional[str] = Field(default=None, description="用户 ID")
    resume_id: Optional[str] = Field(default=None, description="简历 ID")
    resume_data: Optional[Dict[str, Any]] = Field(default=None, description="初始简历数据")


class SessionResponse(BaseModel):
    """会话响应"""
    session_id: str = Field(..., description="会话 ID")
    status: str = Field(..., description="会话状态")
    message_count: int = Field(default=0, description="消息数量")
    created_at: float = Field(..., description="创建时间戳")
    updated_at: float = Field(..., description="更新时间戳")


# ============ 意图识别模型 ============

class IntentRecognizeRequest(BaseModel):
    """意图识别请求"""
    message: str = Field(..., description="用户消息")
    context: Optional[Dict[str, Any]] = Field(default=None, description="上下文信息")


class IntentRecognizeResponse(BaseModel):
    """意图识别响应"""
    intent: str = Field(..., description="识别的意图")
    params: Dict[str, Any] = Field(default_factory=dict, description="提取的参数")
    confidence: float = Field(default=1.0, description="置信度")
