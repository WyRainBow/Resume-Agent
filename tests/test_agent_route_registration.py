import importlib
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ROOT_STR = str(PROJECT_ROOT)
if ROOT_STR not in sys.path:
    sys.path.insert(0, ROOT_STR)


class AgentRouteRegistrationTests(unittest.TestCase):
    def test_agent_stream_routes_are_registered(self) -> None:
        app_module = importlib.import_module("backend.main")
        paths = {getattr(route, "path", "") for route in app_module.app.routes}

        self.assertIn("/api/agent/stream", paths)
        self.assertIn("/api/agent/history/sessions/list", paths)

    def test_agent_stream_endpoint_is_not_404(self) -> None:
        app_module = importlib.import_module("backend.main")
        client = TestClient(app_module.app)

        response = client.post("/api/agent/stream", json={})

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
