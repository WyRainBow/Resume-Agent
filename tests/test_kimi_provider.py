import unittest
from unittest.mock import patch

from backend.kimi_client import _normalize_base_url
from backend.llm import call_llm, call_llm_stream, resolve_default_provider


class KimiProviderTests(unittest.TestCase):
    def test_normalize_base_url_appends_v1(self):
        self.assertEqual(_normalize_base_url("https://api.kimi.com/coding"), "https://api.kimi.com/coding/v1")
        self.assertEqual(_normalize_base_url("https://api.kimi.com/coding/v1"), "https://api.kimi.com/coding/v1")

    def test_resolve_default_provider_prefers_kimi_key(self):
        with patch.dict(
            "os.environ",
            {"KIMI_API_KEY": "test-kimi-key", "DASHSCOPE_API_KEY": "", "ZHIPU_API_KEY": "", "DOUBAO_API_KEY": ""},
            clear=False,
        ):
            self.assertEqual(resolve_default_provider(), "kimi")

    def test_call_llm_uses_kimi_anthropic_client(self):
        with patch.dict(
            "os.environ",
            {
                "KIMI_API_KEY": "test-kimi-key",
                "KIMI_BASE_URL": "https://api.kimi.com/coding",
                "KIMI_MODEL": "kimi-for-coding",
            },
            clear=False,
        ):
            with patch("backend.llm.call_kimi_api", return_value={"content": "ok", "usage": {"total_tokens": 1}}) as mocked:
                result = call_llm("kimi", "hello", return_usage=True)

        self.assertEqual(result["content"], "ok")
        mocked.assert_called_once_with(
            "hello",
            api_key="test-kimi-key",
            base_url="https://api.kimi.com/coding",
            model="kimi-for-coding",
        )

    def test_call_llm_stream_uses_kimi_stream_client(self):
        with patch.dict(
            "os.environ",
            {
                "KIMI_API_KEY": "test-kimi-key",
                "KIMI_BASE_URL": "https://api.kimi.com/coding",
                "KIMI_MODEL": "kimi-for-coding",
            },
            clear=False,
        ):
            with patch("backend.llm.call_kimi_api_stream", return_value=iter(["A", "B"])) as mocked:
                chunks = list(call_llm_stream("kimi", "stream me"))

        self.assertEqual(chunks, ["A", "B"])
        mocked.assert_called_once_with(
            "stream me",
            api_key="test-kimi-key",
            base_url="https://api.kimi.com/coding",
            model="kimi-for-coding",
        )


if __name__ == "__main__":
    unittest.main()
