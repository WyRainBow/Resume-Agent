"""
CV Agent API 路由

提供新版 Agent 的 API 接口：
- POST /api/cv-agent/chat - 对话接口
- POST /api/cv-agent/chat/stream - 流式对话接口
- GET /api/cv-agent/session/{session_id} - 获取会话信息
- DELETE /api/cv-agent/session/{session_id} - 删除会话
"""
from typing import Any, Dict, List, Optional
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from ..agents import (
    agent_manager,
    CVAgent,
    MessageType
)


router = APIRouter(prefix="/api/cv-agent", tags=["CV Agent"])


# ========== 请求/响应模型 ==========

class ChatRequest(BaseModel):
    """对话请求"""
    message: str = Field(..., description="用户消息")
    session_id: Optional[str] = Field(None, description="会话 ID（可选，不传则创建新会话）")
    resume_data: Optional[Dict[str, Any]] = Field(None, description="当前简历数据")
    capability: Optional[str] = Field(None, description="能力包名称: base|advanced|optimizer")


class ChatResponse(BaseModel):
    """对话响应"""
    session_id: str = Field(..., description="会话 ID")
    type: str = Field(..., description="消息类型: text|tool_call|tool_result|clarify|error")
    content: str = Field(..., description="回复内容")
    tool_call: Optional[Dict[str, Any]] = Field(None, description="工具调用信息")
    tool_result: Optional[Dict[str, Any]] = Field(None, description="工具执行结果")
    thinking: Optional[str] = Field(None, description="思考过程")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")
    resume_data: Optional[Dict[str, Any]] = Field(None, description="更新后的简历数据")
    resume_modified: bool = Field(False, description="简历是否被修改")


class SessionInfo(BaseModel):
    """会话信息"""
    session_id: str
    created_at: float
    last_active: float
    agent_state: Dict[str, Any]


class SessionListResponse(BaseModel):
    """会话列表响应"""
    sessions: List[Dict[str, Any]]
    total: int


# ========== API 端点 ==========

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    对话接口

    支持多轮对话，通过 session_id 维护对话状态。

    新增：支持 Capability 能力包配置

    示例请求：
    ```json
    {
        "message": "添加工作经历，在腾讯做前端开发",
        "session_id": null,
        "resume_data": {},
        "capability": "advanced"
    }
    ```

    示例响应（需要补充信息）：
    ```json
    {
        "session_id": "sess_abc123",
        "type": "clarify",
        "content": "已识别：公司=腾讯, 职位=前端开发。请补充：开始时间、结束时间",
        "metadata": {
            "intent": "add",
            "module": "workExperience",
            "missing_fields": ["startDate", "endDate"]
        }
    }
    ```
    """
    try:
        # 获取或创建 Agent（传递 capability 参数）
        session_id, agent = agent_manager.get_or_create(
            session_id=request.session_id,
            resume_data=request.resume_data,
            capability=request.capability
        )
        
        # 处理消息
        response = agent.process_message(request.message)
        
        # 构建响应
        msg = response.message
        return ChatResponse(
            session_id=session_id,
            type=msg.type.value,
            content=msg.content,
            tool_call=msg.tool_call,
            tool_result=msg.tool_result,
            thinking=msg.thinking,  # 思考过程
            metadata=msg.metadata if msg.metadata else None,
            resume_data=response.resume_data if response.resume_modified else None,
            resume_modified=response.resume_modified
        )
    
    except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"处理消息失败: {str(e)}")


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    流式对话接口

    逐步返回：
    - thinking: 思考过程
    - tool_call: 工具调用
    - tool_result: 工具执行结果
    - content: 最终回复
    - done: 完成

    新增：支持 Capability 能力包配置

    使用 SSE (Server-Sent Events) 格式
    """
    import asyncio
    import queue
    import threading

    async def event_generator():
        try:
            # 获取或创建 Agent（传递 capability 参数）
            session_id, agent = agent_manager.get_or_create(
                session_id=request.session_id,
                resume_data=request.resume_data,
                capability=request.capability
            )
            
            # 使用队列来传递事件（解决同步生成器阻塞异步事件循环的问题）
            event_queue = queue.Queue()
            
            def run_sync_generator():
                """在后台线程中运行同步生成器"""
                try:
                    for event in agent.process_message_stream(request.message):
                        event_queue.put(event)
                    event_queue.put(None)  # 结束标记
                except Exception as e:
                    event_queue.put({"type": "error", "content": str(e)})
                    event_queue.put(None)
            
            # 在后台线程中启动同步生成器
            thread = threading.Thread(target=run_sync_generator)
            thread.start()
            
            # 异步读取队列中的事件
            while True:
                # 使用 asyncio.to_thread 来非阻塞地从队列中获取事件
                try:
                    event = await asyncio.to_thread(lambda: event_queue.get(timeout=0.1))
                except queue.Empty:
                    # 队列为空，继续等待
                    await asyncio.sleep(0.01)
                    continue
                except Exception:
                    # 其他异常，继续等待
                    await asyncio.sleep(0.01)
                    continue
                
                if event is None:
                    break
                
                # 构建 SSE 事件
                event_data = {
                    "type": event.get("type", "message"),
                    "content": event.get("content"),
                    "session_id": session_id
                }
                
                # 添加额外字段
                if "resume_modified" in event:
                    event_data["resume_modified"] = event["resume_modified"]
                if "resume_data" in event:
                    event_data["resume_data"] = event["resume_data"]
                if "metadata" in event:
                    event_data["metadata"] = event["metadata"]
                
                yield {
                    "event": event.get("type", "message"),
                    "data": json.dumps(event_data, ensure_ascii=False)
                }
            
            # 等待线程结束
            thread.join()
            
            # 发送完成事件
            yield {
                "event": "done",
                "data": json.dumps({
                    "type": "done",
                    "session_id": session_id
                }, ensure_ascii=False)
            }
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "content": str(e)
                }, ensure_ascii=False)
            }
            yield {
                "event": "done",
                "data": json.dumps({
                    "type": "done"
                }, ensure_ascii=False)
            }
    
    return EventSourceResponse(event_generator())


@router.get("/session/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    """获取会话信息"""
    info = agent_manager.get_session_info(session_id)
    if not info:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    return SessionInfo(**info)


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """删除会话"""
    if agent_manager.remove(session_id):
        return {"success": True, "message": "会话已删除"}
    raise HTTPException(status_code=404, detail="会话不存在")


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions():
    """列出所有会话"""
    sessions = agent_manager.list_sessions()
    return SessionListResponse(
        sessions=sessions,
        total=len(sessions)
    )


@router.get("/stats")
async def get_stats():
    """获取统计信息"""
    return agent_manager.get_stats()


@router.post("/clear-all")
async def clear_all_sessions():
    """清空所有会话"""
    count = agent_manager.clear_all()
    return {"success": True, "cleared": count}

