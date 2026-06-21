"""腾讯云 COS 客户端工厂：本地开发绕过系统代理，缩短超时。"""

from __future__ import annotations

import os

# requests 传 None 可强制不走 HTTP(S)_PROXY 环境变量
_NO_PROXY = {"http": None, "https": None}


def cos_request_timeout() -> int:
    raw = os.getenv("COS_REQUEST_TIMEOUT", "8")
    try:
        return max(3, int(raw))
    except ValueError:
        return 8


def build_cos_s3_client():
    """创建禁用系统代理的 CosS3Client；凭证缺失时返回 (None, bucket)。"""
    from qcloud_cos import CosConfig, CosS3Client

    secret_id = os.getenv("COS_SECRET_ID", "")
    secret_key = os.getenv("COS_SECRET_KEY", "")
    region = os.getenv("COS_REGION", "ap-guangzhou")
    bucket = os.getenv("COS_BUCKET", "resumecos-1327706280")
    if not secret_id or not secret_key:
        return None, bucket

    config = CosConfig(
        Region=region,
        SecretId=secret_id,
        SecretKey=secret_key,
        Timeout=cos_request_timeout(),
        Proxies=_NO_PROXY,
    )
    return CosS3Client(config), bucket


def prefer_local_assets() -> bool:
    """非 production 默认优先本地缓存资源，避免 COS 经代理失败拖慢本地开发。"""
    explicit = os.getenv("PREFER_LOCAL_LOGOS", "").strip().lower()
    if explicit in {"1", "true", "yes", "on"}:
        return True
    if explicit in {"0", "false", "no", "off"}:
        return False
    return os.getenv("LOG_MODE", "console") != "production"