import asyncio
import json
from typing import Any, List, Optional, Union

from pydantic import Field, PrivateAttr

from backend.agent.agent.react import ReActAgent
from backend.agent.exceptions import TokenLimitExceeded
from backend.core.logger import get_logger

logger = get_logger(__name__)
from backend.agent.prompt.toolcall import NEXT_STEP_PROMPT, SYSTEM_PROMPT
from backend.agent.schema import TOOL_CHOICE_TYPE, AgentState, Message, ToolCall, ToolChoice
from backend.agent.tool import CreateChatCompletion, Terminate, ToolCollection


TOOL_CALL_REQUIRED = "Tool calls required but none provided"


class ToolCallAgent(ReActAgent):
    """Base agent class for handling tool/function calls with enhanced abstraction

    核心设计原则：
    1. 自动终止：当 LLM 返回纯文本回答（无 tool_calls）时，自动终止
    2. 避免重复：跟踪已处理的用户输入，避免重复添加提示词
    3. 灵活扩展：子类可以通过重写 should_auto_terminate() 自定义终止逻辑
    """

    name: str = "toolcall"
    description: str = "an agent that can execute tool calls."

    system_prompt: str = SYSTEM_PROMPT
    next_step_prompt: str = NEXT_STEP_PROMPT

    available_tools: ToolCollection = ToolCollection(
        CreateChatCompletion(), Terminate()
    )
    tool_choices: TOOL_CHOICE_TYPE = ToolChoice.AUTO  # type: ignore
    special_tool_names: List[str] = Field(default_factory=lambda: [Terminate().name])

    tool_calls: List[ToolCall] = Field(default_factory=list)
    _current_base64_image: Optional[str] = None

    max_steps: int = 30
    max_observe: Optional[Union[int, bool]] = None

    # 🔑 新增：跟踪状态，避免重复处理
    _last_processed_user_input: str = PrivateAttr(default="")
    _pending_next_step: bool = PrivateAttr(default=False)  # 是否有待处理的 next_step

    def should_auto_terminate(self, content: str, tool_calls: List[ToolCall]) -> bool:
        """判断是否应该自动终止

        子类可以重写此方法来自定义终止逻辑。
        默认行为：当 LLM 返回纯文本内容（无 tool_calls）时自动终止。

        Args:
            content: LLM 返回的文本内容
            tool_calls: LLM 返回的工具调用列表

        Returns:
            True 表示应该自动终止，False 表示继续执行
        """
        # 如果有工具调用，不自动终止
        if tool_calls:
            return False

        # 如果有内容但没有工具调用，自动终止（纯文本回答）
        if content and content.strip():
            return True

        return False

    def _should_add_next_step_prompt(self) -> bool:
        """判断是否应该添加 next_step_prompt

        避免重复添加相同的提示词，导致消息膨胀。

        Returns:
            True 表示应该添加，False 表示跳过
        """
        if not self.next_step_prompt:
            return False

        # 检查最后一条用户消息是否已经是这个 prompt
        for msg in reversed(self.messages[-3:]):
            if isinstance(msg, Message):
                role = msg.role.value if hasattr(msg.role, 'value') else str(msg.role)
            else:
                role = msg.get('role', '')

            if role == 'user':
                content = msg.content if isinstance(msg, Message) else msg.get('content', '')
                # 如果最近的用户消息就是 next_step_prompt，跳过添加
                if content and content.strip() == self.next_step_prompt.strip():
                    return False
                break

        return True

    async def think(self) -> bool:
        """Process current state and decide next actions using tools

        核心逻辑：
        1. 只在需要时添加 next_step_prompt（避免重复）
        2. 调用 LLM 获取响应
        3. 如果 LLM 只返回文本（无 tool_calls），自动终止
        4. 如果有 tool_calls，继续执行
        """
        # 🔑 关键优化：只在需要时添加 next_step_prompt
        if self._should_add_next_step_prompt():
            user_msg = Message.user_message(self.next_step_prompt)
            self.messages += [user_msg]
            logger.debug(f"📝 添加 next_step_prompt: {self.next_step_prompt[:50]}...")
        else:
            logger.debug("⏭️ 跳过重复的 next_step_prompt")

        # 🔍 DEBUG: 消息列表概览（简化版）
        logger.debug(f"📋 消息列表: {len(self.messages)} 条")

        try:
            # Get response with tool options
            response = await self.llm.ask_tool(
                messages=self.messages,
                system_msgs=(
                    [Message.system_message(self.system_prompt)]
                    if self.system_prompt
                    else None
                ),
                tools=self.available_tools.to_params(),
                tool_choice=self.tool_choices,
            )
        except ValueError:
            raise
        except Exception as e:
            # Check if this is a RetryError containing TokenLimitExceeded
            if hasattr(e, "__cause__") and isinstance(e.__cause__, TokenLimitExceeded):
                token_limit_error = e.__cause__
                logger.error(
                    f"🚨 Token limit error (from RetryError): {token_limit_error}"
                )
                self.memory.add_message(
                    Message.assistant_message(
                        f"Maximum token limit reached, cannot continue execution: {str(token_limit_error)}"
                    )
                )
                self.state = AgentState.FINISHED
                return False
            raise

        self.tool_calls = tool_calls = (
            response.tool_calls if response and response.tool_calls else []
        )
        content = response.content if response and response.content else ""

        # Log response info
        logger.info(f"✨ {self.name}'s thoughts: {content}")
        logger.info(
            f"🛠️ {self.name} selected {len(tool_calls) if tool_calls else 0} tools to use"
        )
        if tool_calls:
            logger.info(
                f"🧰 Tools being prepared: {[call.function.name for call in tool_calls]}"
            )
            logger.info(f"🔧 Tool arguments: {tool_calls[0].function.arguments}")

        try:
            if response is None:
                raise RuntimeError("No response received from the LLM")

            # Handle different tool_choices modes
            if self.tool_choices == ToolChoice.NONE:
                if tool_calls:
                    logger.warning(
                        f"🤔 Hmm, {self.name} tried to use tools when they weren't available!"
                    )
                if content:
                    self.memory.add_message(Message.assistant_message(content))
                    return True
                return False

            # Create and add assistant message
            assistant_msg = (
                Message.from_tool_calls(content=content, tool_calls=self.tool_calls)
                if self.tool_calls
                else Message.assistant_message(content)
            )
            self.memory.add_message(assistant_msg)

            if self.tool_choices == ToolChoice.REQUIRED and not self.tool_calls:
                return True  # Will be handled in act()

            # 🔑 关键优化：自动终止逻辑
            if self.tool_choices == ToolChoice.AUTO and not self.tool_calls:
                if self.should_auto_terminate(content, tool_calls):
                    logger.info(f"✅ 自动终止：LLM 返回纯文本回答，无需继续")
                    self.state = AgentState.FINISHED
                    return False
                return bool(content)

            return bool(self.tool_calls)
        except Exception as e:
            logger.error(f"🚨 Oops! The {self.name}'s thinking process hit a snag: {e}")
            self.memory.add_message(
                Message.assistant_message(
                    f"Error encountered while processing: {str(e)}"
                )
            )
            return False

    async def act(self) -> str:
        """Execute tool calls and handle their results"""
        if not self.tool_calls:
            if self.tool_choices == ToolChoice.REQUIRED:
                raise ValueError(TOOL_CALL_REQUIRED)

            # Return last message content if no tool calls
            return self.messages[-1].content or "No content or commands to execute"

        results = []
        for command in self.tool_calls:
            # Reset base64_image for each tool call
            self._current_base64_image = None

            result = await self.execute_tool(command)

            if self.max_observe:
                result = result[: self.max_observe]

            logger.info(
                f"🎯 Tool '{command.function.name}' completed its mission! Result: {result}"
            )

            # Add tool response to memory
            tool_msg = Message.tool_message(
                content=result,
                tool_call_id=command.id,
                name=command.function.name,
                base64_image=self._current_base64_image,
            )
            self.memory.add_message(tool_msg)
            results.append(result)

        return "\n\n".join(results)

    async def execute_tool(self, command: ToolCall) -> str:
        """Execute a single tool call with robust error handling"""
        if not command or not command.function or not command.function.name:
            return "Error: Invalid command format"

        name = command.function.name
        if name not in self.available_tools.tool_map:
            return f"Error: Unknown tool '{name}'"

        try:
            # Parse arguments
            args = json.loads(command.function.arguments or "{}")

            # Execute the tool
            logger.info(f"🔧 Activating tool: '{name}'...")
            result = await self.available_tools.execute(name=name, tool_input=args)

            # Handle special tools
            await self._handle_special_tool(name=name, result=result)

            # Check if result is a ToolResult with base64_image
            if hasattr(result, "base64_image") and result.base64_image:
                # Store the base64_image for later use in tool_message
                self._current_base64_image = result.base64_image

            # Format result for display (standard case)
            observation = (
                f"Observed output of cmd `{name}` executed:\n{str(result)}"
                if result
                else f"Cmd `{name}` completed with no output"
            )

            return observation
        except json.JSONDecodeError:
            error_msg = f"Error parsing arguments for {name}: Invalid JSON format"
            logger.error(
                f"📝 Oops! The arguments for '{name}' don't make sense - invalid JSON, arguments:{command.function.arguments}"
            )
            return f"Error: {error_msg}"
        except Exception as e:
            error_msg = f"⚠️ Tool '{name}' encountered a problem: {str(e)}"
            logger.exception(error_msg)
            return f"Error: {error_msg}"

    async def _handle_special_tool(self, name: str, result: Any, **kwargs):
        """Handle special tool execution and state changes"""
        if not self._is_special_tool(name):
            return

        if self._should_finish_execution(name=name, result=result, **kwargs):
            # Set agent state to finished
            logger.info(f"🏁 Special tool '{name}' has completed the task!")
            self.state = AgentState.FINISHED

    @staticmethod
    def _should_finish_execution(**kwargs) -> bool:
        """Determine if tool execution should finish the agent"""
        return True

    def _is_special_tool(self, name: str) -> bool:
        """Check if tool name is in special tools list"""
        return name.lower() in [n.lower() for n in self.special_tool_names]

    async def cleanup(self):
        """Clean up resources used by the agent's tools."""
        logger.info(f"🧹 Cleaning up resources for agent '{self.name}'...")
        for tool_name, tool_instance in self.available_tools.tool_map.items():
            if hasattr(tool_instance, "cleanup") and asyncio.iscoroutinefunction(
                tool_instance.cleanup
            ):
                try:
                    logger.debug(f"🧼 Cleaning up tool: {tool_name}")
                    await tool_instance.cleanup()
                except Exception as e:
                    logger.error(
                        f"🚨 Error cleaning up tool '{tool_name}': {e}", exc_info=True
                    )
        logger.info(f"✨ Cleanup complete for agent '{self.name}'.")

    async def run(self, request: Optional[str] = None) -> str:
        """Run the agent with cleanup when done."""
        try:
            return await super().run(request)
        finally:
            await self.cleanup()
