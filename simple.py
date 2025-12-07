"""
简单版本的 AI API 调用示例
包含智谱和 Gemini 的基本调用方法
"""

"""
智谱 / Gemini API 配置（从环境变量读取）
- ZHIPU_API_KEY
- GEMINI_API_KEY
- GEMINI_MODEL（默认 gemini-2.5-pro）
- GEMINI_BASE_URL（默认 https://api.chataiapi.com/v1）
"""
import os
"""
可选：从 .env 读取环境变量
"""
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

ZHIPU_API_KEY = os.getenv("ZHIPU_API_KEY", "")
"""
默认使用 GLM-4-Flash（更快），可通过环境变量 ZHIPU_MODEL 修改
模型选择：
- glm-4-flash: 最快，适合简单任务
- glm-4-air: 平衡速度和质量
- glm-4.5v: 最强，但较慢
"""
ZHIPU_MODEL = os.getenv("ZHIPU_MODEL", "glm-4-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://api.chataiapi.com/v1")


"""
导入智谱 SDK
"""
ZhipuAiClient = None
try:
    from zai import ZhipuAiClient
except ImportError:
    try:
        import subprocess as sp
        sp.run(['pip3', 'install', 'zai-sdk', '--break-system-packages', '-q'], check=True)
        from zai import ZhipuAiClient
    except:
        print("无法安装 zai-sdk")
        ZhipuAiClient = None


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

from backend.llm_utils import retry_with_backoff

@retry_with_backoff(max_retries=3, initial_delay=1.0)
def call_zhipu_api(prompt: str, model: str = None) -> str:
    """
    调用智谱 API 的简单示例
    
    参数:
        prompt: 用户输入的提示词
        model: 使用的模型名称，默认为 ZHIPU_MODEL（GLM-4.5 或 GLM-4.5V）
    
    返回:
        API 返回的响应内容
    """
    if ZhipuAiClient is None:
        return "智谱客户端未初始化"
    
    """如果没有指定模型，使用环境变量或默认值"""
    if model is None:
        model = ZHIPU_MODEL
    
    """初始化智谱客户端"""
    client = ZhipuAiClient(api_key=ZHIPU_API_KEY)
    
    """调用 API"""
    """GLM-4.5V 支持纯文本和图像输入，这里使用纯文本"""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.3,  # 降低温度，加快响应
        max_tokens=2000,  # 限制最大 token，加快响应
        timeout=30  # 30秒超时
    )
    
    """提取返回内容"""
    result = response.choices[0].message.content
    
    """清理智谱返回的特殊标签"""
    """移除 <|begin_of_box|> 和 <|end_of_box|> 等标签"""
    import re
    result = re.sub(r'<\|begin_of_box\|>', '', result)
    result = re.sub(r'<\|end_of_box\|>', '', result)
    result = result.strip()
    
    return result


@retry_with_backoff(max_retries=3, initial_delay=1.0)
def call_gemini_api(prompt: str, model: str = None, max_retries: int = 3) -> str:
    """
    调用 Gemini API 的简单示例（带重试机制）
    
    参数:
        prompt: 用户输入的提示词
        model: 使用的模型名称，默认为 GEMINI_MODEL
        max_retries: 最大重试次数，默认 3 次
    
    返回:
        API 返回的响应内容
    """
    if model is None:
        model = GEMINI_MODEL
    
    """构建请求 URL"""
    api_url = f"{GEMINI_BASE_URL}/chat/completions"
    
    """构建请求体"""
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.7
    }
    
    """设置请求头"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GEMINI_API_KEY}"
    }
    
    """创建带重试机制的 Session"""
    session = requests.Session()
    if Retry is not None:
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
    
    """发送请求（带手动重试处理 SSL 错误）"""
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            """保持 SSL 验证"""
            response = session.post(
                api_url,
                json=payload,
                headers=headers,
                timeout=120,
                verify=True
            )
            
            """解析响应"""
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"]
            else:
                error_msg = f"API 调用失败: {response.status_code} - {response.text}"
                if attempt < max_retries:
                    """指数退避"""
                    time.sleep(2 ** attempt)
                    continue
                return error_msg
                
        except requests.exceptions.SSLError as e:
            last_error = e
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"SSL 错误，{wait_time} 秒后重试 (尝试 {attempt + 1}/{max_retries + 1})...")
                time.sleep(wait_time)
                continue
            else:
                """最后一次尝试，如果还是 SSL 错误，尝试禁用验证（仅作为最后手段）"""
                try:
                    print("最后一次尝试，临时禁用 SSL 验证...")
                    """临时禁用 SSL 验证"""
                    response = requests.post(
                        api_url,
                        json=payload,
                        headers=headers,
                        timeout=120,
                        verify=False
                    )
                    if response.status_code == 200:
                        result = response.json()
                        return result["choices"][0]["message"]["content"]
                    else:
                        return f"API 调用失败: {response.status_code} - {response.text}"
                except Exception as final_e:
                    raise Exception(f"SSL 连接失败（已重试 {max_retries + 1} 次）: {str(e)}")
                    
        except requests.exceptions.RequestException as e:
            last_error = e
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"请求错误，{wait_time} 秒后重试 (尝试 {attempt + 1}/{max_retries + 1})...")
                time.sleep(wait_time)
                continue
            else:
                raise Exception(f"API 调用失败（已重试 {max_retries + 1} 次）: {str(e)}")
    
    """如果所有重试都失败了"""
    raise Exception(f"API 调用失败（已重试 {max_retries + 1} 次）: {str(last_error)}")


def main():
    """
    主函数：演示如何使用两个 API
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
    
    """测试 Gemini API"""
    print("=" * 50)
    print("测试 Gemini API")
    print("=" * 50)
    try:
        gemini_result = call_gemini_api("请用一句话介绍人工智能")
        print(f"Gemini 返回: {gemini_result}")
    except Exception as e:
        print(f"Gemini API 调用失败: {e}")
    print()


if __name__ == "__main__":
    main()

