"""
OpenManus Web Server - HTTP + SSE architecture.

This server provides:
- SSE endpoint for agent interaction with real-time streaming
- HTTP API for resume data management
- HTTP API for chat history and checkpoint management

Architecture:
- Uses SSE (Server-Sent Events) for real-time streaming (replacing WebSocket)
- Uses StreamProcessor for agent execution streaming
- Uses modular routes for HTTP API endpoints
"""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.core.logger import get_logger

logger = get_logger(__name__)
from backend.agent.schema import Message, Role

# Import modular routes (includes SSE streaming)
from backend.agent.web.routes import api_router


# 定义消息类型
class AgentMessage(BaseModel):
    type: str  # "thought", "tool_call", "tool_result", "answer", "error"
    content: str
    step: int = 0


app = FastAPI(
    title="OpenManus API",
    description="Resume optimization agent with real-time SSE streaming",
    version="3.0.0",
)

# 允许跨域（方便前端开发）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include modular routes (includes /api/stream for SSE)
app.include_router(api_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "transport": "sse"}


@app.post("/api/frontend-log")
async def log_frontend_event(event: dict):
    """接收前端日志并保存到文件"""
    try:
        from pathlib import Path
        from datetime import datetime

        # 获取当前日期
        current_date = datetime.now().strftime("%Y%m%d")
        log_dir = Path(__file__).parent.parent.parent / "logs" / "frontend"
        log_dir.mkdir(parents=True, exist_ok=True)

        log_file = log_dir / f"{current_date}-frontend.log"

        # 格式化日志条目
        timestamp = event.get("timestamp", datetime.now().isoformat())
        level = event.get("level", "info").upper()
        message = event.get("message", "")
        data = event.get("data")

        # 构建日志行
        log_line = f"{timestamp} | {level} | {message}"
        if data:
            log_line += f" | {str(data)[:200]}"  # 限制数据长度

        # 写入日志文件
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_line + "\n")

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Failed to write frontend log: {e}")
        return {"status": "error", "message": str(e)}


# 全局简历数据存储（用于前后端同步）
_global_resume_data = {}


@app.get("/api/resume")
async def get_resume_data():
    """获取当前加载的简历数据

    优先级:
    1. ResumeDataStore 中的数据（AI 编辑后的最新数据）
    2. 从 md 文件解析（首次加载或 ResumeDataStore 为空）
    """
    from backend.agent.utils.resume_parser import parse_markdown_resume
    from backend.agent.tool.resume_data_store import ResumeDataStore
    from pathlib import Path

    # 🔑 优先返回内存中的数据（AI 编辑后的最新数据）
    stored_data = ResumeDataStore.get_data()
    if stored_data and stored_data.get("basic") and stored_data["basic"].get("name"):
        logger.debug(f"✅ 返回 ResumeDataStore 中的数据: {stored_data.get('basic', {}).get('name')}")
        return {"data": stored_data, "source": "memory"}

    # Fallback: 从 md 文件解析
    resume_path = Path("app/docs/韦宇_简历.md")
    if not resume_path.exists():
        return {"data": {}, "source": "none"}

    try:
        data = parse_markdown_resume(str(resume_path))
        logger.debug(f"📄 从 md 文件解析数据: {data.get('basic', {}).get('name')}")
        return {"data": data, "source": "file"}
    except Exception as e:
        logger.error(f"Error parsing resume: {e}")
        return {"data": {}, "source": "error"}


def _clean_resume_data(data: dict) -> dict:
    """清理简历数据，确保可以 JSON 序列化

    移除 Pydantic 模型的私有属性
    """
    if not isinstance(data, dict):
        return data

    result = {}
    for key, value in data.items():
        # 跳过私有属性和特殊属性
        if key.startswith("_") or key in ["__pydantic_private__", "__pydantic_extra__"]:
            continue
        if isinstance(value, dict):
            result[key] = _clean_resume_data(value)
        elif isinstance(value, list):
            result[key] = [_clean_resume_data(item) if isinstance(item, dict) else item for item in value]
        else:
            result[key] = value
    return result


@app.post("/api/resume")
async def set_resume_data(data: dict):
    """设置简历数据"""
    global _global_resume_data
    _global_resume_data = data

    # 同步更新到所有需要简历数据的工具
    from backend.agent.tool.cv_reader_agent_tool import CVReaderAgentTool
    from backend.agent.tool.cv_analyzer_agent_tool import CVAnalyzerAgentTool
    from backend.agent.tool.cv_editor_agent_tool import CVEditorAgentTool

    CVReaderAgentTool.set_resume_data(_global_resume_data)
    CVAnalyzerAgentTool.set_resume_data(_global_resume_data)
    CVEditorAgentTool.set_resume_data(_global_resume_data)

    return {"success": True, "message": "Resume data updated"}


# 全局存储 CheckpointSaver 和 ChatHistory 实例
_global_checkpoint_saver = None
_global_chat_history = None
_global_conversation_manager = None


def get_checkpoint_saver():
    """获取全局 CheckpointSaver 实例"""
    global _global_checkpoint_saver
    if _global_checkpoint_saver is None:
        from backend.agent.memory import CheckpointSaver
        _global_checkpoint_saver = CheckpointSaver()
    return _global_checkpoint_saver


def get_chat_history_sync():
    """获取全局 ChatHistory 实例 (同步版本)"""
    global _global_chat_history
    if _global_chat_history is None:
        from backend.agent.memory import ChatHistoryManager
        from backend.agent.cltp.storage.conversation_storage import FileConversationStorage
        _global_chat_history = ChatHistoryManager(
            session_id="default",
            storage=FileConversationStorage(),
        )
    return _global_chat_history


@app.get("/api/history/chat")
async def get_chat_history_api():
    """获取对话历史"""
    try:
        chat_history = get_chat_history_sync()
        messages = chat_history.get_messages()

        # 转换为前端格式
        history_messages = []
        for msg in messages:
            history_messages.append({
                "role": msg.role.value,  # user | assistant | system
                "content": msg.content or "",
                "timestamp": getattr(msg, 'timestamp', None)
            })

        return {"messages": history_messages}
    except Exception as e:
        logger.error(f"Error getting chat history: {e}")
        return {"messages": []}


@app.get("/api/history/checkpoints")
async def get_checkpoint_history():
    """获取 Checkpoint 版本历史"""
    try:
        checkpoint_saver = get_checkpoint_saver()
        versions = checkpoint_saver.list_versions()

        return {"checkpoints": versions}
    except Exception as e:
        logger.error(f"Error getting checkpoint history: {e}")
        return {"checkpoints": []}


@app.post("/api/history/rollback/{version}")
async def rollback_to_version(version: int):
    """回滚到指定版本"""
    try:
        checkpoint_saver = get_checkpoint_saver()
        resume_snapshot = checkpoint_saver.rollback(version)

        if resume_snapshot:
            # 更新全局简历数据
            global _global_resume_data
            _global_resume_data = {
                "raw_content": resume_snapshot.raw_content,
                "sections": resume_snapshot.sections
            }

            return {
                "success": True,
                "version": version,
                "message": f"已回滚到版本 {version}"
            }
        else:
            return {"success": False, "message": "版本不存在"}
    except Exception as e:
        logger.error(f"Error rolling back to version {version}: {e}")
        return {"success": False, "message": str(e)}


# 获取项目根目录
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND_DIST = os.path.join(PROJECT_ROOT, "frontend", "dist")

# 挂载前端构建产物
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
    logger.info(f"静态文件已挂载: {FRONTEND_DIST}")
else:
    logger.warning(f"前端构建目录不存在: {FRONTEND_DIST}")
    # 提供一个简单的首页
    @app.get("/")
    async def root():
        return {
            "message": "OpenManus API 服务已启动",
            "transport": "SSE (Server-Sent Events)",
            "endpoints": {
                "stream": "POST /api/stream - SSE streaming endpoint",
                "health": "GET /api/health - Health check",
            },
            "note": "前端未构建，请先运行 cd frontend && npm run build"
        }

if __name__ == "__main__":
    import uvicorn
    PORT = 8080
    print("========================================")
    print("  OpenManus Web 服务器 (SSE)")
    print("========================================")
    print(f"传输协议: SSE (Server-Sent Events)")
    print(f"前端目录: {FRONTEND_DIST}")
    print(f"前端存在: {os.path.exists(FRONTEND_DIST)}")
    print(f"访问地址: http://localhost:{PORT}")
    print(f"SSE 端点: POST http://localhost:{PORT}/api/stream")
    print("========================================")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
