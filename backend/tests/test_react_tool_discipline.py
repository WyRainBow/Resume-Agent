import asyncio

from backend.agent.agent.toolcall import ToolCallAgent
from backend.agent.schema import Function, Message, ToolCall


def test_think_keeps_only_one_tool_call_per_react_step(monkeypatch):
    agent = ToolCallAgent(next_step_prompt="")

    async def fake_ask_tool(**_kwargs):
        return Message(
            role="assistant",
            content="先执行第一项，再看结果决定下一步。",
            tool_calls=[
                ToolCall(
                    id="call-1",
                    function=Function(name="list_resumes", arguments="{}"),
                ),
                ToolCall(
                    id="call-2",
                    function=Function(name="get_resume_detail", arguments="{}"),
                ),
            ],
        )

    monkeypatch.setattr(agent.llm, "ask_tool", fake_ask_tool)

    assert asyncio.run(agent.think()) is True
    assert [call.id for call in agent.tool_calls] == ["call-1"]
    assert [call.id for call in agent.memory.messages[-1].tool_calls] == ["call-1"]
