"""工具调用构造（Wave 2a-S4b 迁入；2026-07-11 LLM-first 了断后收缩）。

原 5 个构造器中，show_resume 引导 / 诊断 Phase1/Phase2 / 直调工具 / staged-edit
只服务规则分派路径（AGENT_LLM_FIRST_ROUTING=false 的回退能力），该回退已按
2026-07-11 计划物理删除；现仅保留 optimize-confirm 活路径使用的
build_apply_optimization。

职责边界：只做**纯构造**——ToolCall 组装与 memory 消息准备；不执行副作用
（不写 memory、不改 state、不发 SSE）。副作用统一由 Manus._apply_invocation(inv)
落地。
"""
import json
from dataclasses import dataclass
from typing import List

from backend.agent.schema import Message, ToolCall


@dataclass
class ToolInvocation:
    """一次工具调用构造的完整结果（Manus 侧统一落地）。"""

    tool_calls: List[ToolCall]
    memory_messages: List[Message]
    just_applied_optimization: bool = False


class ToolInvocationBuilder:
    """无状态工具调用构造器：build_* 是纯函数，返回 ToolInvocation。"""

    # ── 应用优化建议 → cv_editor_agent（optimize-confirm 快路径，唯一存活构造器）──
    def build_apply_optimization(
        self, edit_path: str, edit_value: str, suggestion_title: str
    ) -> ToolInvocation:
        manual_tool_call = ToolCall(
            id="call_apply_optimization",
            function={
                "name": "cv_editor_agent",
                "arguments": json.dumps(
                    {"path": edit_path, "action": "update", "value": edit_value}
                ),
            },
        )
        memory = [
            Message.from_tool_calls(
                content=f"✅ 正在应用优化：{suggestion_title}\n路径：{edit_path}",
                tool_calls=[manual_tool_call],
            )
        ]
        return ToolInvocation(
            tool_calls=[manual_tool_call],
            memory_messages=memory,
            just_applied_optimization=True,
        )
