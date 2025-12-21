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


def call_llm(provider: str, prompt: str, return_usage: bool = False):
    """
    统一入口，基于 simple.py 封装 LLM 调用
    在调用前检查必要的 API Key，缺失时返回 400 级错误
    
    参数:
        provider: AI 提供商 ("zhipu" 或 "doubao")
        prompt: 提示词
        return_usage: 是否返回 token 使用信息，默认 False（向后兼容）
    
    返回:
        如果 return_usage=False: 返回字符串（内容）
        如果 return_usage=True: 返回字典 {"content": str, "usage": dict}
    """
    if provider == "zhipu":
        # 优先使用 simple 模块中的 API Key（保存时会立即更新），然后检查环境变量
        key = getattr(simple, "ZHIPU_API_KEY", "") or os.getenv("ZHIPU_API_KEY", "")
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
        result = simple.call_zhipu_api(prompt)
        # call_zhipu_api 现在返回字典
        if return_usage:
            return result
        else:
            # 向后兼容：只返回内容字符串
            if isinstance(result, dict):
                return result.get("content", "")
            return result
    
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
