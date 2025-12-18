"""
并行处理配置
"""

# 并行分块处理的默认配置
DEFAULT_PARALLEL_CONFIG = {
    # 最大并发数
    # 建议：3-6，太多可能触发API限流
    "max_concurrent": 6,

    # 分块阈值（字符数）
    # 超过此长度将使用分块处理
    "chunk_threshold": 500,

    # 单块最大大小（字符数）
    "max_chunk_size": 300,

    # 请求超时时间（秒）
    "request_timeout": 30,

    # 重试次数
    "max_retries": 2,

    # 重试延迟（秒）
    "retry_delay": 0.5,

    # 是否启用并行处理
    "enabled": True,
}

# 不同AI提供商的特定配置
PROVIDER_CONFIG = {
    "doubao": {
        "max_concurrent": 6,  # 豆包相对宽松，支持更高并发
        "request_timeout": 25,
    },
    "zhipu": {
        "max_concurrent": 2,  # 智谱较严格
        "request_timeout": 35,
    },
    "gemini": {
        "max_concurrent": 2,  # Google也较严格
        "request_timeout": 40,
    },
}

def get_parallel_config(provider: str = None) -> dict:
    """
    获取并行处理配置

    Args:
        provider: AI提供商，如果不提供则返回默认配置

    Returns:
        配置字典
    """
    config = DEFAULT_PARALLEL_CONFIG.copy()

    if provider and provider in PROVIDER_CONFIG:
        # 合并提供商特定配置
        config.update(PROVIDER_CONFIG[provider])

    return config