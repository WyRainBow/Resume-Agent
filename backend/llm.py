"""
LLM 调用封装
统一入口，基于 simple.py 封装 LLM 调用
"""
import os
import sys
from pathlib import Path
from fastapi import HTTPException

# 将项目根目录加入 sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

try:
    import simple
except Exception as e:
    raise RuntimeError(f"无法导入 simple.py: {e}")

# 全局 AI 配置
DEFAULT_AI_PROVIDER = "zhipu"
DEFAULT_AI_MODEL = {
    "zhipu": "glm-4.5v"
}


def call_llm(provider: str, prompt: str) -> str:
    """
    统一入口，基于 simple.py 封装 LLM 调用
    在调用前检查必要的 API Key，缺失时返回 400 级错误
    """
    if provider == "zhipu":
        key = os.getenv("ZHIPU_API_KEY") or getattr(simple, "ZHIPU_API_KEY", "")
        if not key:
            raise HTTPException(
                status_code=400, 
                detail="缺少 ZHIPU_API_KEY，请在项目根目录 .env 或系统环境中配置 ZHIPU_API_KEY"
            )
        # 如果 API Key 变化，重置客户端实例
        old_key = getattr(simple, "ZHIPU_API_KEY", "")
        simple.ZHIPU_API_KEY = key
        if old_key != key:
            # 重置客户端实例，强制重新创建
            simple._zhipu_client = None
            simple._last_zhipu_key = None
        return simple.call_zhipu_api(prompt)
    
    elif provider == "doubao":
        key = os.getenv("DOUBAO_API_KEY") or getattr(simple, "DOUBAO_API_KEY", "")
        if not key:
            raise HTTPException(
                status_code=400, 
                detail="缺少 DOUBAO_API_KEY，请在项目根目录 .env 或系统环境中配置 DOUBAO_API_KEY"
            )
        simple.DOUBAO_API_KEY = key
        simple.DOUBAO_MODEL = os.getenv("DOUBAO_MODEL", simple.DOUBAO_MODEL)
        simple.DOUBAO_BASE_URL = os.getenv("DOUBAO_BASE_URL", simple.DOUBAO_BASE_URL)
        return simple.call_doubao_api(prompt)
    
    else:
        raise ValueError("不支持的 provider")


def call_llm_stream(provider: str, prompt: str):
    """
    流式调用 LLM，返回生成器
    """
    if provider == "doubao":
        key = os.getenv("DOUBAO_API_KEY") or getattr(simple, "DOUBAO_API_KEY", "")
        if not key:
            raise HTTPException(
                status_code=400, 
                detail="缺少 DOUBAO_API_KEY"
            )
        simple.DOUBAO_API_KEY = key
        simple.DOUBAO_MODEL = os.getenv("DOUBAO_MODEL", simple.DOUBAO_MODEL)
        simple.DOUBAO_BASE_URL = os.getenv("DOUBAO_BASE_URL", simple.DOUBAO_BASE_URL)
        
        for chunk in simple.call_doubao_api_stream(prompt):
            yield chunk
    
    elif provider == "zhipu":
        result = call_llm(provider, prompt)
        yield result
    
    else:
        raise ValueError("不支持的 provider")


def get_ai_config():
    """获取当前 AI 配置"""
    return {
        "defaultProvider": DEFAULT_AI_PROVIDER,
        "defaultModel": DEFAULT_AI_MODEL.get(DEFAULT_AI_PROVIDER, ""),
        "models": DEFAULT_AI_MODEL
    }
