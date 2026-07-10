"""意图路由（Wave 2a-S4a）：从 Manus.think() 迁出"意图识别 + 让权守卫"判定。

职责边界：只做**选路判定**，不执行副作用——memory 写入、状态转换由 Manus 完成。
2026-07-11 LLM-first 一次性了断后，路由收敛为单一契约（无回退开关）：
- decide() 每轮恰好调用 conversation_state.process_input() 一次；其状态副作用
  （turn_count 推进、意图历史）归属 decide()，调用方不得重复调用
- 所有业务意图一律让权给 ReAct loop，由 LLM 看工具列表自主编排；发送/复合
  语义守卫先于 LLM-first 判定，仅影响让权原因标注与复合请求提示
- GREETING 保留专用轻通道（本身就是 LLM 生成，只是不挂工具、更快）
- enhanced_query 清洗：规则的 /[tool:] 改写一律丢弃回原始输入（规则识别
  结果只做日志参考，不许暗中给 LLM 指路）
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from backend.agent.application.conversation.conversation_state import Intent
from backend.core.logger import get_logger

logger = get_logger(__name__)


@dataclass
class RoutingContext:
    """decide() 所需的显式上下文（不给 memory 全量，见 spec D4）。"""

    recent_messages: List[Any]          # 意图识别用的近 5 条
    last_ai_message: Optional[str]


@dataclass
class RouteOutcome:
    """一轮路由判定的完整结果（think() 的消费形态）。"""

    intent: Intent
    tool: Optional[str]
    tool_args: Dict[str, Any]
    intent_source: str
    enhanced_query: str
    intent_result_obj: Any
    yield_reason: Optional[str] = None   # 非 None = 已让权（intent 已转 UNKNOWN）
    compound_hint: bool = False          # 复合请求：dispatch 需插入"逐个完成"系统提示
    raw_intent_result: Dict[str, Any] = field(default_factory=dict)


class IntentRouter:
    """意图路由器：process_input + 诊断兜底 + 让权守卫 + enhanced_query 清洗。"""

    def __init__(
        self,
        conversation_state: Any,
        *,
        yield_reason_fn: Any,
        compound_request_fn: Any,
    ) -> None:
        # fn 注入而非模块直引:让权规则函数目前定义在 manus 模块级,
        # 收口后可平移进本模块;测试也借此注入桩
        self._conversation_state = conversation_state
        self._yield_reason = yield_reason_fn
        self._is_compound = compound_request_fn

    async def decide(self, user_input: str, ctx: RoutingContext) -> RouteOutcome:
        # 🧠 统一由 ConversationStateManager 决定意图（含 fast-rule）
        intent_result = await self._conversation_state.process_input(
            user_input=user_input,
            conversation_history=ctx.recent_messages,
            last_ai_message=ctx.last_ai_message,
        )

        intent = intent_result["intent"]
        # 🚨 兜底拦截逻辑：如果用户明确说要"诊断"，即使 LLM 意图识别没识别出
        # ANALYZE_RESUME，也强行进入（LLM-first 下随后让权，仅影响日志与复合提示）
        if intent != Intent.ANALYZE_RESUME and "诊断" in (user_input or ""):
            logger.info("🧭 触发诊断关键词兜底拦截: intent UNKNOWN -> ANALYZE_RESUME")
            intent = Intent.ANALYZE_RESUME

        # 让权守卫(在一切意图覆盖之后):发送语义/复合请求先标注具体原因,
        # 其余业务意图一律以 LLM-first 让权——规则识别结果仅作日志参考
        yield_reason = self._yield_reason(user_input) if intent != Intent.UNKNOWN else None
        if yield_reason is None and intent not in (
            Intent.UNKNOWN, Intent.GREETING,
        ):
            yield_reason = "LLM-first"

        compound_hint = False
        if yield_reason:
            logger.info(f"🧭 {yield_reason}让权: {intent.value} -> UNKNOWN,交给 LLM 工具循环")
            intent = Intent.UNKNOWN
            intent_result = {**intent_result, "intent": intent, "tool": None, "tool_args": {}}
            compound_hint = self._is_compound(user_input)

        tool = intent_result.get("tool")
        tool_args = intent_result.get("tool_args", {})
        intent_source = intent_result.get("intent_source", "unknown")
        enhanced_query = intent_result.get("enhanced_query", user_input)
        intent_result_obj = intent_result.get("intent_result")

        # 规则的 /[tool:xxx] 改写一律丢弃:写回 memory 等于规则在暗中给 LLM 指路
        # (名义让权、实际遥控,Codex review 2026-07-10)。
        if enhanced_query != user_input:
            logger.info(f"[llm-first] 规则改写已忽略: {enhanced_query!r}")
            enhanced_query = user_input
        # 观测:规则候选 vs 最终路由,用于评估 LLM-first 翻车面
        logger.info(
            f"🧠 意图路由: intent={intent.value} rule_tool={tool} "
            f"source={intent_source} yielded={yield_reason or '-'}"
        )

        return RouteOutcome(
            intent=intent,
            tool=tool,
            tool_args=tool_args if isinstance(tool_args, dict) else {},
            intent_source=intent_source,
            enhanced_query=enhanced_query,
            intent_result_obj=intent_result_obj,
            yield_reason=yield_reason,
            compound_hint=compound_hint,
            raw_intent_result=intent_result,
        )
