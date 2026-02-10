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

# 统一优先使用绝对导入，兼容本地/线上
try:
    from backend.models import SaveKeysRequest, AITestRequest, ChatRequest
    from backend.llm import call_llm, get_ai_config
except ImportError:  # fallback: 当运行于 backend 包内（如 uvicorn main:app）
    from models import SaveKeysRequest, AITestRequest, ChatRequest
    from llm import call_llm, get_ai_config

router = APIRouter(prefix="/api", tags=["Config"])

ROOT_DIR = Path(__file__).resolve().parents[2]


@router.get("/ai/config")
async def get_ai_config_endpoint():
    """获取当前 AI 配置"""
    return get_ai_config()


@router.get("/config/keys")
async def get_keys_status():
    """获取 API Key 配置状态（不返回完整 Key，只返回是否已配置）"""
    # 直接从 .env 文件读取，不依赖环境变量
    env_path = ROOT_DIR / ".env"
    zhipu_key = ""
    doubao_key = ""
    deepseek_key = ""
    
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, value = line.split("=", 1)
                        key = key.strip()
                        value = value.strip().strip('"').strip("'")
                        if key == "ZHIPU_API_KEY":
                            zhipu_key = value
                        elif key == "DOUBAO_API_KEY":
                            doubao_key = value
                        elif key == "DASHSCOPE_API_KEY":
                            deepseek_key = value
        except Exception:
            # 如果读取失败，回退到环境变量
            zhipu_key = os.getenv("ZHIPU_API_KEY", "")
            doubao_key = os.getenv("DOUBAO_API_KEY", "")
            deepseek_key = os.getenv("DASHSCOPE_API_KEY", "")
    else:
        # 如果 .env 不存在，回退到环境变量
        zhipu_key = os.getenv("ZHIPU_API_KEY", "")
        doubao_key = os.getenv("DOUBAO_API_KEY", "")
        deepseek_key = os.getenv("DASHSCOPE_API_KEY", "")

    return {
        "zhipu": {
            "configured": bool(zhipu_key and len(zhipu_key) > 10),
            "preview": f"{zhipu_key[:8]}..." if zhipu_key and len(zhipu_key) > 10 else ""
        },
        "doubao": {
            "configured": bool(doubao_key and len(doubao_key) > 10),
            "preview": f"{doubao_key[:8]}..." if doubao_key and len(doubao_key) > 10 else ""
        },
        "deepseek": {
            "configured": bool(deepseek_key and len(deepseek_key) > 10),
            "preview": f"{deepseek_key[:8]}..." if deepseek_key and len(deepseek_key) > 10 else ""
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
        deepseek_found = False

        for line in existing_lines:
            if line.startswith("ZHIPU_API_KEY=") and body.zhipu_key:
                new_lines.append(f"ZHIPU_API_KEY={body.zhipu_key}\n")
                zhipu_found = True
            elif line.startswith("DOUBAO_API_KEY=") and body.doubao_key:
                new_lines.append(f"DOUBAO_API_KEY={body.doubao_key}\n")
                doubao_found = True
            elif line.startswith("DASHSCOPE_API_KEY=") and body.deepseek_key:
                new_lines.append(f"DASHSCOPE_API_KEY={body.deepseek_key}\n")
                deepseek_found = True
            else:
                new_lines.append(line)

        if body.zhipu_key and not zhipu_found:
            new_lines.append(f"ZHIPU_API_KEY={body.zhipu_key}\n")
        if body.doubao_key and not doubao_found:
            new_lines.append(f"DOUBAO_API_KEY={body.doubao_key}\n")
        if body.deepseek_key and not deepseek_found:
            new_lines.append(f"DASHSCOPE_API_KEY={body.deepseek_key}\n")

        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

        if load_dotenv:
            load_dotenv(dotenv_path=str(env_path), override=True)

        # 重置智谱客户端实例，强制使用新的 API Key
        if body.zhipu_key:
            try:
                try:
                    from backend import simple
                except ImportError:
                    import simple
                simple._zhipu_client = None
                simple._last_zhipu_key = None
                # 更新 simple 模块中的 API Key
                simple.ZHIPU_API_KEY = body.zhipu_key
            except Exception as e:
                print(f"[警告] 重置智谱客户端失败: {e}")

        # 更新 DeepSeek API Key
        if body.deepseek_key:
            try:
                try:
                    from backend import simple
                except ImportError:
                    import simple
                simple.DEEPSEEK_API_KEY = body.deepseek_key
            except Exception as e:
                print(f"[警告] 更新 DeepSeek API Key 失败: {e}")

        return {"success": True, "message": "API Key 已保存"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@router.get("/ai/test-keys")
async def test_ai_keys():
    """检测各 API Key 是否可用：对已配置的 Key 分别发起一次最小调用"""
    env_path = ROOT_DIR / ".env"
    zhipu_key = ""
    doubao_key = ""
    deepseek_key = ""
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    key, value = key.strip(), value.strip().strip('"').strip("'")
                    if key == "ZHIPU_API_KEY":
                        zhipu_key = value
                    elif key == "DOUBAO_API_KEY":
                        doubao_key = value
                    elif key == "DASHSCOPE_API_KEY":
                        deepseek_key = value
        except Exception:
            zhipu_key = os.getenv("ZHIPU_API_KEY", "")
            doubao_key = os.getenv("DOUBAO_API_KEY", "")
            deepseek_key = os.getenv("DASHSCOPE_API_KEY", "")
    else:
        zhipu_key = os.getenv("ZHIPU_API_KEY", "")
        doubao_key = os.getenv("DOUBAO_API_KEY", "")
        deepseek_key = os.getenv("DASHSCOPE_API_KEY", "")

    configured = {
        "zhipu": bool(zhipu_key and len(zhipu_key) > 10),
        "doubao": bool(doubao_key and len(doubao_key) > 10),
        "deepseek": bool(deepseek_key and len(deepseek_key) > 10),
    }
    result = {}
    for provider in ["zhipu", "doubao", "deepseek"]:
        if not configured[provider]:
            result[provider] = {"configured": False}
            continue
        try:
            call_llm(provider, "你好", return_usage=False)
            result[provider] = {"configured": True, "ok": True}
        except HTTPException as he:
            result[provider] = {
                "configured": True,
                "ok": False,
                "error": str(he.detail) if he.detail else f"HTTP {he.status_code}",
            }
        except Exception as e:
            result[provider] = {"configured": True, "ok": False, "error": str(e)}
    return result


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
            # 默认使用 deepseek
            if os.getenv("DASHSCOPE_API_KEY"):
                provider = "deepseek"
            elif os.getenv("ZHIPU_API_KEY"):
                provider = "zhipu"
            elif os.getenv("DOUBAO_API_KEY"):
                provider = "doubao"
            else:
                raise HTTPException(status_code=400, detail="未配置 AI 服务 API Key，请在环境变量中配置 DASHSCOPE_API_KEY")

        result = call_llm(provider, prompt)
        return {"content": result, "provider": provider}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 请求失败: {e}")
