"""
简历优化 API 路由

提供简历诊断、优化对话等功能
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resume-optimization", tags=["简历优化"])


class DiagnoseRequest(BaseModel):
    """诊断请求"""
    resume_id: str


class ChatRequest(BaseModel):
    """对话请求"""
    resume_id: str
    message: str
    session_id: Optional[str] = None
    stream: bool = True


@router.post("/diagnose")
async def diagnose_resume(request: DiagnoseRequest):
    """
    诊断简历

    执行多维度诊断，返回诊断报告和优化建议
    """
    try:
        # 动态导入以避免循环依赖
        from backend.agents.diagnosis import ResumeDiagnosis, GuidanceEngine
        from backend.services.resume_service import get_resume_data

        # 1. 读取简历数据
        resume_data = await get_resume_data(request.resume_id)

        # 2. 执行诊断
        diagnosis = ResumeDiagnosis()
        report = diagnosis.diagnose(resume_data)

        # 3. 生成引导消息和选项
        guidance = GuidanceEngine()
        message = guidance.generate_diagnosis_message(report)
        choices = guidance.generate_guidance_choices(report)

        return {
            "success": True,
            "report": report.to_dict(),
            "message": message,
            "choices": choices
        }

    except Exception as e:
        logger.error(f"诊断失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"诊断失败: {str(e)}")


@router.post("/chat")
async def chat_optimize(request: ChatRequest):
    """
    优化对话

    处理用户在优化过程中的对话
    """
    try:
        from backend.agents.resume_optimization_agent import ResumeOptimizationAgent

        # 创建优化 Agent
        agent = ResumeOptimizationAgent(
            resume_id=request.resume_id,
            session_id=request.session_id or f"session_{request.resume_id}"
        )

        # 处理消息（支持流式）
        if request.stream:
            # 流式响应
            from fastapi.responses import StreamingResponse

            async def generate():
                async for chunk in agent.process_message_stream(request.message):
                    import json
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

            return StreamingResponse(generate(), media_type="text/event-stream")
        else:
            # 非流式响应
            response_chunks = []
            async for chunk in agent.process_message_stream(request.message):
                response_chunks.append(chunk)

            return {
                "success": True,
                "response": response_chunks
            }

    except Exception as e:
        logger.error(f"对话处理失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"对话处理失败: {str(e)}")


@router.get("/module/{resume_id}/{module}")
async def get_module_guidance(resume_id: str, module: str):
    """
    获取模块引导问题

    获取特定模块的引导问题和示例
    """
    try:
        from backend.agents.diagnosis import GuidanceEngine
        from backend.services.resume_service import get_resume_data

        # 读取简历数据
        resume_data = await get_resume_data(resume_id)

        # 生成引导问题
        guidance = GuidanceEngine()
        question = guidance.generate_module_question(module, resume_data)

        return {
            "success": True,
            "module": module,
            "question": question
        }

    except Exception as e:
        logger.error(f"获取模块引导失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取模块引导失败: {str(e)}")
