"""
FastAPI 后端入口
模块化重构版本

提供：
1) /api/health 健康检查
2) /api/ai/test 测试现有 LLM 是否可用
3) /api/resume/generate 一句话 → 结构化简历 JSON
4) /api/pdf/render 由简历 JSON 生成 PDF

启动命令：uvicorn backend.main:app --reload --port 8000
"""
import os
from pathlib import Path

# 加载环境变量
try:
    from dotenv import load_dotenv
    ROOT_DIR = Path(__file__).resolve().parents[1]
    DOTENV_PATH = ROOT_DIR / ".env"
    load_dotenv(dotenv_path=str(DOTENV_PATH), override=True)
    load_dotenv(override=True)
except Exception:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 导入路由模块
from routes import (
    health_router,
    config_router,
    resume_router,
    agent_router,
    pdf_router
)

# 初始化 FastAPI 应用
app = FastAPI(title="Resume Agent API")

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(health_router)
app.include_router(config_router)
app.include_router(resume_router)
app.include_router(agent_router)
app.include_router(pdf_router)


# 启动时预热 HTTP 连接
@app.on_event("startup")
async def startup_event():
    """应用启动时预热连接"""
    import sys
    from pathlib import Path
    ROOT = Path(__file__).resolve().parents[1]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    try:
        import simple
        simple.warmup_connection()
        print("[启动优化] HTTP 连接已预热")
    except Exception as e:
        print(f"[启动优化] 连接预热失败: {e}")


"""
本地运行：
1) 安装依赖：pip3 install -r backend/requirements.txt --break-system-packages
2) 启动服务：uvicorn backend.main:app --reload --port 8000
3) 测试接口：
   - 健康：curl http://127.0.0.1:8000/api/health | cat
   - AI测试：curl -X POST http://127.0.0.1:8000/api/ai/test -H 'Content-Type: application/json' -d '{"provider":"doubao","prompt":"用一句话介绍人工智能"}' | cat
"""
