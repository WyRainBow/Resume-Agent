"""
Agent 路由 - CV Tools API

提供 CV 工具自然语言接口：
1. CV 工具自然语言接口（同步）
2. CV 工具自然语言接口（流式）
3. 直接执行工具调用
"""
import json
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

try:
    from backend.models import (
        AgentReflectRequest, QuickFixRequest, VisionAnalyzeRequest,
        TemplateAnalyzeRequest, ConversationRequest, ConversationResponse,
        CVToolCallRequest, CVToolCallResponse
    )
    from backend.agent import run_reflection_agent, quick_fix_resume, analyze_resume_screenshot, analyze_template
    from backend.agents.conversation_agent import conversation_handler
    from backend.agents import create_agent, get_session_manager
    # execute_tool 已移除，使用 ToolExecutor 类代替
except ImportError:
    from models import (
        AgentReflectRequest, QuickFixRequest, VisionAnalyzeRequest,
        TemplateAnalyzeRequest, ConversationRequest, ConversationResponse,
        CVToolCallRequest, CVToolCallResponse
    )
    from agent import run_reflection_agent, quick_fix_resume, analyze_resume_screenshot, analyze_template
    from agents.conversation_agent import conversation_handler
    from agents import create_agent, get_session_manager
    # execute_tool 已移除，使用 ToolExecutor 类代替

router = APIRouter(prefix="/api", tags=["Agent"])


# ==================== 原有路由 ====================

@router.post("/agent/reflect")
async def agent_reflect(body: AgentReflectRequest):
    """Reflection Agent - 自我反思修正简历数据"""
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
    """快速修正 - 基于关键词检测修正明显错误"""
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


@router.post("/agent/template-analyze")
async def agent_template_analyze(body: TemplateAnalyzeRequest):
    """模板分析 - 使用 GLM-4.5V 分析简历预览截图"""
    try:
        result = analyze_template(
            image_base64=body.screenshot_base64,
            current_json=body.current_json
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"模板分析失败: {e}")


@router.post("/agent/conversation", response_model=ConversationResponse)
async def agent_conversation(body: ConversationRequest):
    """对话式简历生成 Agent"""
    try:
        result = await conversation_handler(
            message=body.message,
            step=body.step,
            collected_info=body.collected_info,
            resume_data=body.resume_data
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"对话处理失败: {e}")


# ==================== CV 工具路由 ====================

# 会话 -> Agent 映射（用于维护多轮对话状态）
# 参考 sophia-pro 的会话管理方式，使用内存缓存
_agent_cache: Dict[str, Any] = {}

@router.post("/agent/cv-tools", response_model=CVToolCallResponse)
async def agent_cv_tools(body: CVToolCallRequest):
    """
    CV 工具自然语言接口（同步版本）
    
    将用户的自然语言请求转换为 CVReader/CVEditor 工具调用
    
    示例：
    - "把名字改成张三" → CVEditor(path="basic.name", action="update", value="张三")
    - "查看我的教育经历" → CVReader(path="education")
    
    支持会话管理：通过 session_id 维护多轮对话状态
    - 多轮对话上下文保持（如"我在字节跳动工作过" + "后端开发，2020年到2022年"）
    - Agent 实例缓存，避免每次请求创建新实例
    """
    try:
        # 使用新的 CVAgent（参考 sophia-pro 架构）
        from backend.agents import CVAgent, agent_manager
        
        # 获取或创建会话 ID
        session_id = body.session_id
        if not session_id:
            # 如果没有提供 session_id，生成新的
            import uuid
            session_id = f"sess_{uuid.uuid4().hex[:16]}"
        
        # 使用 AgentManager 获取或创建 agent（支持多轮对话上下文）
        # 注意：只在创建新会话时使用 resume_data，已有会话使用 Agent 自己维护的数据
        actual_session_id, agent = agent_manager.get_or_create(
            session_id=session_id,
            resume_data=body.resume_data  # 仅用于新会话初始化
        )
        
        # ⚠️ 重要：不要在这里覆盖 Agent 的 resume_data！
        # Agent 通过工具调用自己维护数据，前端传的可能是旧数据
        # 之前的 agent.update_resume_data(body.resume_data) 会导致数据被覆盖
        
        # 处理消息
        response = agent.process_message(body.message)
        
        # 构建响应
        tool_call = None
        if response.message.tool_call:
            tool_call = {
                "name": response.message.tool_call.get("name"),
                "params": response.message.tool_call.get("params")
            }
        
        return CVToolCallResponse(
            success=True,
            reply=response.message.content,
            tool_call=tool_call,
            reasoning=None,
            session_id=actual_session_id  # 返回 session_id
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"CV 工具调用失败: {e}")


@router.post("/agent/cv-tools/stream")
async def agent_cv_tools_stream(body: CVToolCallRequest):
    """
    CV 工具自然语言接口（流式版本）
    
    流式返回结果，包括：
    - tool_call: 工具调用信息
    - tool_result: 工具执行结果
    - reply: 给用户的回复
    - done: 处理完成
    """
    async def event_generator():
        try:
            agent = create_agent(resume_data=body.resume_data)
            
            async for event in agent.process_message_stream(body.message):
                yield {
                    "event": event.get("type", "message"),
                    "data": json.dumps(event, ensure_ascii=False)
                }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"type": "error", "content": str(e)}, ensure_ascii=False)
            }
            yield {
                "event": "done",
                "data": json.dumps({"type": "done", "content": None}, ensure_ascii=False)
            }
    
    return EventSourceResponse(event_generator())


@router.post("/agent/cv-tools/execute")
async def agent_cv_tools_execute(body: dict):
    """
    直接执行 CV 工具调用
    
    跳过自然语言解析，直接执行工具调用
    
    请求体：
    {
        "tool_call": {
            "name": "CVReader" | "CVEditor",
            "params": { ... }
        },
        "resume_data": { ... }
    }
    """
    try:
        tool_call = body.get("tool_call")
        resume_data = body.get("resume_data", {})
        
        if not tool_call:
            raise HTTPException(status_code=400, detail="缺少 tool_call 参数")
        
        # 使用新的 ToolExecutor
        from backend.agents.tool_executor import ToolExecutor
        executor = ToolExecutor(resume_data=resume_data)
        
        tool_name = tool_call.get("name", "")
        params = tool_call.get("params", {})
        
        if tool_name == "CVReader":
            result = executor.execute_read(params.get("path", ""))
        elif tool_name == "CVEditor":
            action = params.get("action", "")
            path = params.get("path", "")
            if action == "add":
                result = executor.execute_add(path, params.get("value", {}))
            elif action == "update":
                result = executor.execute_update(path, params.get("value"))
            elif action == "delete":
                result = executor.execute_delete(path)
            else:
                raise HTTPException(status_code=400, detail=f"不支持的操作: {action}")
        else:
            raise HTTPException(status_code=400, detail=f"不支持的工具: {tool_name}")
        
        # 更新 resume_data
        if result.updated_resume:
            resume_data = result.updated_resume
        
        return {
            "success": result.success,
            "result": result.to_dict(),
            "resume_data": resume_data
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"工具执行失败: {e}")


# ==================== 会话管理路由 ====================

@router.post("/agent/session/create")
async def create_session(body: dict):
    """创建新会话"""
    try:
        session_manager = get_session_manager()
        session = session_manager.create_session(
            user_id=body.get("user_id"),
            resume_data=body.get("resume_data")
        )
        return {
            "success": True,
            "session_id": session.session_id,
            "created_at": session.created_at
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建会话失败: {e}")


@router.get("/agent/session/{session_id}")
async def get_session(session_id: str):
    """获取会话信息"""
    try:
        session_manager = get_session_manager()
        session = session_manager.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在或已过期")
        
        return {
            "success": True,
            "session": session.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取会话失败: {e}")


@router.get("/agent/session/{session_id}/history")
async def get_session_history(session_id: str, limit: int = 20):
    """获取会话对话历史"""
    try:
        session_manager = get_session_manager()
        session = session_manager.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在或已过期")
        
        history = session.get_recent_history(limit)
        return {
            "success": True,
            "session_id": session_id,
            "message_count": len(session.chat_history),
            "history": [msg.to_dict() for msg in history]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取历史失败: {e}")


@router.delete("/agent/session/{session_id}")
async def delete_session(session_id: str):
    """删除会话"""
    try:
        session_manager = get_session_manager()
        success = session_manager.delete_session(session_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        return {"success": True, "message": "会话已删除"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除会话失败: {e}")
