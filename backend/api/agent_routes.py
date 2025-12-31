"""
Agent API 路由

提供 REST API 接口，暴露新 Agent 的能力：
1. 动态任务图对话
2. RAG 知识库查询
3. STAR 法则分析
4. 会话管理
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
import logging

from ..agents import (
    CoreAgent,
    AgentMode,
    get_knowledge_base,
    get_star_guidancer,
    SessionManager,
    get_session_manager
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["Agent"])

# 全局会话管理器
session_manager = get_session_manager()


# ==================== 请求/响应模型 ====================

class ChatRequest(BaseModel):
    """对话请求"""
    message: str = Field(..., description="用户消息", min_length=1)
    resume_data: Optional[Dict[str, Any]] = Field(None, description="简历数据")
    session_id: Optional[str] = Field(None, description="会话 ID（用于多轮对话）")
    mode: Optional[str] = Field("dynamic", description="Agent 模式: dynamic 或 legacy")
    enable_rag: Optional[bool] = Field(True, description="启用 RAG 知识库")
    enable_star: Optional[bool] = Field(True, description="启用 STAR 法则追问")


class ChatResponse(BaseModel):
    """对话响应"""
    reply: str
    tool_calls: List[Dict[str, Any]] = []
    tool_results: List[Dict[str, Any]] = []
    followup_questions: List[str] = []
    resume_modified: bool = False
    session_id: str
    rag_context_used: bool = False
    rag_sources: List[str] = []


class STARAnalysisRequest(BaseModel):
    """STAR 分析请求"""
    description: str = Field(..., description="经历描述")
    position: Optional[str] = Field(None, description="职位名称")
    company: Optional[str] = Field(None, description="公司名称")


class STARAnalysisResponse(BaseModel):
    """STAR 分析响应"""
    completeness: float = Field(..., description="完整度 0-1")
    missing: List[str] = Field(default=[], description="缺失的 STAR 要素")
    detected: List[str] = Field(default=[], description="检测到的 STAR 要素")
    suggestions: List[str] = Field(default=[], description="改进建议")
    improved_description: Optional[str] = Field(None, description="改进后的描述")


class KnowledgeSearchRequest(BaseModel):
    """知识库搜索请求"""
    query: str = Field(..., description="搜索查询")
    top_k: Optional[int] = Field(5, description="返回结果数量")


class KnowledgeSearchResponse(BaseModel):
    """知识库搜索响应"""
    results: List[Dict[str, Any]]
    total: int


# ==================== 依赖注入 ====================

def get_agent(
    session_id: Optional[str] = None,
    resume_data: Optional[Dict[str, Any]] = None,
    mode: str = "dynamic",
    llm_call_fn: Optional[Any] = None
) -> CoreAgent:
    """获取或创建 Agent 实例"""
    agent_mode = AgentMode.DYNAMIC if mode == "dynamic" else AgentMode.LEGACY

    return CoreAgent(
        resume_data=resume_data or {},
        mode=agent_mode,
        session_id=session_id,
        llm_call_fn=llm_call_fn,
        enable_rag=True,
        enable_star=True
    )


# ==================== API 端点 ====================

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    对话接口

    处理用户消息，返回回复和追问问题。
    """
    try:
        # 获取或创建会话
        session = session_manager.get_or_create_session(
            session_id=request.session_id,
            resume_data=request.resume_data
        )

        # 创建 Agent
        agent = CoreAgent(
            resume_data=session.resume_snapshot or request.resume_data or {},
            mode=AgentMode.DYNAMIC if request.mode == "dynamic" else AgentMode.LEGACY,
            session_id=session.session_id,
            enable_rag=request.enable_rag,
            enable_star=request.enable_star
        )

        # 处理消息
        response = agent.process_message(request.message)

        # 更新会话
        session.add_message("user", request.message)
        session.add_message("assistant", response.reply)
        session_manager.update_session(session)

        return ChatResponse(
            reply=response.reply,
            tool_calls=response.tool_call or [],
            tool_results=response.tool_result or [],
            followup_questions=response.followup_questions or [],
            resume_modified=response.resume_modified,
            session_id=session.session_id,
            rag_context_used=response.get("rag_context_used", False),
            rag_sources=response.get("rag_sources", [])
        )

    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/star/analyze", response_model=STARAnalysisResponse)
async def analyze_star(request: STARAnalysisRequest):
    """
    STAR 法则分析

    分析经历描述的完整度，提供改进建议。
    """
    try:
        guidancer = get_star_guidancer()

        analysis = guidancer.analyze_description(request.description)

        return STARAnalysisResponse(
            completeness=analysis["completeness"],
            missing=analysis.get("missing", []),
            detected=analysis.get("detected", []),
            suggestions=analysis.get("suggestions", []),
            improved_description=guidancer.improve_description(
                request.description,
                request.position
            )
        )

    except Exception as e:
        logger.error(f"STAR analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/star/followup")
async def generate_followup(request: STARAnalysisRequest):
    """
    生成 STAR 法则追问

    根据当前描述，生成渐进式追问问题。
    """
    try:
        guidancer = get_star_guidancer()

        context = {
            "current_description": request.description,
            "position": request.position,
            "company": request.company
        }

        questions = guidancer.generate_followup_questions(context, max_questions=3)

        return {"questions": questions}

    except Exception as e:
        logger.error(f"Followup generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/knowledge/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(request: KnowledgeSearchRequest):
    """
    搜索知识库

    从 RAG 知识库中检索相关内容。
    """
    try:
        kb = get_knowledge_base()
        if not kb:
            raise HTTPException(
                status_code=503,
                detail="知识库未初始化，请先安装依赖: pip install langchain-community pymilvus"
            )

        docs = kb.search(request.query, top_k=request.top_k)

        results = []
        for doc in docs:
            results.append({
                "content": doc.page_content,
                "source": doc.metadata.get("source", ""),
                "category": doc.metadata.get("category", "general")
            })

        return KnowledgeSearchResponse(results=results, total=len(results))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Knowledge search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """
    获取会话信息
    """
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")

        return session_manager.get_session_summary(session)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """
    删除会话
    """
    try:
        success = session_manager.delete_session(session_id)
        if not success:
            raise HTTPException(status_code=404, detail="会话不存在")

        return {"deleted": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_status():
    """
    获取 Agent 服务状态
    """
    return {
        "service": "Agent API",
        "version": "2.0",
        "features": {
            "dynamic_agent": True,
            "rag_knowledge": True,
            "star_guidancer": True,
            "session_management": True
        },
        "dependencies": {
            "langchain": True,
            "milvus": True,  # 需要检查
        }
    }
