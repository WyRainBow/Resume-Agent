"""crypto.py 加解密单测"""
import pytest
from cryptography.fernet import Fernet

from backend.utils.crypto import decrypt_secret, encrypt_secret


def test_encrypt_decrypt_roundtrip(monkeypatch):
    monkeypatch.setenv("EMAIL_CREDENTIAL_ENC_KEY", Fernet.generate_key().decode())
    token = encrypt_secret("abcdefghijklmnop")
    assert token != "abcdefghijklmnop"
    assert decrypt_secret(token) == "abcdefghijklmnop"


def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("EMAIL_CREDENTIAL_ENC_KEY", raising=False)
    with pytest.raises(RuntimeError, match="EMAIL_CREDENTIAL_ENC_KEY"):
        encrypt_secret("x")
