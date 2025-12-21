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
import sys
import logging
from pathlib import Path

# 兼容直接以脚本方式运行（无包上下文）时的相对导入问题
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# 加载环境变量
try:
    from dotenv import load_dotenv
    DOTENV_PATH = ROOT_DIR / ".env"
    load_dotenv(dotenv_path=str(DOTENV_PATH), override=True)
    load_dotenv(override=True)
except Exception:
    pass

# 初始化日志系统
from backend.logger import backend_logger, LOGS_DIR, ensure_log_dirs
from datetime import datetime

# 日志文件 handler（延迟初始化）
_log_file_handler = None

def get_log_file_handler():
    """获取日志文件 handler（单例模式）"""
    global _log_file_handler
    if _log_file_handler is None:
        ensure_log_dirs()
        log_file = LOGS_DIR / "backend" / f"{datetime.now().strftime('%Y-%m-%d')}.log"
        _log_file_handler = logging.FileHandler(str(log_file), encoding='utf-8')
        _log_file_handler.setFormatter(logging.Formatter(
            fmt="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        ))
    return _log_file_handler

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 导入路由模块
from .routes import (
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


# 启动时预热 HTTP 连接并配置日志
@app.on_event("startup")
async def startup_event():
    """应用启动时预热连接"""
    from pathlib import Path
    ROOT = Path(__file__).resolve().parents[1]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    
    # 配置 uvicorn 日志输出到文件（只配置一次）
    file_handler = get_log_file_handler()
    for logger_name in ['uvicorn.access', 'uvicorn.error']:
        logger = logging.getLogger(logger_name)
        logger.propagate = False  # 禁止传播到父 logger，避免重复
        # 移除所有 FileHandler，然后添加我们的
        logger.handlers = [h for h in logger.handlers if not isinstance(h, logging.FileHandler)]
        logger.addHandler(file_handler)
    
    backend_logger.info("========== 后端服务启动 ==========")
    backend_logger.info(f"日志目录: {LOGS_DIR}")
    
    try:
        import simple
        # 从环境变量同步 API Key 到 simple 模块
        zhipu_key = os.getenv("ZHIPU_API_KEY", "")
        if zhipu_key:
            simple.ZHIPU_API_KEY = zhipu_key
            simple._zhipu_client = None  # 重置客户端，使用新的 API Key
            simple._last_zhipu_key = None
            backend_logger.info(f"[配置] 已从 .env 加载 ZHIPU_API_KEY: {zhipu_key[:10]}...")
        
        doubao_key = os.getenv("DOUBAO_API_KEY", "")
        if doubao_key:
            simple.DOUBAO_API_KEY = doubao_key
            backend_logger.info(f"[配置] 已从 .env 加载 DOUBAO_API_KEY: {doubao_key[:10]}...")
        
        simple.warmup_connection()
        backend_logger.info("[启动优化] HTTP 连接已预热")
    except Exception as e:
        backend_logger.warning(f"[启动优化] 连接预热失败: {e}")


"""
本地运行：
1) 安装依赖：pip3 install -r backend/requirements.txt --break-system-packages
2) 启动服务：uvicorn backend.main:app --reload --port 8000
3) 测试接口：
   - 健康：curl http://127.0.0.1:8000/api/health | cat
   - AI测试：curl -X POST http://127.0.0.1:8000/api/ai/test -H 'Content-Type: application/json' -d '{"provider":"doubao","prompt":"用一句话介绍人工智能"}' | cat
"""
