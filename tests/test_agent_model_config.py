import importlib
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ROOT_STR = str(PROJECT_ROOT)
if ROOT_STR not in sys.path:
    sys.path.insert(0, ROOT_STR)

from backend.agent.model_profiles import list_model_options, resolve_profile_name  # noqa: E402
from backend.agent.web.schemas.stream import StreamRequest  # noqa: E402


class AgentModelConfigTests(unittest.TestCase):
    def test_model_profiles_include_kimi(self) -> None:
        with patch(
            "backend.agent.model_profiles._read_project_env_values",
            return_value={"KIMI_API_KEY": "sk-kimi-test"},
        ):
            options = {item["id"]: item for item in list_model_options()}

        self.assertIn("kimi", options)
        self.assertIn("deepseek", options)
        self.assertTrue(options["kimi"]["supported"])
        self.assertTrue(options["kimi"]["available"])

    def test_stream_request_accepts_llm_profile(self) -> None:
        payload = StreamRequest(prompt="你好", llm_profile="kimi")

        self.assertEqual(payload.llm_profile, "kimi")

    def test_models_endpoint_returns_available_profiles(self) -> None:
        app_module = importlib.import_module("backend.main")
        client = TestClient(app_module.app)

        response = client.get("/api/agent/config/models")

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertIn("models", payload)
        self.assertEqual(payload["selected"], resolve_profile_name(None))
        self.assertIn("kimi", {item["id"] for item in payload["models"]})


if __name__ == "__main__":
    unittest.main()
