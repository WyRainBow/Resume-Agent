"""
邮箱凭证对称加密工具

QQ 邮箱授权码入库前必须经 Fernet 加密,密钥来自环境变量
EMAIL_CREDENTIAL_ENC_KEY(用 Fernet.generate_key() 生成的 44 字符
url-safe base64 字符串)。密钥缺失时直接报错,不允许明文降级。
"""
import os

from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    key = os.getenv("EMAIL_CREDENTIAL_ENC_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "缺少环境变量 EMAIL_CREDENTIAL_ENC_KEY,无法加解密邮箱授权码。"
            "请用 cryptography.fernet.Fernet.generate_key() 生成并配置到 .env"
        )
    return Fernet(key.encode("utf-8"))


def encrypt_secret(plain: str) -> str:
    """加密敏感字符串,返回可入库的 token 文本。"""
    return _get_fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    """解密 encrypt_secret 产出的 token,返回原文。"""
    return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
