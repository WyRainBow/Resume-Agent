"""工具调用构造（Wave 2a-S4b）：从 Manus.think() / _handle_direct_tool_call /
_handle_optimize_confirm 迁出 5 处手工构造 ToolCall 的"纯构造"逻辑。

职责边界：只做**纯构造**——ToolCall 组装、descriptions 文案拼接、memory 消息
与结构化结果的准备；不执行副作用（不写 memory、不改 state、不发 SSE）。副作用
统一由 Manus._apply_invocation(inv) 落地。决策（EDIT_CV 无简历 fallback、
LOAD_RESUME hint 的 LLM 调用、cv_reader_agent 文件路径补全——补全耦合 hint 的
LLM 输入，留在 Manus）不进本模块。

id 策略：时间戳类 id（show_resume / get_resume_detail / resume_diagnosis）改由
注入的 id_factory 生成，默认用单调计数器替代原来的 int(time.time()*1000)(+1)
写法（前端仅把 tool_call_id 当去重 key，不解析格式，改动安全）。
_handle_direct_tool_call 的 call_{tool} 与应用优化的 call_apply_optimization 是
固定 id，逐字保留、不进 id_factory。
"""
import itertools
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from backend.agent.application.conversation.conversation_state import Intent
from backend.agent.schema import Message, ToolCall


class DispatchOutcome(Enum):
    """一次工具调用构造的落地语义（Manus._apply_invocation 据此决定返回值）。"""

    CONTINUE = "continue"      # 继续 ReAct 执行工具（return True）
    FINISH = "finish"          # 结束本轮（state=FINISHED，return False）
    EMIT_ONLY = "emit_only"    # 只落工具事件，后续段（如 qwq 流）留在 think()（return None）


@dataclass
class ToolInvocation:
    """一次工具调用构造的完整结果（Manus 侧统一落地）。"""

    tool_calls: List[ToolCall]
    memory_messages: List[Message]
    structured_results: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    outcome: DispatchOutcome = DispatchOutcome.CONTINUE
    finish_after_load_resume: bool = False
    just_applied_optimization: bool = False


class ToolInvocationBuilder:
    """无状态工具调用构造器：每个 build_* 是纯函数，返回 ToolInvocation。"""

    def __init__(self, id_factory: Optional[Callable[[str], str]] = None) -> None:
        if id_factory is None:
            counter = itertools.count(1)
            id_factory = lambda prefix: f"call_{prefix}_{next(counter)}"  # noqa: E731
        self._id_factory = id_factory

    # ── ANALYZE_RESUME 无简历 → show_resume 引导（原 manus.py:799-816）──
    def build_show_resume_hint(self, hint_message: str) -> ToolInvocation:
        manual_tool_call = ToolCall(
            id=self._id_factory("show_resume"),
            function={"name": "show_resume", "arguments": "{}"},
        )
        memory = [
            Message.assistant_message(hint_message),
            Message.from_tool_calls(
                content="我将先打开简历选择面板。",
                tool_calls=[manual_tool_call],
            ),
        ]
        return ToolInvocation(
            tool_calls=[manual_tool_call],
            memory_messages=memory,
            outcome=DispatchOutcome.CONTINUE,
        )

    # ── 诊断 Phase1：未指定目标岗位，先询问方向（原 manus.py:832-869）──
    def build_diagnosis_phase1(
        self, resume_meta: dict, ask_message: str
    ) -> ToolInvocation:
        name = resume_meta.get("name", "当前简历")
        detail_tool_call = ToolCall(
            id=self._id_factory("get_resume_detail"),
            function={"name": "get_resume_detail", "arguments": "{}"},
        )
        structured = {
            detail_tool_call.id: {
                "type": "resume_detail",
                "status": "success",
                "tool": "get_resume_detail",
                "resume": resume_meta,
            }
        }
        memory = [
            Message.from_tool_calls(
                content=f"已读取简历《{name}》，准备进行诊断...",
                tool_calls=[detail_tool_call],
            ),
            Message.tool_message(
                content="获取简历详情执行成功",
                name="get_resume_detail",
                tool_call_id=detail_tool_call.id,
            ),
            Message.assistant_message(ask_message),
        ]
        return ToolInvocation(
            tool_calls=[detail_tool_call],
            memory_messages=memory,
            structured_results=structured,
            outcome=DispatchOutcome.FINISH,
        )

    # ── 诊断 Phase2：两步 ToolCall 序列（原 manus.py:882-904；qwq 流留 think）──
    def build_diagnosis_phase2(self, diagnosis_payload: dict) -> ToolInvocation:
        detail_tool_call = ToolCall(
            id=self._id_factory("get_resume_detail"),
            function={"name": "get_resume_detail", "arguments": "{}"},
        )
        diagnosis_tool_call = ToolCall(
            id=self._id_factory("resume_diagnosis"),
            function={"name": "resume-diagnosis", "arguments": "{}"},
        )
        structured = {
            detail_tool_call.id: {
                "type": "resume_detail",
                "status": "success",
                "tool": "get_resume_detail",
                "resume": diagnosis_payload["resume_meta"],
            },
            diagnosis_tool_call.id: diagnosis_payload["structured"],
        }
        memory = [
            Message.from_tool_calls(
                content="正在执行简历深度诊断...",
                tool_calls=[detail_tool_call, diagnosis_tool_call],
            ),
            Message.tool_message(
                content="获取简历详情执行成功",
                name="get_resume_detail",
                tool_call_id=detail_tool_call.id,
            ),
            Message.tool_message(
                content="resume-diagnosis执行成功",
                name="resume-diagnosis",
                tool_call_id=diagnosis_tool_call.id,
            ),
        ]
        return ToolInvocation(
            tool_calls=[detail_tool_call, diagnosis_tool_call],
            memory_messages=memory,
            structured_results=structured,
            outcome=DispatchOutcome.EMIT_ONLY,
        )

    # ── 直接工具调用（原 _handle_direct_tool_call:1284-1347 的纯构造段）──
    def build_direct_tool_call(
        self,
        tool: str,
        tool_args: dict,
        intent: "Intent",
        *,
        load_resume_hint: Optional[str] = None,
        skip_pre_edit_notice: bool = False,
    ) -> ToolInvocation:
        arguments = json.dumps(tool_args) if tool_args else "{}"
        manual_tool_call = ToolCall(
            id=f"call_{tool}",
            function={"name": tool, "arguments": arguments},
        )

        descriptions = {
            "cv_reader_agent": "我将先加载您的简历数据",
            "show_resume": "我将先打开简历选择面板",
            "cv_analyzer_agent": "我将分析您的简历",
            "cv_editor_agent": "我将编辑您的简历",
        }
        content = descriptions.get(tool, f"我将调用 {tool} 工具")
        if tool_args.get("section"):
            content += f"，重点优化：{tool_args['section']}"

        finish_after_load_resume = False
        if intent == Intent.LOAD_RESUME:
            content = load_resume_hint
            finish_after_load_resume = True

        if intent == Intent.EDIT_CV and not skip_pre_edit_notice:
            memory = [
                Message.assistant_message(
                    "Thought: 我识别到你要做简历字段修改，将直接执行编辑并返回前后对比。"
                ),
                Message.assistant_message(
                    "Response: 收到，正在修改。完成后我会给你“修改前 / 修改后”的对比结果。"
                    "我现在开始执行简历修改。"
                ),
                Message.from_tool_calls(
                    content="我现在开始执行简历修改。",
                    tool_calls=[manual_tool_call],
                ),
            ]
        elif intent == Intent.EDIT_CV and skip_pre_edit_notice:
            memory = [
                Message.from_tool_calls(
                    content="我现在开始执行简历修改。",
                    tool_calls=[manual_tool_call],
                )
            ]
        else:
            memory = [
                Message.from_tool_calls(
                    content=content,
                    tool_calls=[manual_tool_call],
                )
            ]

        return ToolInvocation(
            tool_calls=[manual_tool_call],
            memory_messages=memory,
            outcome=DispatchOutcome.CONTINUE,
            finish_after_load_resume=finish_after_load_resume,
        )

    # ── 应用优化建议 → cv_editor_agent（原 _handle_optimize_confirm:1483-1502）──
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
            outcome=DispatchOutcome.CONTINUE,
            just_applied_optimization=True,
        )
