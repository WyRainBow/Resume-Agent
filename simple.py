"""
简单版本的 AI API 调用示例
包含智谱和豆包的基本调用方法
"""

"""
智谱 / 豆包 API 配置（从环境变量读取）
- ZHIPU_API_KEY
- DOUBAO_API_KEY
- DOUBAO_MODEL（默认 doubao-seed-1-6-lite-251015）
- DOUBAO_BASE_URL（默认 https://ark.cn-beijing.volces.com/api/v3）
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

# 豆包配置
DOUBAO_API_KEY = os.getenv("DOUBAO_API_KEY", "")
DOUBAO_MODEL = os.getenv("DOUBAO_MODEL", "doubao-seed-1-6-lite-251015")
DOUBAO_BASE_URL = os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")


"""
导入智谱 SDK (使用官方 zhipuai)
"""
ZhipuAI = None
_zhipu_client = None  # 全局客户端实例，避免重复创建
try:
    from zhipuai import ZhipuAI
except ImportError:
    print("zhipuai 未安装，请运行: pip install zhipuai")
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

from backend.llm_utils import retry_with_backoff

@retry_with_backoff(max_retries=2, initial_delay=0.1)  # 减少重试次数和延迟
def call_zhipu_api(prompt: str, model: str = None) -> str:
    """
    调用智谱 API（使用官方 zhipuai SDK）
    
    参数:
        prompt: 用户输入的提示词
        model: 使用的模型名称，默认为 ZHIPU_MODEL
    
    返回:
        API 返回的响应内容
    """
    global _zhipu_client
    
    if ZhipuAI is None:
        return "智谱客户端未初始化"
    
    if model is None:
        model = ZHIPU_MODEL
    
    # 复用全局客户端实例
    if _zhipu_client is None:
        _zhipu_client = ZhipuAI(api_key=ZHIPU_API_KEY)
    client = _zhipu_client
    
    # 调用 API（极限优化参数）
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.01,  # 最低温度
        max_tokens=800,    # 进一步减少
    )
    
    # 提取返回内容
    result = response.choices[0].message.content
    
    # 清理智谱返回的特殊标签
    import re
    result = re.sub(r'<\|begin_of_box\|>', '', result)
    result = re.sub(r'<\|end_of_box\|>', '', result)
    result = result.strip()
    
    return result


@retry_with_backoff(max_retries=2, initial_delay=0.5)
def call_doubao_api(prompt: str, model: str = None) -> str:
    """
    调用豆包 API（火山引擎）
    
    参数:
        prompt: 用户输入的提示词
        model: 使用的模型名称，默认为 DOUBAO_MODEL
    
    返回:
        API 返回的响应内容
    """
    if model is None:
        model = DOUBAO_MODEL
    
    api_url = f"{DOUBAO_BASE_URL}/chat/completions"
    
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 2000
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DOUBAO_API_KEY}"
    }
    
    response = requests.post(
        api_url,
        json=payload,
        headers=headers,
        timeout=60
    )
    
    if response.status_code == 200:
        result = response.json()
        return result["choices"][0]["message"]["content"]
    else:
        raise Exception(f"豆包 API 调用失败: {response.status_code} - {response.text}")


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


if __name__ == "__main__":
    main()

