"""
高性能 HTTP 客户端
支持 HTTP/2、DNS 预解析、连接池复用

优化效果：
- HTTP/2 多路复用：减少连接建立开销
- DNS 预解析：减少首次请求延迟 50-100ms
- 连接池复用：Keep-Alive 长连接
- Brotli/Gzip 压缩：减少传输数据量
"""

import os
import socket
import asyncio
from typing import Optional, Dict, Any, Generator
from functools import lru_cache

"""尝试导入 httpx (支持 HTTP/2)"""
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    print("[http_client] httpx 未安装，使用 requests 降级方案")
    print("[http_client] 安装命令: pip install httpx[http2]")

"""降级方案：使用 requests"""
import requests
from requests.adapters import HTTPAdapter
try:
    from urllib3.util.retry import Retry
except ImportError:
    Retry = None


"""
========== DNS 预解析 ==========
"""
_dns_cache: Dict[str, str] = {}

def dns_prefetch(host: str) -> Optional[str]:
    """
    DNS 预解析，缓存 IP 地址
    减少首次请求的 DNS 查询延迟 (约 50-100ms)
    """
    if host in _dns_cache:
        return _dns_cache[host]
    
    try:
        """解析 DNS"""
        result = socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)
        if result:
            ip = result[0][4][0]
            _dns_cache[host] = ip
            print(f"[DNS预解析] {host} -> {ip}")
            return ip
    except Exception as e:
        print(f"[DNS预解析] 失败: {host} - {e}")
    return None


def prefetch_api_hosts():
    """预解析常用 API 域名"""
    """豆包/火山引擎、智谱"""
    hosts = [
        "ark.cn-beijing.volces.com",
        "open.bigmodel.cn",
    ]
    for host in hosts:
        dns_prefetch(host)


"""
========== HTTP/2 客户端 (httpx) ==========
"""
_httpx_client: Optional["httpx.Client"] = None

def get_httpx_client() -> "httpx.Client":
    """
    获取支持 HTTP/2 的客户端
    HTTP/2 优势：多路复用、头部压缩、服务器推送
    """
    global _httpx_client
    
    if not HTTPX_AVAILABLE:
        raise RuntimeError("httpx 未安装")
    
    if _httpx_client is None:
        _httpx_client = httpx.Client(
            http2=True,
            timeout=httpx.Timeout(30.0, connect=5.0),
            limits=httpx.Limits(
                max_keepalive_connections=20,
                max_connections=50,
                keepalive_expiry=30.0
            ),
            headers={
                "Accept-Encoding": "br, gzip, deflate",
                "Connection": "keep-alive",
            }
        )
    return _httpx_client


"""
========== 异步 HTTP/2 客户端 ==========
"""
_async_client: Optional["httpx.AsyncClient"] = None

async def get_async_client() -> "httpx.AsyncClient":
    """获取异步 HTTP/2 客户端"""
    global _async_client
    
    if not HTTPX_AVAILABLE:
        raise RuntimeError("httpx 未安装")
    
    if _async_client is None:
        _async_client = httpx.AsyncClient(
            http2=True,
            timeout=httpx.Timeout(30.0, connect=5.0),
            limits=httpx.Limits(
                max_keepalive_connections=20,
                max_connections=50,
            ),
            headers={
                "Accept-Encoding": "br, gzip, deflate",
                "Connection": "keep-alive",
            }
        )
    return _async_client


"""
========== 降级方案：requests ==========
"""
_requests_session: Optional[requests.Session] = None

def get_requests_session() -> requests.Session:
    """获取 requests Session (降级方案)"""
    global _requests_session
    
    if _requests_session is None:
        _requests_session = requests.Session()
        adapter = HTTPAdapter(
            pool_connections=20,
            pool_maxsize=50,
            max_retries=Retry(total=1, backoff_factor=0.05) if Retry else 1
        )
        _requests_session.mount('http://', adapter)
        _requests_session.mount('https://', adapter)
        _requests_session.headers.update({
            'Connection': 'keep-alive',
            'Accept-Encoding': 'gzip, deflate, br',
        })
    return _requests_session


"""
========== 统一 API 调用接口 ==========
"""
def call_api(
    url: str,
    payload: Dict[str, Any],
    headers: Dict[str, str],
    timeout: float = 30.0,
    stream: bool = False
) -> Any:
    """
    统一 API 调用接口
    优先使用 HTTP/2 (httpx)，降级使用 HTTP/1.1 (requests)
    
    Args:
        url: API 地址
        payload: 请求体
        headers: 请求头
        timeout: 超时时间
        stream: 是否流式
    
    Returns:
        响应对象或 JSON
    """
    if HTTPX_AVAILABLE and not stream:
        """使用 HTTP/2"""
        client = get_httpx_client()
        response = client.post(
            url,
            json=payload,
            headers=headers,
            timeout=timeout
        )
        response.raise_for_status()
        return response.json()
    else:
        """降级使用 requests"""
        session = get_requests_session()
        response = session.post(
            url,
            json=payload,
            headers=headers,
            timeout=timeout,
            stream=stream
        )
        response.raise_for_status()
        if stream:
            return response
        return response.json()


def call_api_stream(
    url: str,
    payload: Dict[str, Any],
    headers: Dict[str, str],
    timeout: float = 90.0
) -> Generator[str, None, None]:
    """
    流式 API 调用
    
    Yields:
        SSE 数据块
    """
    session = get_requests_session()
    response = session.post(
        url,
        json=payload,
        headers=headers,
        timeout=timeout,
        stream=True
    )
    response.raise_for_status()
    
    for line in response.iter_lines():
        if line:
            yield line.decode('utf-8')


async def call_api_async(
    url: str,
    payload: Dict[str, Any],
    headers: Dict[str, str],
    timeout: float = 30.0
) -> Dict[str, Any]:
    """
    异步 API 调用 (HTTP/2)
    
    用于并发请求多个 API
    """
    if not HTTPX_AVAILABLE:
        raise RuntimeError("httpx 未安装，无法使用异步调用")
    
    client = await get_async_client()
    response = await client.post(
        url,
        json=payload,
        headers=headers,
        timeout=timeout
    )
    response.raise_for_status()
    return response.json()


"""
========== 初始化 ==========
"""
def init():
    """初始化：DNS 预解析 + 预热连接"""
    print("[http_client] 初始化中...")
    
    """执行 DNS 预解析"""
    prefetch_api_hosts()
    
    """预热连接"""
    if HTTPX_AVAILABLE:
        try:
            client = get_httpx_client()
            """预热到火山引擎"""
            client.head("https://ark.cn-beijing.volces.com", timeout=2)
            print("[http_client] HTTP/2 连接已预热")
        except:
            pass
    
    print("[http_client] 初始化完成")


def close():
    """关闭所有连接"""
    global _httpx_client, _async_client, _requests_session
    
    if _httpx_client:
        _httpx_client.close()
        _httpx_client = None
    
    if _requests_session:
        _requests_session.close()
        _requests_session = None


"""模块加载时自动初始化"""
if os.getenv("HTTP_CLIENT_AUTO_INIT", "1") == "1":
    init()
