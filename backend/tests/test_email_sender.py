"""email_sender 三路径测试(mock smtplib):成功 / 认证失败 / 连接失败"""
import smtplib
from unittest.mock import MagicMock, patch

import pytest

from backend.services.email_sender import send_resume_email


def _call(**overrides):
    kwargs = dict(
        from_email="me@qq.com",
        auth_code="authcode123456",
        to_email="hr@example.com",
        subject="张三的简历",
        body="您好,附件是我的简历,请查收。",
        pdf_bytes=b"%PDF-1.4 fake",
        filename="张三的简历.pdf",
    )
    kwargs.update(overrides)
    return send_resume_email(**kwargs)


def test_send_success():
    with patch("backend.services.email_sender.smtplib.SMTP_SSL") as mock_ssl:
        server = MagicMock()
        mock_ssl.return_value.__enter__.return_value = server
        _call()
        mock_ssl.assert_called_once_with("smtp.qq.com", 465, timeout=30)
        server.login.assert_called_once_with("me@qq.com", "authcode123456")
        assert server.sendmail.call_count == 1
        args = server.sendmail.call_args[0]
        assert args[0] == "me@qq.com"
        assert args[1] == ["hr@example.com"]


def test_auth_failure_propagates():
    with patch("backend.services.email_sender.smtplib.SMTP_SSL") as mock_ssl:
        server = MagicMock()
        server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"auth failed")
        mock_ssl.return_value.__enter__.return_value = server
        with pytest.raises(smtplib.SMTPAuthenticationError):
            _call()


def test_connection_failure_propagates():
    with patch(
        "backend.services.email_sender.smtplib.SMTP_SSL",
        side_effect=OSError("connection refused"),
    ):
        with pytest.raises(OSError):
            _call()
