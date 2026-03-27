"""Agent stream output handler.

Handles streaming agent execution results to SSE clients.
当前主链仍基于 StreamEvent -> SSE 输出；
CLTP 相关能力作为过渡兼容资产逐步收敛。
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Any, AsyncIterator, Callable, Optional, Tuple, List, Set
from datetime import datetime


def parse_thought_response(content: str) -> Tuple[Optional[str], Optional[str]]:
    """
    解析 LLM 输出中的 Thought 和 Response 部分

    Deprecated: CLTP 已提供标准的 think/plain content chunks，
    后续在完成前端迁移后移除此函数与相关调用。
    TODO(cltp): 前端完全迁移后删除 parse_thought_response

    Returns:
        (thought, response) - 如果没有找到对应部分则为 None
    """
    # #region debug log (已禁用硬编码路径)
    import json
    # 使用 logger 代替硬编码路径，避免在不同系统上出错
    try:
        logger.debug(f"[DEBUG] parse_thought_response called: content_length={len(content) if content else 0}")
    except Exception:
        pass
    # #endregion

    thought = None
    response = None

    if not content or not content.strip():
        """
        # debug log (已禁用)
        with open('/Users/wy770/AI/.cursor/debug.log', 'a') as f:
            f.write(json.dumps({
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "C",
                "location": "agent_stream.py:parse_thought_response:EMPTY",
                "message": "content is empty or whitespace",
                "data": {"content": content},
                "timestamp": int(__import__('time').time() * 1000)
            }) + '\n')
        """
        return None, None

    # 使用更严谨的正则表达式匹配 Thought: 和 Response:
    # 考虑可能存在的换行和空格，支持多种格式变体
    # 匹配模式：
    # 1. Thought: ... Response: ...
    # 2. **Thought:** ... **Response:** ...
    # 3. Thought: ... (没有 Response)
    # 4. 思考：... 回复：... (中文格式)

    # 尝试多种匹配模式
    patterns = [
        # 标准格式：Thought: ... Response: ...（支持同一行或换行）
        (
            r'(?:^|\n)\s*(?:Thought|思考)[:：]\s*(.*?)(?=\s*(?:Response|回复|Answer|Final\s*Answer|最终回复)[:：]|$)',
            r'(?:^|\n|\s)(?:Response|回复|Answer|Final\s*Answer|最终回复)[:：]\s*(.*)',
        ),
        # 加粗格式：**Thought:** ... **Response:** ...
        (r'(?:^|\n)\s*\*\*Thought\*\*[:：]\s*(.*?)(?=\n\s*\*\*Response\*\*[:：]|$)',
         r'(?:^|\n)\s*\*\*Response\*\*[:：]\s*(.*)'),
        # 1. Thought: ... 2. Response: ... (带编号)
        (r'(?:^|\n)\s*1\.\s*(?:Thought|思考)[:：]\s*(.*?)(?=\n\s*2\.\s*(?:Response|回复)[:：]|$)',
         r'(?:^|\n)\s*2\.\s*(?:Response|回复)[:：]\s*(.*)'),
    ]

    for idx, (thought_pattern, response_pattern) in enumerate(patterns):
        thought_match = re.search(thought_pattern, content, re.DOTALL | re.IGNORECASE | re.MULTILINE)
        response_match = re.search(response_pattern, content, re.DOTALL | re.IGNORECASE | re.MULTILINE)

        if thought_match:
            thought = thought_match.group(1).strip()
        if response_match:
            response = response_match.group(1).strip()

        """
        # debug log (已禁用)
        if thought_match or response_match:
            with open('/Users/wy770/AI/.cursor/debug.log', 'a') as f:
                f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "B",
                    "location": f"agent_stream.py:parse_thought_response:PATTERN_{idx}",
                    "message": "pattern matched",
                    "data": {
                        "pattern_idx": idx,
                        "thought_matched": thought_match is not None,
                        "response_matched": response_match is not None,
                        "thought_preview": thought[:100] if thought else None,
                        "response_preview": response[:100] if response else None
                    },
                    "timestamp": int(__import__('time').time() * 1000)
                }) + '\n')
        """

        if thought or response:
            break

    # 启发式修复：
    # 一些模型只输出 "Thought: xxx\n<actual answer>"，不带 "Response:" 标签。
    # 这种情况下把第一行视作 thought，其余正文视作 response，
    # 避免最终 plain 内容里残留 "Thought:" 前缀。
    if thought and not response:
        thought_prefix = re.match(
            r"^\s*(?:\*\*)?(?:Thought|思考)(?:\*\*)?\s*[:：]\s*",
            content,
            re.IGNORECASE,
        )
        if thought_prefix:
            remaining = content[thought_prefix.end() :].strip()
            # 优先按空行拆分，否则按首个换行拆分
            parts = re.split(r"\n{2,}|\n", remaining, maxsplit=1)
            if len(parts) == 2:
                first_line = parts[0].strip()
                body = parts[1].strip()
                if first_line and body:
                    thought = first_line
                    response = body
            elif remaining:
                # 至少移除前缀，避免在 plain 中出现 "Thought:"
                thought = parts[0].strip()
                response = None

    # 如果找到了 Thought 但没找到 Response（还在生成中），或者找到了 Response
    if thought or response:
        """
        # debug log (已禁用)
        with open('/Users/wy770/AI/.cursor/debug.log', 'a') as f:
            f.write(json.dumps({
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "B",
                "location": "agent_stream.py:parse_thought_response:SUCCESS",
                "message": "parse_thought_response success",
                "data": {
                    "thought_found": thought is not None,
                    "response_found": response is not None,
                    "thought_length": len(thought) if thought else 0,
                    "response_length": len(response) if response else 0
                },
                "timestamp": int(__import__('time').time() * 1000)
            }) + '\n')
        """
        return thought, response

    # 如果都没有找到格式化的输出，返回原始内容作为 response
    # #region debug log (已禁用硬编码路径)
    # with open('/Users/wy770/AI/.cursor/debug.log', 'a') as f:
    #     f.write(json.dumps({
    #         "sessionId": "debug-session",
    #         "runId": "run1",
    #         "hypothesisId": "A",
    #         "location": "agent_stream.py:parse_thought_response:NO_MATCH",
    #         "message": "no pattern matched, returning original content as response",
    #         "data": {
    #             "content_preview": content[:200],
    #             "content_contains_thought": "Thought:" in content or "思考:" in content or "**Thought**" in content,
    #             "content_contains_response": "Response:" in content or "回复:" in content or "**Response**" in content
    #         },
    #         "timestamp": int(__import__('time').time() * 1000)
    #     }) + '\n')
    # #endregion
    return None, content

from backend.agent.agent.manus import Manus
from backend.agent.schema import AgentState as SchemaAgentState, Message, Role
from backend.agent.web.streaming.events import (
    EventType,
    StreamEvent,
    ThoughtEvent,
    ToolCallEvent,
    ToolResultEvent,
    ResumeUpdatedEvent,
    AnswerEvent,
    AgentStartEvent,
    AgentEndEvent,
    AgentErrorEvent,
    SystemEvent,
    SuggestionsEvent,
)
from backend.agent.web.streaming.agent_state import AgentState, StateInfo
from backend.agent.web.streaming.state_machine import AgentStateMachine

logger = logging.getLogger(__name__)


EventSender = Callable[[dict[str, Any]], asyncio.Task]

# 分析结果标记
ANALYSIS_RESULT_MARKERS = [
    "📊 分析结果摘要",
    "💡 优化建议",
    "🎯 我最推荐的优化",
    "是否要应用这个优化",
    "是否要优化",
    "是否要优化这段教育经历",
    "综合评分"
]


@dataclass
class StepStreamState:
    step_id: int
    last_stream_text: str = ""
    last_stream_thought: str = ""
    last_stream_response: str = ""
    stream_emitted: bool = False
    final_emitted: bool = False


class AgentStream:
    """Handles streaming agent execution to WebSocket.

    使用与原始 server.py 相同的执行逻辑：
    - 手动步骤循环
    - 调用 agent.step()
    - 发送 step, thought, tool_call, tool_result, answer 事件
    - 去重：防止发送重复内容
    """

    def __init__(
        self,
        agent: Manus,
        session_id: str,
        state_machine: AgentStateMachine,
        event_sender: EventSender,
        chat_history_manager: Optional[Any] = None,
    ) -> None:
        """Initialize the agent stream.

        Args:
            agent: The Manus agent instance
            session_id: Unique session identifier
            state_machine: The state machine for tracking execution
            event_sender: Async function to send events
            chat_history_manager: Optional chat history manager
        """
        self.agent = agent
        self._session_id = session_id
        self._state_machine = state_machine
        self._send_event = event_sender
        self._chat_history_manager = chat_history_manager

        # 🚨 去重：跟踪已发送的内容
        self._sent_thoughts: set[str] = set()
        self._sent_tools: set[str] = set()
        self._sent_tool_results: set[str] = set()
        self._last_answer_content: str = ""
        self._answer_sent_in_loop: bool = False  # 🚨 跟踪循环中是否已发送过 answer
        self._answer_event_seq: int = 0
        self._emitted_answer_fingerprints: set[str] = set()
        self._final_answer_sent: bool = False
        self._current_step_stream_state: Optional[StepStreamState] = None
        self._stream_cancel_event: Optional[asyncio.Event] = None

    def _next_answer_event_seq(self) -> int:
        self._answer_event_seq += 1
        return self._answer_event_seq

    def _build_answer_event(
        self,
        *,
        content: str,
        is_complete: bool,
        delta: Optional[str] = None,
    ) -> Optional[AnswerEvent]:
        content_norm = self._normalize_text(content)
        if not content_norm:
            return None

        if is_complete and self._final_answer_sent:
            return None

        delta_norm = self._normalize_text(delta)
        fingerprint = f"{int(is_complete)}|{content_norm}|{delta_norm}"
        if fingerprint in self._emitted_answer_fingerprints:
            return None

        self._emitted_answer_fingerprints.add(fingerprint)
        self._last_answer_content = content_norm
        if is_complete:
            self._final_answer_sent = True
            self._answer_sent_in_loop = True

        return AnswerEvent(
            content=content,
            delta=delta,
            is_complete=is_complete,
            session_id=self._session_id,
            event_seq=self._next_answer_event_seq(),
        )

    def _ensure_assistant_message(self, content: Optional[str]) -> None:
        """Ensure the assistant message is present in memory for persistence."""
        if not content or not content.strip():
            return
        
        content_clean = content.strip()
        
        # 提取 Response 部分（如果存在 Thought: ... Response: 格式）
        content_response_part = content_clean
        if "Response:" in content_clean:
            # 如果 content 包含 Response:，提取 Response: 之后的部分
            content_response_part = content_clean.split("Response:")[-1].strip()
        
        for msg in reversed(self.agent.memory.messages):
            if msg.role == Role.ASSISTANT:
                msg_content = (msg.content or "").strip()
                
                # 完全匹配
                if msg_content == content_clean:
                    return
                
                # 检查是否是 Thought + Response 格式，且 Response 部分匹配
                if "Response:" in msg_content:
                    msg_response_part = msg_content.split("Response:")[-1].strip()
                    # 如果 content 的 Response 部分与已存在的 Response 部分相同
                    if msg_response_part == content_response_part:
                        return
                    # 如果 content 完全等于已存在的 Response 部分
                    if msg_response_part == content_clean:
                        return
                
                # 检查反向：content_clean 是否包含在 msg_content 中（作为子串）
                if content_clean in msg_content:
                    return
                
                # 检查反向：msg_content 的 Response 部分是否包含 content_clean
                if "Response:" in msg_content:
                    msg_response_part = msg_content.split("Response:")[-1].strip()
                    if content_clean in msg_response_part:
                        return
                
                break
        
        self.agent.memory.add_message(Message.assistant_message(content))

    @staticmethod
    def _normalize_text(text: Optional[str]) -> str:
        return (text or "").strip()

    def _get_latest_assistant_content(self) -> str:
        for msg in reversed(self.agent.memory.messages):
            if msg.role == "assistant" and msg.content:
                return msg.content
        return ""

    def _should_skip_complete_answer(self, content: str) -> bool:
        state = self._current_step_stream_state
        if not state or not state.final_emitted:
            return False
        return self._normalize_text(content) == self._normalize_text(state.last_stream_text)

    def _extract_suggestions(self, content: str) -> tuple[str, list[dict]]:
        """Parse %%SUGGESTIONS%%[...]%%END%% marker from content.

        Returns (cleaned_content, suggestions_list).
        cleaned_content has the marker stripped.
        """
        import re, json
        # 尝试完整匹配
        pattern = r'%%SUGGESTIONS%%(\[.*?\])%%END%%'
        match = re.search(pattern, content, re.DOTALL)

        if match:
            try:
                items = json.loads(match.group(1))
                cleaned = content[:match.start()].rstrip() + content[match.end():]
                return cleaned.rstrip(), items
            except Exception:
                pass

        # 如果没有完整匹配，尝试半开放匹配（容错：模型可能没输出完 %%END%%）
        partial_pattern = r'%%SUGGESTIONS%%(\[.*)'
        partial_match = re.search(partial_pattern, content, re.DOTALL)
        if partial_match:
            try:
                json_str = partial_match.group(1).strip()
                # 补全可能的闭合括号
                if not json_str.endswith(']'):
                    # 寻找最后一个完整的 JSON 对象结束点
                    last_obj_end = json_str.rfind('}')
                    if last_obj_end != -1:
                        json_str = json_str[:last_obj_end+1] + ']'

                items = json.loads(json_str)
                cleaned = content[:partial_match.start()].rstrip()
                return cleaned.rstrip(), items
            except Exception:
                pass

        return content, []

    def _serialize_tool_calls(self, tool_calls: Any) -> str:
        """Serialize tool calls for deduplication."""
        if not tool_calls:
            return ""
        normalized: List[Any] = []
        for call in tool_calls:
            if hasattr(call, "model_dump"):
                normalized.append(call.model_dump())
            elif hasattr(call, "dict"):
                normalized.append(call.dict())
            elif isinstance(call, dict):
                normalized.append(call)
            else:
                normalized.append(str(call))
        return json.dumps(normalized, ensure_ascii=False, sort_keys=True, default=str)

    def _dedupe_messages(self, messages: List[Message]) -> List[Message]:
        """去重消息列表，防止重复保存到历史记录。"""
        if not messages:
            return messages

        deduped: List[Message] = []
        seen_keys: Set[str] = set()

        for msg in messages:
            if msg.role == Role.USER:
                # 用户消息已在 stream.py 中写入 history
                continue

            content = (msg.content or "").strip()
            if msg.role == Role.ASSISTANT:
                response_part = content
                if "Response:" in content:
                    response_part = content.split("Response:")[-1].strip()

                tool_calls_str = self._serialize_tool_calls(msg.tool_calls)
                key = f"assistant|||{content}|||{tool_calls_str}"
                response_key = None
                if response_part and response_part != content:
                    response_key = f"assistant|||{response_part}|||{tool_calls_str}"

                if key in seen_keys or (response_key and response_key in seen_keys):
                    logger.debug(
                        f"[AgentStream] Skip duplicate assistant message: {content[:50]}..."
                    )
                    continue

                seen_keys.add(key)
                if response_key:
                    seen_keys.add(response_key)

            elif msg.role == Role.TOOL:
                key = f"tool|||{msg.name}|||{msg.tool_call_id}|||{content}"
                if key in seen_keys:
                    logger.debug(
                        f"[AgentStream] Skip duplicate tool message: {msg.name}"
                    )
                    continue
                seen_keys.add(key)
            else:
                key = f"{msg.role}|||{content}"
                if key in seen_keys:
                    continue
                seen_keys.add(key)

            deduped.append(msg)

        return deduped

    async def execute(self, user_message: str) -> AsyncIterator[StreamEvent]:
        """Execute agent with streaming events.

        使用手动步骤循环，与原始 server.py 逻辑相同。

        Args:
            user_message: The user's input message

        Yields:
            StreamEvent instances during execution
        """
        start_memory_len = len(self.agent.memory.messages)
        try:
            # Start state
            await self._state_machine.transition_to(
                AgentState.STARTING,
                message="Starting agent execution",
                data={"user_message": user_message},
            )

            # 转换为 SSE 格式（向后兼容）
            yield AgentStartEvent(
                agent_name="Manus",
                task=user_message,
                session_id=self._session_id,
            )

            # Running state
            await self._state_machine.transition_to(AgentState.RUNNING)

            # 确保智能体处于 IDLE 状态
            if self.agent.state != SchemaAgentState.IDLE:
                self.agent.state = SchemaAgentState.IDLE
                self.agent.current_step = 0

            # 清理不完整的消息序列
            self.agent.memory.cleanup_incomplete_sequences()

            # 添加用户消息到 memory
            self.agent.memory.add_message(Message.user_message(user_message))

            # 同步到 LangChain Memory
            if hasattr(self.agent, '_langchain_memory') and self.agent._langchain_memory:
                self.agent._langchain_memory.add_user_message(user_message)

            # 重置 answer 发送标志
            self._answer_sent_in_loop = False

            # 根据任务类型动态调整最大步数
            if any(keyword in user_message.lower() for keyword in ["分析", "analyze", "深入", "详细"]):
                max_steps = 10
            else:
                max_steps = 5

            # 记录最后发送的思考内容
            last_sent_thought = None

            # 手动执行步骤循环
            async with self.agent.state_context(SchemaAgentState.RUNNING):
                while self.agent.current_step < max_steps and self.agent.state != SchemaAgentState.FINISHED:
                    if self._state_machine.stop_requested:
                        # 🚨 优化停止状态反馈
                        stop_reason = self._state_machine.state_info.data.get("reason", "manual")
                        message = "Execution stopped by user"
                        if stop_reason == "session_switch":
                            message = "Execution stopped due to session switch"

                        await self._state_machine.transition_to(AgentState.STOPPED, message=message)
                        yield SystemEvent(
                            message=message,
                            level="info",
                            session_id=self._session_id,
                        )
                        return

                    self.agent.current_step += 1

                    # 发送步骤事件
                    yield SystemEvent(
                        message=f"执行步骤 {self.agent.current_step}/{max_steps}",
                        level="info",
                        session_id=self._session_id,
                    )

                    # 记录执行前的消息数量
                    msg_count_before = len(self.agent.memory.messages)

                    # 真流式：并发执行 step 与内容流消费
                    step_state = StepStreamState(step_id=self.agent.current_step)
                    self._current_step_stream_state = step_state
                    # Keep ordered stream chunks to preserve true incremental output.
                    stream_queue: asyncio.Queue[str] = asyncio.Queue()
                    self._stream_cancel_event = asyncio.Event()

                    async def _on_content_delta(content: str) -> None:
                        if not content:
                            return
                        if self._stream_cancel_event and self._stream_cancel_event.is_set():
                            return
                        await stream_queue.put(content)

                    if hasattr(self.agent, "set_stream_content_callback"):
                        self.agent.set_stream_content_callback(
                            _on_content_delta, self._stream_cancel_event
                        )

                    step_task = asyncio.create_task(self.agent.step())
                    step_result: Optional[str] = None
                    try:
                        while not step_task.done() or not stream_queue.empty():
                            if self._state_machine.stop_requested:
                                # 🚨 处理真流式执行中的停止
                                stop_reason = self._state_machine.state_info.data.get("reason", "manual")
                                message = "Execution stopped by user"
                                if stop_reason == "session_switch":
                                    message = "Execution stopped due to session switch"

                                if self._stream_cancel_event:
                                    self._stream_cancel_event.set()
                                if not step_task.done():
                                    step_task.cancel()
                                break

                            # 🚨 立即流式推送：Manus.think() 在执行耗时操作前设置此字段，
                            # 在此轮询并立即 yield，让前端先看到"预回复"
                            if hasattr(self.agent, "_pending_immediate_stream") and self.agent._pending_immediate_stream:
                                pending = self.agent._pending_immediate_stream
                                self.agent._pending_immediate_stream = None
                                pending_event = self._build_answer_event(
                                    content=pending.get("content", ""),
                                    is_complete=pending.get("is_complete", False),
                                    delta=pending.get("delta"),
                                )
                                if pending_event:
                                    yield pending_event

                            try:
                                streamed_content = await asyncio.wait_for(
                                    stream_queue.get(), timeout=0.01
                                )
                            except asyncio.TimeoutError:
                                continue

                            if (
                                streamed_content
                                and self._normalize_text(
                                    streamed_content
                                    if streamed_content.startswith(step_state.last_stream_text)
                                    else (step_state.last_stream_text + streamed_content)
                                )
                                != self._normalize_text(step_state.last_stream_text)
                            ):
                                # Backward compatibility:
                                # - If callback sends cumulative text, replace directly.
                                # - If callback sends delta text, append incrementally.
                                if streamed_content.startswith(step_state.last_stream_text):
                                    step_state.last_stream_text = streamed_content
                                else:
                                    step_state.last_stream_text += streamed_content
                                step_state.stream_emitted = True

                                # Try to preserve "Thought/Response" UX while streaming.
                                thought_part, response_part = parse_thought_response(
                                    step_state.last_stream_text
                                )
                                if (
                                    thought_part
                                    and self._normalize_text(thought_part)
                                    != self._normalize_text(step_state.last_stream_thought)
                                ):
                                    step_state.last_stream_thought = thought_part
                                    yield ThoughtEvent(
                                        thought=thought_part,
                                        session_id=self._session_id,
                                    )

                                stream_answer = (
                                    response_part
                                    if response_part
                                    else ("" if thought_part else step_state.last_stream_text)
                                )
                                if (
                                    stream_answer
                                    and self._normalize_text(stream_answer)
                                    != self._normalize_text(step_state.last_stream_response)
                                ):
                                    answer_delta = stream_answer
                                    if stream_answer.startswith(step_state.last_stream_response):
                                        answer_delta = stream_answer[
                                            len(step_state.last_stream_response):
                                        ]
                                    step_state.last_stream_response = stream_answer
                                    if answer_delta:
                                        answer_event = self._build_answer_event(
                                            content=stream_answer,
                                            delta=answer_delta,
                                            is_complete=False,
                                        )
                                        if answer_event:
                                            yield answer_event

                        step_result = await step_task

                    except asyncio.CancelledError:
                        logger.info("[AgentStream] step_task cancelled")
                        stop_reason = self._state_machine.state_info.data.get("reason", "manual")
                        message = "Execution stopped by user"
                        if stop_reason == "session_switch":
                            message = "Execution stopped due to session switch"

                        await self._state_machine.transition_to(AgentState.STOPPED, message=message)
                        yield SystemEvent(
                            message=message,
                            level="info",
                            session_id=self._session_id,
                        )
                        return
                    finally:
                        if hasattr(self.agent, "clear_stream_content_callback"):
                            self.agent.clear_stream_content_callback()
                        self._stream_cancel_event = None

                    # 🚨 step_task 可能在 while 循环内就完成了（队列为空），在退出循环后检查 pending
                    if hasattr(self.agent, "_pending_immediate_stream") and self.agent._pending_immediate_stream:
                        pending = self.agent._pending_immediate_stream
                        self.agent._pending_immediate_stream = None
                        pending_event = self._build_answer_event(
                            content=pending.get("content", ""),
                            is_complete=pending.get("is_complete", False),
                            delta=pending.get("delta"),
                        )
                        if pending_event:
                            yield pending_event

                    logger.info(f"🔍 [DEBUG] step() 返回: {step_result}, agent.state: {self.agent.state}, _answer_sent_in_loop: {self._answer_sent_in_loop}")

                    # step 收尾：避免“流式末尾文本”与“memory 最终文本”不一致
                    final_step_content = self._get_latest_assistant_content()
                    if step_state.stream_emitted:
                        # True-streaming single-writer policy:
                        # do NOT emit answer in step-tail. The only writers are:
                        # 1) delta in stream loop
                        # 2) complete=true in FINISHED/fallback branch
                        # Here we only align memory/state to avoid missing persistence.
                        final_candidate = final_step_content or step_state.last_stream_text
                        if final_candidate:
                            thought_part, response_part = parse_thought_response(final_candidate)
                            if (
                                thought_part
                                and self._normalize_text(thought_part)
                                != self._normalize_text(step_state.last_stream_thought)
                            ):
                                step_state.last_stream_thought = thought_part
                                yield ThoughtEvent(
                                    thought=thought_part,
                                    session_id=self._session_id,
                                )

                            final_answer_content = (
                                response_part
                                if response_part
                                else (final_candidate if not thought_part else "")
                            )
                            if final_answer_content:
                                # Ensure final visible answer is persisted even when
                                # assistant memory only contains intermediate/tool messages.
                                self._ensure_assistant_message(final_answer_content)
                                step_state.last_stream_response = final_answer_content
                                # 🚨 立即流式补发：_pending_immediate_stream 先发了 pre-thought，
                                # 这里补发完整 final_answer（含真实诊断内容，is_complete=True）
                                final_event = self._build_answer_event(
                                    content=final_answer_content,
                                    is_complete=True,
                                )
                                if final_event:
                                    yield final_event

                    # 🔍 调试：检查状态变化
                    # 单一路径：循环内只发 delta，不发 complete。complete 只在循环结束后发一次。
                    if self.agent.state == SchemaAgentState.FINISHED:
                        logger.info("✅ Agent 状态已设置为 FINISHED，退出循环；complete 将在循环结束后统一发送")
                        break

                    # 实时发送新增的消息
                    new_messages = self.agent.memory.messages[msg_count_before:]

                    # 检查是否有分析工具结果
                    has_recent_analysis_result = False
                    for msg in reversed(self.agent.memory.messages[-10:]):
                        if msg.role == "tool" and msg.name == 'cv_analyzer_agent':
                            has_recent_analysis_result = True
                            break

                    # 处理新消息
                    for msg in new_messages:
                        if msg.role == "assistant":
                            # 先处理 tool_calls（assistant 消息可以同时有 content 和 tool_calls）
                            if msg.tool_calls:
                                await self._state_machine.transition_to(AgentState.TOOL_EXECUTING)
                                for tool_call in msg.tool_calls:
                                    tool_name = tool_call.function.name
                                    tool_call_id = tool_call.id  # ✅ 获取 tool_call_id

                                    # 🚨 去重：使用 tool_call_id 而不是 step 作为键
                                    if tool_call_id in self._sent_tools:
                                        logger.info(f"[跳过重复工具] {tool_name} (ID: {tool_call_id[:8]}...)")
                                        continue
                                    self._sent_tools.add(tool_call_id)

                                    tool_args = tool_call.function.arguments
                                    safe_args = str(tool_args).replace("<", r"\<").replace(">", r"\>")
                                    logger.info(f"[工具调用] {tool_name} | ID: {tool_call_id} | 参数: {safe_args[:100]}...")
                                    yield ToolCallEvent(
                                        tool_name=tool_name,
                                        tool_args=tool_args if isinstance(tool_args, (dict, str)) else {},
                                        session_id=self._session_id,
                                        tool_call_id=tool_call_id,  # ✅ 传递 tool_call_id
                                    )

                            # 再处理 content（如果有）
                            if msg.content:
                                # True-streaming 已经通过 on_content_delta 输出过增量内容，
                                # 这里不再重复发送 assistant content，避免 thought/answer 重复。
                                if step_state.stream_emitted:
                                    logger.debug(
                                        "[AgentStream] Skip assistant content replay in memory loop"
                                    )
                                    continue

                                # 🚨 去重：跳过已发送过的相同内容
                                content_hash = hash(msg.content)  # 使用完整内容，避免截断更新被误判
                                if content_hash in self._sent_thoughts:
                                    logger.debug(f"[跳过重复内容] {msg.content[:50]}...")
                                    continue
                                self._sent_thoughts.add(content_hash)

                                # 🎯 解析 Thought 和 Response 格式
                                logger.info(f"[解析前] 原始内容: {msg.content[:150]}...")

                                # #region debug log
                                import json
            # with open('/Users/wy770/AI/.cursor/debug.log', 'a') as f:
            #     f.write(json.dumps({
            #         "sessionId": "debug-session",
            #         "runId": "run1",
            #         "hypothesisId": "D",
            #         "location": "agent_stream.py:execute:LOOP_BEFORE_PARSE",
            #         "message": "before parse_thought_response in message loop",
            #         "data": {
            #             "msg_content_length": len(msg.content) if msg.content else 0,
            #             "msg_content_preview": msg.content[:300] if msg.content else None
            #         },
            #         "timestamp": int(__import__('time').time() * 1000)
            #     }) + '\n')
                                # #endregion

                                thought_part, response_part = parse_thought_response(msg.content)
                                logger.info(f"[解析后] thought={thought_part[:50] if thought_part else None}... response={response_part[:50] if response_part else None}...")

                                # #region debug log
            # with open('/Users/wy770/AI/.cursor/debug.log', 'a') as f:
            #     f.write(json.dumps({
            #         "sessionId": "debug-session",
            #         "runId": "run1",
            #         "hypothesisId": "D",
            #         "location": "agent_stream.py:execute:LOOP_AFTER_PARSE",
            #         "message": "after parse_thought_response in message loop",
            #         "data": {
            #             "thought_part_found": thought_part is not None,
            #             "response_part_found": response_part is not None,
            #             "thought_part_length": len(thought_part) if thought_part else 0,
            #             "response_part_length": len(response_part) if response_part else 0
            #         },
            #         "timestamp": int(__import__('time').time() * 1000)
            #     }) + '\n')
                                # #endregion

                                # 判断是否是分析结果回复
                                check_content = response_part or msg.content
                                contains_analysis_result = any(
                                    marker in check_content for marker in ANALYSIS_RESULT_MARKERS
                                )
                                is_final_answer = has_recent_analysis_result and contains_analysis_result

                                # 先发送 Thought（如果有）
                                if thought_part:
                                    logger.info(f"[Thought Process] {thought_part[:100]}...")
                                    # #region debug log
            # with open('/Users/wy770/AI/.cursor/debug.log', 'a') as f:
            #     f.write(json.dumps({
            #         "sessionId": "debug-session",
            #         "runId": "run1",
            #         "hypothesisId": "D",
            #         "location": "agent_stream.py:execute:LOOP_YIELD_THOUGHT",
            #         "message": "yielding ThoughtEvent in message loop",
            #         "data": {
            #             "thought_length": len(thought_part),
            #             "thought_preview": thought_part[:100]
            #         },
            #         "timestamp": int(__import__('time').time() * 1000)
            #     }) + '\n')
                                    # #endregion

                                    # 生成 CLTP content(channel='think') chunk
                                    # 关键：保持文本内容原样，不进行任何修改
                                    # 转换为 SSE 格式（向后兼容）
                                    yield ThoughtEvent(
                                        thought=thought_part,
                                        session_id=self._session_id,
                                    )
                                else:
                                    # #region debug log (已禁用硬编码路径)
                                    # with open('/Users/wy770/AI/.cursor/debug.log', 'a') as f:
                                    #     f.write(json.dumps({
                                    #         "sessionId": "debug-session",
                                    #         "runId": "run1",
                                    #         "hypothesisId": "D",
                                    #         "location": "agent_stream.py:execute:LOOP_NO_THOUGHT",
                                    #         "message": "thought_part is None in message loop, not yielding ThoughtEvent",
                                    #         "data": {},
                                    #         "timestamp": int(__import__('time').time() * 1000)
                                    #     }) + '\n')
                                    # #endregion
                                    pass

                                # Single-writer policy (Karis-aligned):
                                # memory loop no longer emits plain answer.
                                # plain comes from stream delta path + FINISHED/fallback completion only.
                                if response_part:
                                    if is_final_answer:
                                        logger.info(f"[分析结果回复候选] {response_part[:200]}...")
                                elif not thought_part:
                                    # 没有格式化输出时仅保留 thought 兼容展示，不在此处发送 answer
                                    logger.debug(f"[思考过程] {msg.content[:100]}...")
                                    yield ThoughtEvent(
                                        thought=msg.content,
                                        session_id=self._session_id,
                                    )

                        elif msg.tool_calls:
                            # 非 assistant 消息的 tool_calls（fallback）
                            await self._state_machine.transition_to(AgentState.TOOL_EXECUTING)
                            for tool_call in msg.tool_calls:
                                tool_name = tool_call.function.name
                                tool_call_id = tool_call.id  # ✅ 获取 tool_call_id
                                # 🚨 去重：使用 tool_call_id 而不是 step 作为键
                                if tool_call_id in self._sent_tools:
                                    logger.info(f"[跳过重复工具] {tool_name} (ID: {tool_call_id[:8]}...)")
                                    continue
                                self._sent_tools.add(tool_call_id)

                                tool_args = tool_call.function.arguments
                                safe_args = str(tool_args).replace("<", r"\<").replace(">", r"\>")
                                logger.info(f"[工具调用] {tool_name} | ID: {tool_call_id} | 参数: {safe_args[:100]}...")
                                yield ToolCallEvent(
                                    tool_name=tool_name,
                                    tool_args=tool_args if isinstance(tool_args, (dict, str)) else {},
                                    session_id=self._session_id,
                                    tool_call_id=tool_call_id,  # ✅ 传递 tool_call_id
                                )

                        elif msg.role == "tool":
                            # Only transition if not already in THINKING state
                            if self._state_machine.current_state != AgentState.THINKING:
                                await self._state_machine.transition_to(AgentState.THINKING)
                            content = msg.content
                            tool_call_id = msg.tool_call_id  # ✅ 获取 tool_call_id
                            tool_name = msg.name or "unknown"

                            # 清理前缀
                            if content and content.startswith("Observed output of cmd `"):
                                prefix_pattern = r"Observed output of cmd `[^`]+` executed:\n"
                                content = re.sub(prefix_pattern, "", content, count=1)
                            elif content and content.startswith("Cmd `"):
                                content = "工具执行完成，无输出内容"

                            # 限制显示长度
                            if content and len(content) > 5000:
                                content = content[:5000] + f"\n...(内容已截断，共{len(msg.content)}字符)"

                            logger.info(f"[工具结果] {tool_name} | ID: {tool_call_id} | 长度: {len(msg.content) if msg.content else 0} 字符")
                            result_key = f"{tool_name}|{tool_call_id}|{self._normalize_text(content)}"
                            if result_key in self._sent_tool_results:
                                logger.info(f"[跳过重复工具结果] {tool_name} (ID: {str(tool_call_id)[:8]}...)")
                                continue
                            self._sent_tool_results.add(result_key)
                            structured_data = None
                            if tool_name in {"web_search", "show_resume", "cv_editor_agent", "cv_reader_agent", "generate_resume", "get_resume_detail", "resume-diagnosis"} and hasattr(
                                self.agent, "get_structured_tool_result"
                            ):
                                structured_data = self.agent.get_structured_tool_result(
                                    tool_call_id
                                )
                            yield ToolResultEvent(
                                tool_name=tool_name,
                                result=content or "",
                                is_error=False,
                                session_id=self._session_id,
                                tool_call_id=tool_call_id,  # ✅ 传递 tool_call_id
                                structured_data=structured_data,
                            )

                            # 简历编辑成功后，推送完整的更新后简历 JSON 给前端。
                            # 前端收到 resume_updated 后直接替换本地状态，无需自行 re-apply diff。
                            # 注意：resume_patch 流程由前端用户确认后应用，不应提前推送 resume_updated。
                            if tool_name == "cv_editor_agent" and structured_data and structured_data.get("type") == "resume_edit_diff":
                                try:
                                    from backend.agent.tool.resume_data_store import ResumeDataStore
                                    updated_resume = ResumeDataStore.get_data(self._session_id)
                                    if updated_resume:
                                        yield ResumeUpdatedEvent(
                                            resume_data=updated_resume,
                                            session_id=self._session_id,
                                        )
                                        logger.info(f"[AgentStream] resume_updated emitted for session={self._session_id}")
                                except Exception as _ru_exc:
                                    logger.warning(f"[AgentStream] Failed to emit resume_updated: {_ru_exc}")

                            # resume_patch event
                            if tool_name == "cv_editor_agent" and structured_data and structured_data.get("type") == "resume_patch":
                                logger.info(f"[AgentStream] Emitting resume_patch: patch_id={structured_data.get('patch_id','')}, before_keys={list(structured_data.get('before',{}).keys())}, after_keys={list(structured_data.get('after',{}).keys())}")
                                from backend.agent.web.streaming.events import ResumePatchEvent
                                yield ResumePatchEvent(
                                    patch_id=structured_data.get("patch_id", ""),
                                    paths=structured_data.get("paths", []),
                                    before=structured_data.get("before", {}),
                                    after=structured_data.get("after", {}),
                                    summary=structured_data.get("summary", ""),
                                    session_id=self._session_id,
                                )

                            # resume_generated event
                            if tool_name == "generate_resume" and structured_data and structured_data.get("type") == "resume_generated":
                                from backend.agent.web.streaming.events import ResumeGeneratedEvent
                                yield ResumeGeneratedEvent(
                                    resume=structured_data.get("resume", {}),
                                    summary=structured_data.get("summary", ""),
                                    session_id=self._session_id,
                                )

                            # 🔑 关键修复：如果执行了 terminate 工具，且还没有发送过 answer
                            # 不要将技术性的 terminate 消息作为最终答案，而是跳过或使用友好消息
                            if tool_name == "terminate" and not self._answer_sent_in_loop:
                                logger.info(f"🔍 [DEBUG] terminate 工具执行完成，但没有 answer，跳过技术性消息")
                                # 标记已发送，防止后续再次处理，但不实际发送技术性消息给用户
                                self._answer_sent_in_loop = True

                    # 检查是否陷入循环
                    if self.agent.is_stuck():
                        logger.info("⚠️ Agent 检测到循环，终止执行")
                        break

                    # 检查分析任务是否完成
                    if has_recent_analysis_result:
                        has_analysis_output = False
                        for msg in reversed(self.agent.memory.messages[-10:]):
                            if msg.role == "assistant" and msg.content:
                                contains_result = any(
                                    marker in msg.content for marker in ANALYSIS_RESULT_MARKERS
                                )
                                has_content = len(msg.content) > 100
                                no_more_tools = not msg.tool_calls or len(msg.tool_calls) == 0
                                if contains_result and has_content and no_more_tools:
                                    has_analysis_output = True
                                    logger.info(f"✅ 分析结果已输出: {msg.content[:100]}...")
                                    break

                        if has_analysis_output:
                            logger.info("✅ 分析任务完成，终止循环")
                            self.agent.state = SchemaAgentState.FINISHED
                            break

            # 重置步骤计数
            self.agent.current_step = 0
            self.agent.state = SchemaAgentState.IDLE

            # 单一路径：只在此处发一次 is_complete=True（流式阶段只发 delta）
            final_answer = None
            for msg in reversed(self.agent.memory.messages):
                if msg.role == "assistant" and msg.content:
                    final_answer = msg.content
                    break
            if not final_answer:
                has_terminate = any(
                    m.role == "tool" and m.name == "terminate"
                    for m in self.agent.memory.messages
                )
                if has_terminate:
                    last_user = ""
                    for m in reversed(self.agent.memory.messages):
                        if m.role == "user":
                            last_user = getattr(m, "content", "") or ""
                            break
                    greeting_patterns = ["你好", "hello", "hi", "嗨", "哈喽", "早上好", "下午好", "晚上好"]
                    if any(p in (last_user or "").lower() for p in greeting_patterns):
                        final_answer = "你好！我是 AI 助手，很高兴见到你！我可以帮助你处理各种任务，比如搜索信息、生成报告、优化简历等。有什么我可以帮你的吗？"
                    else:
                        final_answer = "好的，还有什么我可以帮助你的吗？"
            if not final_answer:
                final_answer = "错误：Agent 执行过程中未生成有效回复、请检查任务配置或重试。"

            # 解析 Thought/Response：在唯一收尾点补发 thought（若尚未发过）
            thought_part, response_part = parse_thought_response(final_answer)
            if thought_part:
                thought_hash = hash(self._normalize_text(thought_part))
                if thought_hash not in self._sent_thoughts:
                    self._sent_thoughts.add(thought_hash)
                    yield ThoughtEvent(
                        thought=thought_part,
                        session_id=self._session_id,
                    )

            # plain 仅取 response 正文，避免 thought 混入答案
            final_content = (response_part or final_answer).strip() or final_answer
            self._ensure_assistant_message(final_content)

            # 提取建议按钮标记
            clean_content, suggestion_items = self._extract_suggestions(final_content)

            if not self._final_answer_sent and not self._should_skip_complete_answer(clean_content):
                answer_event = self._build_answer_event(
                    content=clean_content,
                    is_complete=True,
                )
                if answer_event:
                    yield answer_event

            if suggestion_items:
                yield SuggestionsEvent(items=suggestion_items, session_id=self._session_id)

            # 保存到历史记录 - 保存所有类型的消息（包括 Tool 消息）
            if self._chat_history_manager:
                # 仅保存本次执行过程中新增的消息（避免重复保存历史消息）
                new_messages = self.agent.memory.messages[start_memory_len:]

                deduped_messages = self._dedupe_messages(new_messages)

                for msg in deduped_messages:
                    if msg.role == Role.USER:
                        # 用户消息已在 stream.py 中写入 history
                        continue

                    # 保存 assistant 消息（可能包含 tool_calls）
                    if msg.role == Role.ASSISTANT:
                        # 🔑 关键修复：只保存有实际内容的 assistant 消息
                        # 过滤掉只有 tool_calls 但 content 为空的消息（技术性消息）
                        has_content = msg.content and len(msg.content.strip()) > 0
                        has_tool_calls = msg.tool_calls and len(msg.tool_calls) > 0

                        if has_content or has_tool_calls:
                            self._chat_history_manager.add_message(Message(
                                role=Role.ASSISTANT,
                                content=msg.content,
                                tool_calls=msg.tool_calls
                            ), persist=False)
                        else:
                            logger.debug(
                                f"[AgentStream] 跳过空的 assistant 消息 (无 content 且无 tool_calls)"
                            )
                    # 保存 tool 消息（关键：包含 optimization_suggestions JSON）
                    elif msg.role == Role.TOOL:
                        self._chat_history_manager.add_message(Message(
                            role=Role.TOOL,
                            content=msg.content,
                            name=msg.name,
                            tool_call_id=msg.tool_call_id
                        ), persist=False)
                        logger.debug(f"  💾 保存 Tool 消息: {msg.name}, 长度: {len(msg.content or '')}")

                # 🔑 关键修复：在所有消息添加完成后，手动触发一次持久化
                # 这确保用户消息（在 stream.py 中添加 persist=False）和所有其他消息都被保存
                self._chat_history_manager._persist_if_needed()

                logger.info(
                    f"📜 已保存对话到 ChatHistory (新增 {len(deduped_messages)} 条消息, "
                    f"总内存 {len(self.agent.memory.messages)} 条)"
                )

            # Completed state
            await self._state_machine.transition_to(
                AgentState.COMPLETED,
                message="Agent execution completed",
            )

            yield AgentEndEvent(
                agent_name="Manus",
                success=True,
                session_id=self._session_id,
            )

        except Exception as e:
            logger.exception(f"Error during agent execution: {e}")
            await self._state_machine.handle_error(e)
            if self._chat_history_manager:
                self._chat_history_manager.add_message(
                    Message.assistant_message(f"Agent运行失败：{str(e)}")
                )
            yield AgentErrorEvent(
                error_message=str(e),
                error_type=type(e).__name__,
                session_id=self._session_id,
            )

    async def send_event(self, event: StreamEvent) -> None:
        """Send an event to the client.

        Args:
            event: The event to send
        """
        try:
            task = self._send_event(event.to_dict())
            await asyncio.gather(task, return_exceptions=True)
        except Exception as e:
            logger.error(f"Error sending event: {e}")


class StreamProcessor:
    """Processes streaming agent output for multiple clients.

    Features:
    - Manage multiple active streams
    - Route events to correct clients
    - Handle stream lifecycle
    """

    def __init__(self) -> None:
        """Initialize the stream processor."""
        self._active_streams: dict[str, AgentStream] = {}
        self._lock = asyncio.Lock()

    async def start_stream(
        self,
        session_id: str,
        agent: Manus,
        state_machine: AgentStateMachine,
        event_sender: EventSender,
        user_message: str,
        chat_history_manager: Optional[Any] = None,
    ) -> AsyncIterator[StreamEvent]:
        """Start a new agent stream.

        Args:
            session_id: Unique session identifier
            agent: The Manus agent instance
            state_machine: The state machine for tracking
            event_sender: Function to send events
            user_message: The user's input
            chat_history_manager: Optional chat history manager

        Yields:
            StreamEvent instances during execution
        """
        stream = AgentStream(agent, session_id, state_machine, event_sender, chat_history_manager)

        async with self._lock:
            self._active_streams[session_id] = stream

        # Execute stream and yield events
        try:
            async for event in stream.execute(user_message):
                yield event
        finally:
            await self.remove_stream(session_id)

    async def remove_stream(self, session_id: str) -> None:
        """Remove a completed stream.

        Args:
            session_id: The session ID whose stream to remove
        """
        async with self._lock:
            self._active_streams.pop(session_id, None)

    def has_active_stream(self, session_id: str) -> bool:
        """Check if a session has an active stream.

        Args:
            session_id: The session ID to check

        Returns:
            True if stream is active
        """
        return session_id in self._active_streams

    def get_stream(self, session_id: str) -> Optional[AgentStream]:
        """Get an active stream.

        Args:
            session_id: The session ID

        Returns:
            The AgentStream if active, None otherwise
        """
        return self._active_streams.get(session_id)

    async def stop_stream(self, session_id: str, reason: str = "manual") -> bool:
        """Request a stream to stop.

        Args:
            session_id: The session ID whose stream to stop
            reason: Reason for stopping (e.g., "manual", "session_switch")

        Returns:
            True if stream was found and stop requested
        """
        stream = self.get_stream(session_id)
        if stream:
            stream._state_machine.request_stop(reason=reason)
            return True
        return False
