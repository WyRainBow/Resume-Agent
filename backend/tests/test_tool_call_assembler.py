from __future__ import annotations

from backend.agent.llm_streaming.tool_call_assembler import ToolCallAssembler


def test_single_tool_call_multi_argument_chunks() -> None:
    assembler = ToolCallAssembler()
    assembler.ingest(
        [
            {
                "index": 0,
                "id": "call_1",
                "function": {
                    "name": "search",
                    "arguments": '{"query":"hel',
                },
            }
        ]
    )
    assembler.ingest([{"index": 0, "function": {"arguments": 'lo"}'}}])

    tool_calls = assembler.build()
    assert len(tool_calls) == 1
    assert tool_calls[0]["id"] == "call_1"
    assert tool_calls[0]["function"]["name"] == "search"
    assert tool_calls[0]["function"]["arguments"] == '{"query":"hello"}'
    assert assembler.is_ready(finish_reason="tool_calls")


def test_multiple_tool_calls_interleaved_indices() -> None:
    assembler = ToolCallAssembler()
    assembler.ingest(
        [
            {
                "index": 0,
                "id": "call_a",
                "function": {"name": "web_search", "arguments": '{"q":"py'},
            },
            {
                "index": 1,
                "id": "call_b",
                "function": {"name": "open_url", "arguments": '{"url":"https://'},
            },
        ]
    )
    assembler.ingest(
        [
            {"index": 0, "function": {"arguments": 'thon"}'}},
            {"index": 1, "function": {"arguments": 'example.com"}'}},
        ]
    )

    tool_calls = assembler.build()
    assert len(tool_calls) == 2
    assert tool_calls[0]["id"] == "call_a"
    assert tool_calls[0]["function"]["arguments"] == '{"q":"python"}'
    assert tool_calls[1]["id"] == "call_b"
    assert tool_calls[1]["function"]["arguments"] == '{"url":"https://example.com"}'


def test_content_and_tool_calls_interleaved_readiness() -> None:
    assembler = ToolCallAssembler()
    assembler.ingest(
        [
            {
                "index": 0,
                "id": "call_mix",
                "function": {"name": "do_work", "arguments": '{"a":'},
            }
        ]
    )
    assert not assembler.is_ready()

    assembler.ingest([{"index": 0, "function": {"arguments": "1}"}}])
    assert assembler.is_ready()
