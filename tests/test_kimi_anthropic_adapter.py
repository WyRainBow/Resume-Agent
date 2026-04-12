import json
import sys
import unittest
from pathlib import Path

import httpx


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ROOT_STR = str(PROJECT_ROOT)
if ROOT_STR not in sys.path:
    sys.path.insert(0, ROOT_STR)

from backend.agent.llm_adapters.anthropic_messages import AnthropicMessagesAdapter  # noqa: E402
from backend.agent.llm_adapters.anthropic_payloads import build_payload  # noqa: E402


class KimiAnthropicAdapterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.adapter = AnthropicMessagesAdapter(
            model="kimi-for-coding",
            base_url="https://api.kimi.com/coding",
            api_key="sk-kimi-test",
            max_tokens=4096,
            temperature=0.3,
            timeout=httpx.Timeout(30.0),
        )

    def test_build_payload_converts_tool_history(self) -> None:
        payload = build_payload(
            model=self.adapter.model,
            max_tokens=self.adapter.max_tokens,
            default_temperature=self.adapter.temperature,
            messages=[
                {"role": "system", "content": "你是助手"},
                {"role": "user", "content": "查天气"},
                {
                    "role": "assistant",
                    "content": "我来查询",
                    "tool_calls": [
                        {
                            "id": "call_1",
                            "type": "function",
                            "function": {
                                "name": "get_weather",
                                "arguments": '{"city":"上海"}',
                            },
                        }
                    ],
                },
                {
                    "role": "tool",
                    "tool_call_id": "call_1",
                    "content": '{"temp":"21"}',
                },
            ],
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "get_weather",
                        "description": "获取天气",
                        "parameters": {
                            "type": "object",
                            "properties": {"city": {"type": "string"}},
                        },
                    },
                }
            ],
            tool_choice="required",
            temperature=None,
            stream=False,
        )

        self.assertEqual(payload["system"], "你是助手")
        self.assertEqual(payload["tool_choice"], {"type": "any"})
        self.assertEqual(payload["messages"][1]["role"], "assistant")
        self.assertEqual(payload["messages"][1]["content"][1]["type"], "tool_use")
        self.assertEqual(payload["messages"][2]["content"][0]["type"], "tool_result")

    async def test_stream_normalizes_text_and_tool_use(self) -> None:
        events = "\n".join(
            [
                'event: content_block_start',
                'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"你好"}}',
                "",
                'event: content_block_start',
                'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"show_resume","input":{}}}',
                "",
                'event: content_block_delta',
                'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"resume_id\\": \\"123\\"}"}}',
                "",
                'event: message_stop',
                'data: {"type":"message_stop"}',
                "",
            ]
        )

        def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                headers={"content-type": "text/event-stream"},
                text=events,
            )

        transport = httpx.MockTransport(handler)
        original_client = httpx.AsyncClient

        class MockAsyncClient(httpx.AsyncClient):
            def __init__(self, *args, **kwargs):
                kwargs["transport"] = transport
                super().__init__(*args, **kwargs)

        httpx.AsyncClient = MockAsyncClient
        try:
            message = await self.adapter.ask_tool_stream(
                messages=[{"role": "user", "content": "你是谁"}],
                tools=[
                    {
                        "type": "function",
                        "function": {
                            "name": "show_resume",
                            "description": "展示简历",
                            "parameters": {"type": "object", "properties": {}},
                        },
                    }
                ],
                tool_choice="auto",
                temperature=None,
            )
        finally:
            httpx.AsyncClient = original_client

        self.assertIsNotNone(message)
        self.assertEqual(message.content, "你好")
        self.assertEqual(message.tool_calls[0].function.name, "show_resume")
        self.assertEqual(
            json.loads(message.tool_calls[0].function.arguments),
            {"resume_id": "123"},
        )


if __name__ == "__main__":
    unittest.main()
