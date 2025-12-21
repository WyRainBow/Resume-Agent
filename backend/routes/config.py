"""
配置管理路由
"""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from ..models import SaveKeysRequest, AITestRequest, ChatRequest
from ..llm import call_llm, get_ai_config

router = APIRouter(prefix="/api", tags=["Config"])

ROOT_DIR = Path(__file__).resolve().parents[2]


@router.get("/ai/config")
async def get_ai_config_endpoint():
    """获取当前 AI 配置"""
    return get_ai_config()


@router.get("/config/keys")
async def get_keys_status():
    """获取 API Key 配置状态（不返回完整 Key，只返回是否已配置）"""
    zhipu_key = os.getenv("ZHIPU_API_KEY", "")
    doubao_key = os.getenv("DOUBAO_API_KEY", "")
    
    return {
        "zhipu": {
            "configured": bool(zhipu_key and len(zhipu_key) > 10),
            "preview": f"{zhipu_key[:8]}..." if zhipu_key and len(zhipu_key) > 10 else ""
        },
        "doubao": {
            "configured": bool(doubao_key and len(doubao_key) > 10),
            "preview": f"{doubao_key[:8]}..." if doubao_key and len(doubao_key) > 10 else ""
        }
    }


@router.post("/config/keys")
async def save_keys(body: SaveKeysRequest):
    """保存 API Key 到 .env 文件"""
    try:
        env_path = ROOT_DIR / ".env"
        
        existing_lines = []
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                existing_lines = f.readlines()
        
        new_lines = []
        zhipu_found = False
        doubao_found = False
        
        for line in existing_lines:
            if line.startswith("ZHIPU_API_KEY=") and body.zhipu_key:
                new_lines.append(f"ZHIPU_API_KEY={body.zhipu_key}\n")
                zhipu_found = True
            elif line.startswith("DOUBAO_API_KEY=") and body.doubao_key:
                new_lines.append(f"DOUBAO_API_KEY={body.doubao_key}\n")
                doubao_found = True
            else:
                new_lines.append(line)
        
        if body.zhipu_key and not zhipu_found:
            new_lines.append(f"ZHIPU_API_KEY={body.zhipu_key}\n")
        if body.doubao_key and not doubao_found:
            new_lines.append(f"DOUBAO_API_KEY={body.doubao_key}\n")
        
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
        
        if load_dotenv:
            load_dotenv(dotenv_path=str(env_path), override=True)
        
        # 重置智谱客户端实例，强制使用新的 API Key
        if body.zhipu_key:
            try:
                import simple
                simple._zhipu_client = None
                simple._last_zhipu_key = None
                # 更新 simple 模块中的 API Key
                simple.ZHIPU_API_KEY = body.zhipu_key
            except Exception as e:
                print(f"[警告] 重置智谱客户端失败: {e}")
        
        return {"success": True, "message": "API Key 已保存"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@router.post("/ai/test")
async def ai_test(body: AITestRequest):
    """测试已有 AI 接口是否可用"""
    try:
        result = call_llm(body.provider, body.prompt, return_usage=True)
        if isinstance(result, dict):
            return {
                "provider": body.provider,
                "result": result.get("content", ""),
                "usage": result.get("usage", {})
            }
        else:
            # 向后兼容
            return {"provider": body.provider, "result": result, "usage": {}}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 测试失败: {e}")


@router.post("/chat")
async def chat_api(body: ChatRequest):
    """通用聊天接口，用于AI改写等功能"""
    try:
        prompt_parts = []
        for msg in body.messages:
            if msg.role == "system":
                prompt_parts.append(f"系统指令：{msg.content}")
            elif msg.role == "user":
                prompt_parts.append(f"用户：{msg.content}")
            elif msg.role == "assistant":
                prompt_parts.append(f"助手：{msg.content}")
        
        prompt = "\n\n".join(prompt_parts) + "\n\n请回复："
        
        provider = body.provider
        if not provider:
            if os.getenv("ZHIPU_API_KEY"):
                provider = "zhipu"
            elif os.getenv("DOUBAO_API_KEY"):
                provider = "doubao"
            else:
                raise HTTPException(status_code=400, detail="未配置 AI 服务 API Key")
        
        result = call_llm(provider, prompt)
        return {"content": result, "provider": provider}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 请求失败: {e}")
