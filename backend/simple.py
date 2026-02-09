"""
简单版本的 AI API 调用示例
包含智谱和豆包的基本调用方法
"""

"""
智谱 / 豆包 / DeepSeek API 配置（从环境变量读取）
- ZHIPU_API_KEY
- DOUBAO_API_KEY
- DOUBAO_MODEL（默认 doubao-seed-1-6-lite-251015）
- DOUBAO_BASE_URL（默认 https://ark.cn-beijing.volces.com/api/v3）
- DASHSCOPE_API_KEY
- DEEPSEEK_MODEL（默认 deepseek-v3.2）
- DEEPSEEK_BASE_URL（默认 https://dashscope.aliyuncs.com/compatible-mode/v1）
"""
import os
"""
可选：从 .env 读取环境变量
"""
try:
    from dotenv import load_dotenv
    from pathlib import Path
    # 确保从项目根目录加载 .env 文件
    ROOT_DIR = Path(__file__).resolve().parent.parent  # backend -> 项目根目录
    env_path = ROOT_DIR / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=str(env_path), override=True)
    else:
        load_dotenv()  # 回退到默认位置
except Exception:
    pass

ZHIPU_API_KEY = os.getenv("ZHIPU_API_KEY", "")
"""
默认使用 GLM-4.5V，可通过环境变量 ZHIPU_MODEL 修改
模型选择：
- glm-4-flash: 最快，适合简单任务
- glm-4-air: 平衡速度和质量
- glm-4.5v: 综合能力最强（默认）
"""
ZHIPU_MODEL = os.getenv("ZHIPU_MODEL", "glm-4.5v")

"""豆包配置"""
DOUBAO_API_KEY = os.getenv("DOUBAO_API_KEY", "")
DOUBAO_MODEL = os.getenv("DOUBAO_MODEL", "doubao-seed-1-6-lite-251015")
DOUBAO_BASE_URL = os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")

"""DeepSeek 配置"""
DEEPSEEK_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v3.2")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")


"""
导入智谱 SDK (使用官方 zhipuai)
"""
ZhipuAI = None
"""全局客户端实例，避免重复创建"""
_zhipu_client = None
_last_zhipu_key = None  # 记录上次使用的 API Key
try:
    from zhipuai import ZhipuAI
except ImportError:
    print("zhipuai 未安装，请运行: uv pip install zhipuai")
    ZhipuAI = None


"""
导入 requests 用于 HTTP 调用
"""
import requests
import json
import time
from requests.adapters import HTTPAdapter
try:
    from urllib3.util.retry import Retry
except ImportError:
    """如果没有 urllib3，使用简单的重试机制"""
    Retry = None
import urllib3
"""禁用 SSL 警告（仅在临时禁用验证时）"""
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 导入 llm_utils（兼容多种运行方式）
try:
    from backend.llm_utils import retry_with_backoff
except ImportError:
    from llm_utils import retry_with_backoff

"""
========== HTTP 客户端优化 ==========
尝试使用支持 HTTP/2 + DNS 预解析的高性能客户端
"""
_use_http2_client = False
try:
    # 优先使用 backend 包形式
    from backend.http_client import (
        get_httpx_client, get_requests_session, 
        call_api, init as http_init, prefetch_api_hosts
    )
    _use_http2_client = True
    print("[simple] 使用 HTTP/2 高性能客户端")
except ImportError:
    try:
        # 兼容脚本直接运行的顶层导入
        from http_client import (
            get_httpx_client, get_requests_session, 
            call_api, init as http_init, prefetch_api_hosts
        )
        _use_http2_client = True
        print("[simple] 使用 HTTP/2 高性能客户端")
    except ImportError:
        # 回退到 requests
        print("[simple] http_client 模块不可用，使用默认 requests")

"""降级方案：原有的 Session"""
_http_session = None
_connection_warmed = False

def get_http_session():
    """获取 HTTP Session (优先使用 HTTP/2)"""
    global _http_session
    
    """优先使用 HTTP/2 客户端"""
    if _use_http2_client:
        return get_requests_session()
    
    """降级方案"""
    if _http_session is None:
        _http_session = requests.Session()
        adapter = HTTPAdapter(
            pool_connections=20,
            pool_maxsize=50,
            max_retries=Retry(
                total=1,
                backoff_factor=0.05,
                status_forcelist=[502, 503, 504]
            ) if Retry else 1
        )
        _http_session.mount('http://', adapter)
        _http_session.mount('https://', adapter)
        _http_session.headers.update({
            'Connection': 'keep-alive',
            'Accept-Encoding': 'gzip, deflate',  # 不使用 br (Brotli)，requests 不支持自动解压
            'Accept': 'application/json',
        })
    return _http_session


def warmup_connection():
    """预热 HTTP 连接 + DNS 预解析"""
    global _connection_warmed
    if _connection_warmed:
        return
    
    """使用新的 http_client 预热"""
    if _use_http2_client:
        try:
            """执行 DNS 预解析"""
            prefetch_api_hosts()
            _connection_warmed = True
            return
        except:
            pass
    
    """降级方案"""
    try:
        session = get_http_session()
        session.head(DOUBAO_BASE_URL.replace('/v3', ''), timeout=2)
        _connection_warmed = True
    except:
        pass

"""减少重试次数和延迟，避免重试导致整体延迟"""
@retry_with_backoff(max_retries=1, initial_delay=0.05)
def call_zhipu_api(prompt: str, model: str = None) -> dict:
    """
    调用智谱 API（使用官方 zhipuai SDK）
    
    参数:
        prompt: 用户输入的提示词
        model: 使用的模型名称，默认为 ZHIPU_MODEL
    
    返回:
        包含 content 和 usage 的字典:
        {
            "content": str,  # API 返回的响应内容
            "usage": {      # Token 使用信息
                "prompt_tokens": int,
                "completion_tokens": int,
                "total_tokens": int
            }
        }
    """
    global _zhipu_client
    
    if ZhipuAI is None:
        return {
            "content": "智谱客户端未初始化",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        }
    
    if model is None:
        model = ZHIPU_MODEL
    
    """复用全局客户端实例，但如果 API Key 变化则重新创建"""
    global _zhipu_client, _last_zhipu_key
    
    # 如果 API Key 变化或客户端未初始化，重新创建客户端
    if _zhipu_client is None or _last_zhipu_key != ZHIPU_API_KEY:
        _zhipu_client = ZhipuAI(api_key=ZHIPU_API_KEY)
        _last_zhipu_key = ZHIPU_API_KEY
    
    client = _zhipu_client
    
    """调用 API（极限优化参数）"""
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.01,  # 最低温度
            max_tokens=800,    # 进一步减少
            timeout=15,        # 缩短超时时间，快速失败，避免慢请求拖累整体
        )
    except Exception as e:
        # 如果 API 调用失败，返回错误信息
        error_msg = str(e)
        # 尝试提取更详细的错误信息
        if hasattr(e, 'response') and hasattr(e.response, 'text'):
            try:
                import json
                error_data = json.loads(e.response.text)
                if isinstance(error_data, dict) and 'error' in error_data:
                    error_msg = error_data['error'].get('message', error_msg)
            except:
                pass
        raise Exception(f"智谱 API 调用失败: {error_msg}")
    
    """提取返回内容"""
    result = response.choices[0].message.content
    
    """清理智谱返回的特殊标签"""
    import re
    result = re.sub(r'<\|begin_of_box\|>', '', result)
    result = re.sub(r'<\|end_of_box\|>', '', result)
    result = result.strip()
    
    """提取 Token 使用信息"""
    usage = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0
    }
    if hasattr(response, 'usage') and response.usage:
        usage = {
            "prompt_tokens": getattr(response.usage, 'prompt_tokens', 0),
            "completion_tokens": getattr(response.usage, 'completion_tokens', 0),
            "total_tokens": getattr(response.usage, 'total_tokens', 0)
        }
    
    return {
        "content": result,
        "usage": usage
    }


"""简化的系统提示词，让模型更快响应"""
FAST_SYSTEM_PROMPT = """你是一个简历解析助手。直接输出 JSON，不要多余解释。"""

@retry_with_backoff(max_retries=1, initial_delay=0.1)
def call_doubao_api(prompt: str, model: str = None, fast_mode: bool = True) -> str:
    """
    调用豆包 API（火山引擎）- 极限优化版
    
    参数:
        prompt: 用户输入的提示词
        model: 使用的模型名称，默认为 DOUBAO_MODEL
        fast_mode: 是否使用快速模式（低思考强度）
    
    返回:
        API 返回的响应内容
    """
    if model is None:
        model = DOUBAO_MODEL
    
    api_url = f"{DOUBAO_BASE_URL}/chat/completions"
    
    """极限优化参数"""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": FAST_SYSTEM_PROMPT} if fast_mode else None,
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1 if fast_mode else 0.7,  # 极低温度
        "max_tokens": 1000,   # 进一步减少
        "top_p": 0.7,         # 更限制的采样
        "frequency_penalty": 0,
        "presence_penalty": 0,
    }
    
    """移除 None 消息"""
    payload["messages"] = [m for m in payload["messages"] if m]
    
    """添加最低思考强度参数（大幅提升速度 1.5~5 倍）"""
    payload["reasoning_effort"] = "minimal"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DOUBAO_API_KEY}"
    }
    
    """使用复用的 HTTP Session"""
    session = get_http_session()
    response = session.post(
        api_url,
        json=payload,
        headers=headers,
        timeout=30
    )
    """减少超时"""
    
    if response.status_code == 200:
        result = response.json()
        return result["choices"][0]["message"]["content"]
    else:
        raise Exception(f"豆包 API 调用失败: {response.status_code} - {response.text}")


def call_doubao_api_stream(prompt: str, model: str = None, fast_mode: bool = True):
    """
    流式调用豆包 API（火山引擎）- 优化版
    
    参数:
        prompt: 用户输入的提示词
        model: 使用的模型名称，默认为 DOUBAO_MODEL
        fast_mode: 是否使用快速模式（低思考强度）
    
    生成器返回:
        每次返回一个文本片段
    """
    if model is None:
        model = DOUBAO_MODEL
    
    api_url = f"{DOUBAO_BASE_URL}/chat/completions"
    
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3 if fast_mode else 0.7,
        "max_tokens": 2000,
        "top_p": 0.8,
        "stream": True  # 启用流式输出
    }
    
    # 添加最低思考强度参数（大幅提升速度 1.5~5 倍）
    payload["reasoning_effort"] = "minimal"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DOUBAO_API_KEY}"
    }
    
    # 使用复用的 HTTP Session
    session = get_http_session()
    response = session.post(
        api_url,
        json=payload,
        headers=headers,
        timeout=90,
        stream=True  # 启用流式响应
    )
    
    if response.status_code != 200:
        raise Exception(f"豆包 API 调用失败: {response.status_code} - {response.text}")
    
    # 解析 SSE 流
    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                data = line[6:]  # 移除 'data: ' 前缀
                if data == '[DONE]':
                    break
                try:
                    import json
                    chunk = json.loads(data)
                    if 'choices' in chunk and len(chunk['choices']) > 0:
                        delta = chunk['choices'][0].get('delta', {})
                        content = delta.get('content', '')
                        if content:
                            yield content
                except json.JSONDecodeError:
                    continue


@retry_with_backoff(max_retries=1, initial_delay=0.1)
def call_deepseek_api(prompt: str, model: str = None) -> str:
    """
    调用 DeepSeek API

    参数:
        prompt: 用户输入的提示词
        model: 使用的模型名称，默认为 DEEPSEEK_MODEL

    返回:
        API 返回的响应内容
    """
    # 检查 API Key 是否配置
    if not DEEPSEEK_API_KEY:
        raise Exception("DASHSCOPE_API_KEY 未配置。请在 Railway 环境变量或本地 .env 文件中设置 DASHSCOPE_API_KEY")
    
    if model is None:
        model = DEEPSEEK_MODEL

    api_url = f"{DEEPSEEK_BASE_URL}/chat/completions"

    """优化参数"""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": FAST_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,  # 极低温度
        "max_tokens": 4000,   # DeepSeek 支持较长输出
        "top_p": 0.9,
        "frequency_penalty": 0,
        "presence_penalty": 0,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }

    """使用复用的 HTTP Session"""
    session = get_http_session()
    
    try:
        response = session.post(
            api_url,
            json=payload,
            headers=headers,
            timeout=30
        )
    except requests.exceptions.RequestException as e:
        raise Exception(f"DeepSeek API 网络请求失败: {str(e)}")

    if response.status_code == 200:
        # 检查响应内容
        if not response.content:
            raise Exception(f"DeepSeek API 返回空响应 (status=200, body为空)")
        
        # 检查是否是 gzip 压缩的内容（但响应头没有正确设置）
        if len(response.content) >= 2 and response.content[:2] == b'\x1f\x8b':  # gzip magic number
            import gzip
            try:
                decompressed = gzip.decompress(response.content).decode('utf-8')
                result = json.loads(decompressed)
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                if not content:
                    raise Exception(f"DeepSeek API 返回空内容。响应: {json.dumps(result, ensure_ascii=False)[:500]}")
                return content
            except (gzip.BadGzipFile, json.JSONDecodeError, UnicodeDecodeError) as e:
                raise Exception(f"DeepSeek API 返回压缩数据但解压失败: {str(e)}")
        
        # 确保响应编码正确
        if response.encoding is None or response.encoding == 'ISO-8859-1':
            # 尝试从响应头或内容推断编码
            response.encoding = response.apparent_encoding or 'utf-8'
        
        # 获取响应文本
        try:
            raw_text = response.text
        except UnicodeDecodeError:
            # 如果解码失败，尝试使用 UTF-8
            raw_text = response.content.decode('utf-8', errors='ignore')
        
        # 检查响应是否为空
        if not raw_text or not raw_text.strip():
            raise Exception(f"DeepSeek API 返回空响应 (status=200, body为空)")
        
        # 尝试解析 JSON
        try:
            result = response.json()
        except (json.JSONDecodeError, ValueError) as e:
            preview = raw_text[:300] if len(raw_text) > 300 else raw_text
            raise Exception(f"DeepSeek API 返回非 JSON 内容: {preview}")
        
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            raise Exception(f"DeepSeek API 返回空内容。响应: {json.dumps(result, ensure_ascii=False)[:500]}")
        return content
    else:
        # 获取错误详情
        try:
            error_detail = response.text[:500] if response.text else "无响应内容"
        except:
            error_detail = response.content[:500].decode('utf-8', errors='ignore') if response.content else "无响应内容"
        try:
            error_json = response.json()
            if "error" in error_json:
                error_detail = error_json["error"].get("message", error_detail)
        except:
            pass
        raise Exception(f"DeepSeek API 错误 {response.status_code}: {error_detail}")


def call_deepseek_api_stream(prompt: str, model: str = None):
    """
    流式调用 DeepSeek API

    参数:
        prompt: 用户输入的提示词
        model: 使用的模型名称，默认为 DEEPSEEK_MODEL

    生成器返回:
        每次返回一个文本片段
    """
    if model is None:
        model = DEEPSEEK_MODEL

    api_url = f"{DEEPSEEK_BASE_URL}/chat/completions"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 4000,
        "top_p": 0.9,
        "stream": True  # 启用流式输出
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }

    # 使用复用的 HTTP Session
    session = get_http_session()
    response = session.post(
        api_url,
        json=payload,
        headers=headers,
        timeout=90,
        stream=True  # 启用流式响应
    )

    if response.status_code != 200:
        raise Exception(f"DeepSeek API 调用失败: {response.status_code} - {response.text}")

    # 解析 SSE 流
    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                data = line[6:]  # 移除 'data: ' 前缀
                if data == '[DONE]':
                    break
                try:
                    import json
                    chunk = json.loads(data)
                    if 'choices' in chunk and len(chunk['choices']) > 0:
                        delta = chunk['choices'][0].get('delta', {})
                        content = delta.get('content', '')
                        if content:
                            yield content
                except json.JSONDecodeError:
                    continue


def main():
    """
    主函数：演示如何使用三个 API
    """
    """测试智谱 API"""
    print("=" * 50)
    print("测试智谱 API")
    print("=" * 50)
    try:
        zhipu_result = call_zhipu_api("请用一句话介绍人工智能")
        print(f"智谱返回: {zhipu_result}")
    except Exception as e:
        print(f"智谱 API 调用失败: {e}")
    print()

    """测试豆包 API"""
    print("=" * 50)
    print("测试豆包 API")
    print("=" * 50)
    try:
        doubao_result = call_doubao_api("请用一句话介绍人工智能")
        print(f"豆包返回: {doubao_result}")
    except Exception as e:
        print(f"豆包 API 调用失败: {e}")
    print()

    """测试 DeepSeek API"""
    print("=" * 50)
    print("测试 DeepSeek API")
    print("=" * 50)
    try:
        deepseek_result = call_deepseek_api("请用一句话介绍人工智能")
        print(f"DeepSeek 返回: {deepseek_result}")
    except Exception as e:
        print(f"DeepSeek API 调用失败: {e}")
    print()


if __name__ == "__main__":
    main()

