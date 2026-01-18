"""
Conversation State Manager - Manages conversation state and intent recognition

This module preserves the logic from the original conversation_manager.py,
separated from the message history management.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field
from datetime import datetime
import json

from backend.agent.logger import logger

# 可选导入新的意图识别系统
try:
    from backend.agent.services.intent.intent_enhancer import AgentIntentEnhancer
    from backend.agent.services.intent.tool_registry import get_tool_registry
    from backend.agent.tool.tool_collection import ToolCollection
    INTENT_ENHANCER_AVAILABLE = True
except ImportError:
    INTENT_ENHANCER_AVAILABLE = False
    AgentIntentEnhancer = None
    ToolCollection = None


class ConversationState(str, Enum):
    """对话状态"""
    IDLE = "idle"
    GREETING = "greeting"
    RESUME_LOADED = "resume_loaded"
    ANALYZING = "analyzing"
    OPTIMIZING = "optimizing"
    WAITING_ANSWER = "waiting_answer"
    EDITING = "editing"


class Intent(str, Enum):
    """用户意图 - 仅保留需要在代码层面特殊处理的意图"""
    GREETING = "greeting"  # 问候 - 直接返回，不走 LLM
    LOAD_RESUME = "load_resume"  # 加载简历 - 需检查重复
    ANALYZE_RESUME = "analyze_resume"  # 分析简历（触发 Agent 委托）
    OPTIMIZE_SECTION = "optimize_section"  # 优化某模块（触发 Agent 委托）
    FULL_OPTIMIZE = "full_optimize"  # 全面优化（触发 Agent 委托）
    UNKNOWN = "unknown"  # 未知 - 交由 LLM 根据上下文判断


class OptimizationContext(BaseModel):
    """优化上下文 - 追踪优化流程状态"""
    section: str = ""
    current_question: int = 0
    answers: Dict[str, str] = Field(default_factory=dict)
    started_at: Optional[datetime] = None


class ConversationContext(BaseModel):
    """对话上下文"""
    state: ConversationState = ConversationState.IDLE
    resume_loaded: bool = False
    last_tool_used: str = ""
    last_ai_response: str = ""
    optimization: OptimizationContext = Field(default_factory=OptimizationContext)
    history_summary: str = ""
    turn_count: int = 0


class ConversationStateManager:
    """
    对话状态管理器

    与原 ConversationManager 的区别：
    - 不管理消息历史（由 ChatHistoryManager 负责）
    - 只负责状态机和意图识别
    """

    def __init__(
        self,
        llm=None,
        tool_collection: Optional[ToolCollection] = None,
        use_enhanced_intent: bool = True,
        session_id: Optional[str] = None,
    ):
        """
        初始化对话状态管理器

        Args:
            llm: LLM 客户端实例，用于意图识别
            tool_collection: 工具集合（用于初始化工具注册表）
            use_enhanced_intent: 是否使用增强的意图识别系统（默认 True）
            session_id: 会话 ID（用于隔离和日志）
        """
        self.context = ConversationContext()
        self.llm = llm
        self.use_enhanced_intent = use_enhanced_intent and INTENT_ENHANCER_AVAILABLE
        self.session_id = session_id or "default"

        # 初始化增强的意图识别系统
        self.intent_enhancer = None
        if self.use_enhanced_intent:
            try:
                # 初始化工具注册表
                registry = get_tool_registry(tool_collection)

                # 创建意图增强器
                from backend.agent.services.intent.intent_classifier import IntentClassifier
                classifier = IntentClassifier(
                    registry=registry,
                    use_llm=True,
                    llm_client=llm
                )
                self.intent_enhancer = AgentIntentEnhancer(classifier=classifier)
                logger.info("✅ 增强意图识别系统已启用")
            except Exception as e:
                logger.warning(f"增强意图识别系统初始化失败，回退到传统模式: {e}")
                self.use_enhanced_intent = False

    async def classify_intent_with_llm(
        self,
        user_input: str,
        conversation_history: List[Any] = None,
        last_ai_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        使用 LLM 进行意图分类

        Args:
            user_input: 用户输入
            conversation_history: 对话历史（Message 对象列表）
            last_ai_message: 最后一条 AI 消息内容

        Returns:
            {
                "intent": Intent,
                "confidence": float,
                "extracted_info": {
                    "section": str,
                    "question": str,
                    "answer_type": str
                },
                "reasoning": str
            }
        """
        if not self.llm:
            logger.warning("LLM 客户端未设置，回退到默认意图")
            return {
                "intent": Intent.UNKNOWN,
                "confidence": 0.0,
                "extracted_info": {},
                "reasoning": "LLM 客户端未设置"
            }

        # 构建对话历史摘要
        history_text = ""
        if conversation_history:
            recent_messages = conversation_history[-5:]
            history_parts = []
            for msg in recent_messages:
                if hasattr(msg, 'role') and hasattr(msg, 'content'):
                    role = "用户" if msg.role == "user" else "AI"
                    content = msg.content[:200] if msg.content else ""
                    if content:
                        history_parts.append(f"{role}: {content}")
            history_text = "\n".join(history_parts)

        # 构建意图识别提示词
        prompt = f"""你是一个意图识别助手。根据用户输入判断是否为特殊意图。

## 用户输入
"{user_input}"

## 意图类型
- greeting: 问候语（你好、hi、hello、嘿等）
- load_resume: 加载简历（包含"加载简历"、"导入简历"等，且后面通常跟着文件路径）
- unknown: 其他所有情况（交给 LLM 根据上下文处理）

## 输出格式（JSON）
{{
    "intent": "greeting/load_resume/unknown",
    "confidence": 0.0-1.0,
    "reasoning": "简短理由"
}}

只返回JSON。"""

        try:
            response = await self.llm.ask(
                messages=[{"role": "user", "content": prompt}],
                stream=False,
                temperature=0.1
            )

            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()

            result = json.loads(response)

            intent_str = result.get("intent", "unknown")
            try:
                intent = Intent(intent_str)
            except ValueError:
                logger.warning(f"未知的意图类型: {intent_str}，使用 UNKNOWN")
                intent = Intent.UNKNOWN

            return {
                "intent": intent,
                "confidence": result.get("confidence", 0.5),
                "extracted_info": result.get("extracted_info", {}),
                "reasoning": result.get("reasoning", "")
            }

        except json.JSONDecodeError as e:
            logger.error(f"LLM 返回的 JSON 解析失败: {e}")
            return {
                "intent": Intent.UNKNOWN,
                "confidence": 0.0,
                "extracted_info": {},
                "reasoning": f"JSON 解析失败: {str(e)}"
            }
        except Exception as e:
            logger.error(f"LLM 意图识别失败: {e}")
            return {
                "intent": Intent.UNKNOWN,
                "confidence": 0.0,
                "extracted_info": {},
                "reasoning": f"识别失败: {str(e)}"
            }

    async def detect_intent(
        self,
        user_input: str,
        conversation_history: List[Any] = None,
        last_ai_message: Optional[str] = None
    ) -> Tuple[Intent, Dict[str, Any]]:
        """使用 LLM 检测用户意图"""
        llm_result = await self.classify_intent_with_llm(
            user_input=user_input,
            conversation_history=conversation_history,
            last_ai_message=last_ai_message
        )

        intent = llm_result["intent"]
        extracted_info = llm_result.get("extracted_info", {})

        logger.info(f"🧠 LLM 意图识别: {intent.value}, 置信度: {llm_result.get('confidence', 0):.2f}")

        return intent, extracted_info

    async def process_input(
        self,
        user_input: str,
        conversation_history: List[Any] = None,
        last_ai_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        处理用户输入，返回处理建议

        Returns:
            {
                "intent": Intent,
                "tool": str,
                "tool_args": dict,
                "context_prompt": str,
                "should_skip_llm": bool,
                "enhanced_query": str,  # 增强后的查询（如果使用增强意图识别）
                "intent_result": Any,   # 意图识别结果（如果使用增强意图识别）
            }
        """
        self.context.turn_count += 1

        # 如果使用增强意图识别系统
        if self.use_enhanced_intent and self.intent_enhancer:
            try:
                # 使用意图增强器
                enhanced_query, intent_result = await self.intent_enhancer.enhance_query(
                    user_input,
                    context={
                        "conversation_history": conversation_history,
                        "last_ai_message": last_ai_message,
                    }
                )

                # 检查是否是问候
                if intent_result and intent_result.intent_type.value == "greeting":
                    result = {
                        "intent": Intent.GREETING,
                        "tool": None,
                        "tool_args": {},
                        "context_prompt": "",
                        "should_skip_llm": False,
                        "enhanced_query": enhanced_query,
                        "intent_result": intent_result,
                    }
                    self.context.state = ConversationState.GREETING
                    return result

                # 检查是否识别到工具
                if intent_result and intent_result.matched_tools:
                    # 提取文件路径（如果是加载简历）
                    tool_name = intent_result.matched_tools[0]
                    tool_args = {}
                    if tool_name == "cv_reader_agent":
                        import re
                        file_path_match = re.search(r'加载简历\s*([^\s]+)', user_input)
                        if file_path_match:
                            tool_args["file_path"] = file_path_match.group(1)

                    result = {
                        "intent": Intent.LOAD_RESUME if tool_name == "cv_reader_agent" else Intent.UNKNOWN,
                        "tool": tool_name,
                        "tool_args": tool_args,
                        "context_prompt": "",
                        "should_skip_llm": False,
                        "enhanced_query": enhanced_query,
                        "intent_result": intent_result,
                    }
                    return result

                # 未识别到特定工具，尝试识别 Agent 委托意图
                agent_intent, section = self._detect_agent_intent(enhanced_query)
                if agent_intent:
                    return {
                        "intent": agent_intent,
                        "tool": None,
                        "tool_args": {"section": section} if section else {},
                        "context_prompt": "",
                        "should_skip_llm": False,
                        "enhanced_query": enhanced_query,
                        "intent_result": intent_result,
                    }

                result = {
                    "intent": Intent.UNKNOWN,
                    "tool": None,
                    "tool_args": {},
                    "context_prompt": "",
                    "should_skip_llm": False,
                    "enhanced_query": enhanced_query,
                    "intent_result": intent_result,
                }
                return result

            except Exception as e:
                logger.warning(f"增强意图识别失败，回退到传统模式: {e}")
                # 继续使用传统模式

        # 传统模式（向后兼容）
        intent, info = await self.detect_intent(
            user_input=user_input,
            conversation_history=conversation_history,
            last_ai_message=last_ai_message
        )

        result = {
            "intent": intent,
            "tool": None,
            "tool_args": {},
            "context_prompt": "",
            "should_skip_llm": False,
        }

        if intent == Intent.GREETING:
            # 问候 - 不调用工具，交给 LLM 返回问候
            result["tool"] = None
            self.context.state = ConversationState.GREETING
        elif intent == Intent.LOAD_RESUME:
            # 加载简历 - 调用 cv_reader_agent
            result["tool"] = "cv_reader_agent"
            # 从用户输入中提取文件路径
            # 用户输入格式: "加载简历/path/to/file.md" 或 "加载简历 /path/to/file.md"
            import re
            file_path_match = re.search(r'加载简历\s*([^\s]+)', user_input)
            if file_path_match:
                file_path = file_path_match.group(1)
                result["tool_args"] = {"file_path": file_path}
            elif info.get("file_path"):
                result["tool_args"] = {"file_path": info["file_path"]}
        else:
            agent_intent, section = self._detect_agent_intent(user_input)
            if agent_intent:
                result["intent"] = agent_intent
                result["tool_args"] = {"section": section} if section else {}
        # UNKNOWN 意图交给 LLM 根据上下文和工具描述判断

        return result

    def _detect_agent_intent(self, text: str) -> Tuple[Optional[Intent], Optional[str]]:
        """Detect agent delegation intents from user text."""
        if not text:
            return None, None

        normalized = text.strip().lower()
        section = self._extract_section(normalized)

        if "全面优化" in normalized or "整体优化" in normalized or "全局优化" in normalized:
            return Intent.FULL_OPTIMIZE, section

        if "优化" in normalized:
            return Intent.OPTIMIZE_SECTION, section

        if "分析" in normalized or "评估" in normalized:
            if "简历" in normalized or section:
                return Intent.ANALYZE_RESUME, section

        return None, None

    def _extract_section(self, text: str) -> Optional[str]:
        """Extract section name from text."""
        section_map = {
            "工作经历": ["工作经历", "工作经验", "工作"],
            "教育背景": ["教育背景", "教育经历", "教育"],
            "技能": ["技能", "技术栈"],
            "项目经历": ["项目经历", "项目"],
        }

        for section_name, keywords in section_map.items():
            if any(keyword in text for keyword in keywords):
                return section_name
        return None

    def _generate_context_prompt(self) -> str:
        """生成上下文提示"""
        parts = []

        parts.append(f"当前状态: {self.context.state.value}")

        if self.context.resume_loaded:
            parts.append("简历已加载")
        else:
            parts.append("简历未加载")

        if self.context.state in [ConversationState.OPTIMIZING, ConversationState.WAITING_ANSWER]:
            opt = self.context.optimization
            if opt.section:
                parts.append(f"正在优化: {opt.section}")
                parts.append(f"当前问题: 问题{opt.current_question}")

        return "\n".join(parts)

    def update_after_tool(self, tool_name: str, result: str):
        """工具执行后更新状态"""
        self.context.last_tool_used = tool_name
        self.context.last_ai_response = result[:500]

        if "我最建议先回答问题" in result or "请回答" in result:
            self.context.state = ConversationState.WAITING_ANSWER
            import re
            match = re.search(r'问题[一二三123]', result)
            if match:
                q_map = {"一": 1, "二": 2, "三": 3, "1": 1, "2": 2, "3": 3}
                q_char = match.group().replace("问题", "")
                self.context.optimization.current_question = q_map.get(q_char, 1)

    def update_resume_loaded(self, loaded: bool):
        """更新简历加载状态"""
        self.context.resume_loaded = loaded
        if loaded:
            self.context.state = ConversationState.RESUME_LOADED

    def _reset_optimization(self):
        """重置优化状态"""
        self.context.optimization = OptimizationContext()
        self.context.state = ConversationState.RESUME_LOADED if self.context.resume_loaded else ConversationState.IDLE

    def get_state_for_prompt(self) -> str:
        """获取用于提示词的状态描述"""
        return self._generate_context_prompt()

    def should_use_tool_directly(self, intent: Intent) -> bool:
        """判断是否应该直接使用工具（跳过 LLM 决策）"""
        # 只有 LOAD_RESUME 需要直接调用工具（为了检查重复加载）
        # 其他所有意图都交给 LLM 根据工具描述和上下文判断
        return intent == Intent.LOAD_RESUME
