"""
FastAPI 后端入口
模块化重构版本

提供：
1) /api/health 健康检查
2) /api/ai/test 测试现有 LLM 是否可用
3) /api/resume/generate 一句话 → 结构化简历 JSON
4) /api/pdf/render 由简历 JSON 生成 PDF

启动命令：uvicorn backend.main:app --reload --port 9000
"""
import os
import sys
import importlib
from pathlib import Path

# 兼容多种启动方式（uvicorn backend.main:app 或 uvicorn main:app）
# 确保项目根目录与 backend 目录都在 sys.path
CURRENT_DIR = Path(__file__).resolve().parent            # .../backend
PROJECT_ROOT = CURRENT_DIR.parent                        # 项目根 /app
for p in [PROJECT_ROOT, CURRENT_DIR]:
    p_str = str(p)
    if p_str not in sys.path:
        sys.path.insert(0, p_str)

# 加载环境变量
try:
    from dotenv import load_dotenv
    DOTENV_PATH = PROJECT_ROOT / ".env"
    load_dotenv(dotenv_path=str(DOTENV_PATH), override=True)
    load_dotenv(override=True)
except Exception:
    pass

from backend.core.logger import bridge_std_logging_to_loguru, get_logger, setup_logging
from backend.agent.config import config

setup_logging(
    is_production=(config.log_mode == "production"),
    log_level=config.log_level,
    log_dir=config.log_dir,
)
logger = get_logger(__name__)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

def import_module_candidates(candidates):
    """按候选列表依次尝试导入模块，避免多层嵌套 try/except。"""
    last_exc: Exception | None = None
    for name in candidates:
        try:
            return importlib.import_module(name)
        except ModuleNotFoundError as exc:
            last_exc = exc
            continue
    raise last_exc or ModuleNotFoundError(f"Cannot import any of: {candidates}")


# 导入路由模块（兼容包/脚本两种运行方式），优先使用绝对路径
routes_module = import_module_candidates(["backend.routes", "routes"])
health_router = routes_module.health_router
config_router = routes_module.config_router
resume_router = routes_module.resume_router
pdf_router = routes_module.pdf_router
share_router = routes_module.share_router
auth_router = routes_module.auth_router
resumes_router = routes_module.resumes_router

# 初始化 FastAPI 应用
app = FastAPI(title="Resume API")

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
app.include_router(pdf_router)
app.include_router(share_router)
app.include_router(auth_router)
app.include_router(resumes_router)

# 注册 OpenManus 路由（合并后）
try:
    from backend.agent.web.routes import api_router as openmanus_router
    app.include_router(openmanus_router, prefix="/api/agent")
    logger.info("[合并] OpenManus 路由已加载，前缀: /api/agent")
except Exception as exc:
    # 如果是缺少可选依赖（如 browser-use），只记录警告，不影响其他功能
    if "browser_use" in str(exc) or "browser-use" in str(exc):
        logger.warning(f"[合并] OpenManus 路由未加载（缺少可选依赖）: {exc}")
    else:
        logger.warning(f"[合并] OpenManus 路由未加载: {exc}")


# 启动时预热 HTTP 连接并配置日志
@app.on_event("startup")
async def startup_event():
    """应用启动时预热连接"""
    from pathlib import Path
    from backend.agent.config import config as agent_config
    ROOT = Path(__file__).resolve().parents[1]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    
    setup_logging(
        is_production=(agent_config.log_mode == "production"),
        log_level=agent_config.log_level,
        log_dir=agent_config.log_dir,
    )
    bridge_std_logging_to_loguru(level=agent_config.log_level)

    logger.info("========== 后端服务启动 ==========")
    logger.info(f"日志目录: {agent_config.log_dir}")
    
    try:
        simple = import_module_candidates(["backend.simple", "simple"])
        # 从环境变量同步 API Key 到 simple 模块
        zhipu_key = os.getenv("ZHIPU_API_KEY", "")
        if zhipu_key:
            simple.ZHIPU_API_KEY = zhipu_key
            simple._zhipu_client = None  # 重置客户端，使用新的 API Key
            simple._last_zhipu_key = None
            logger.info(f"[配置] 已从 .env 加载 ZHIPU_API_KEY: {zhipu_key[:10]}...")
        
        doubao_key = os.getenv("DOUBAO_API_KEY", "")
        if doubao_key:
            simple.DOUBAO_API_KEY = doubao_key
            logger.info(f"[配置] 已从 .env 加载 DOUBAO_API_KEY: {doubao_key[:10]}...")
        
        deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
        if deepseek_key:
            simple.DEEPSEEK_API_KEY = deepseek_key
            logger.info(f"[配置] 已从 .env 加载 DEEPSEEK_API_KEY: {deepseek_key[:10]}...")
        
        simple.warmup_connection()
        logger.info("[启动优化] HTTP 连接已预热")
    except Exception as e:
        logger.warning(f"[启动优化] 连接预热失败: {e}")

    # 预加载 tiktoken 编码文件，避免首次请求时下载阻塞（使用配置管理器）
    try:
        import tiktoken
        from backend.agent.config import NetworkConfig, config

        network_config = config.network if hasattr(config, 'network') and config.network else NetworkConfig()
        if network_config.disable_proxy_for_tiktoken:
            logger.info("[启动优化] 预加载 tiktoken 编码文件（禁用代理）...")
            with network_config.without_proxy():
                tiktoken.get_encoding("cl100k_base")
            logger.info("[启动优化] tiktoken 编码文件预加载完成")
        else:
            logger.info("[启动优化] 预加载 tiktoken 编码文件...")
            tiktoken.get_encoding("cl100k_base")
            logger.info("[启动优化] tiktoken 编码文件预加载完成")
    except Exception as e:
        logger.warning(f"[启动优化] tiktoken 预加载失败: {e}（将在首次使用时加载）")


"""
本地运行：
1) 安装依赖：uv pip install -r requirements.txt
2) 启动服务：uvicorn backend.main:app --reload --port 9000
3) 测试接口：
   - 健康：curl http://127.0.0.1:9000/api/health | cat
   - AI测试：curl -X POST http://127.0.0.1:9000/api/ai/test -H 'Content-Type: application/json' -d '{"provider":"doubao","prompt":"用一句话介绍人工智能"}' | cat
"""
