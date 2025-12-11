"""
Agent 路由 - Reflection Agent API
"""
from fastapi import APIRouter, HTTPException

from models import AgentReflectRequest, QuickFixRequest, VisionAnalyzeRequest
from agent import run_reflection_agent, quick_fix_resume, analyze_resume_screenshot

router = APIRouter(prefix="/api", tags=["Agent"])


@router.post("/agent/reflect")
async def agent_reflect(body: AgentReflectRequest):
    """
    Reflection Agent - 自我反思修正简历数据
    
    工作流程：
    1. 视觉分析截图（如果提供）
    2. 对比原文和当前 JSON
    3. 推理修正错误
    4. 返回修正后的 JSON
    """
    try:
        result = run_reflection_agent(
            original_text=body.original_text,
            current_json=body.current_json,
            screenshot_base64=body.screenshot_base64,
            max_iterations=body.max_iterations
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent 处理失败: {e}")


@router.post("/agent/quick-fix")
async def agent_quick_fix(body: QuickFixRequest):
    """快速修正 - 基于关键词检测修正明显错误（不需要截图）"""
    try:
        fixed = quick_fix_resume(body.original_text, body.current_json)
        return {"fixed_json": fixed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"快速修正失败: {e}")


@router.post("/agent/vision-analyze")
async def agent_vision_analyze(body: VisionAnalyzeRequest):
    """视觉分析 - 使用 GLM-4V 分析简历截图"""
    try:
        analysis = analyze_resume_screenshot(body.screenshot_base64, body.original_text)
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"视觉分析失败: {e}")
