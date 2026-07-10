"""意图路由（Wave 2a-S4a）：从 Manus.think() 迁出"意图识别 + 让权守卫"判定。

职责边界：只做**选路判定**，不执行副作用——memory 写入、工具调用、状态转换
由 Manus dispatch 完成。接口契约（spec v2 D 系列 + Codex 设计 review）：
- decide() 每轮恰好调用 conversation_state.process_input() 一次；其状态副作用
  （turn_count 推进、意图历史）归属 decide()，调用方不得重复调用
- 让权规则的优先级顺序与原 think() 逐行一致：发送/复合语义守卫 → LLM-first
  全量让权 → 无简历让权
- enhanced_query 清洗：让权或 LLM-first 开启时，规则的 /[tool:] 改写一律
  丢弃回原始输入（规则不许暗中给 LLM 指路）

typed variants（FastPathDecision 等）在 S4c 执行体收口时引入；本步先以
RouteOutcome 承接现有 think() 的消费形态（纯搬运，见 spec D5）。
"""

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from backend.agent.application.conversation.conversation_state import Intent
from backend.core.logger import get_logger

logger = get_logger(__name__)


@dataclass
class RoutingContext:
    """decide() 所需的显式上下文（不给 memory 全量，见 spec D4）。"""

    recent_messages: List[Any]          # 意图识别用的近 5 条
    last_ai_message: Optional[str]
    resume_available: bool              # conversation_state.resume_loaded 或 store 有数据


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


@dataclass
class StagedEditDecision:
    """EDIT_CV 按值替换快路径的判定结果（Wave 2a-S4c-2）。

    None = 不走快路径（无匹配 / 已让权 / 无简历 / 未定位到 .company 路径），
    调用方回落到常规 think() 流程。"""

    intent: Intent
    tool: str
    tool_args: Dict[str, Any]


class IntentRouter:
    """意图路由器：process_input + 诊断兜底 + 让权守卫 + enhanced_query 清洗。"""

    def __init__(
        self,
        conversation_state: Any,
        *,
        llm_first_enabled_provider: Any,
        yield_reason_fn: Any,
        compound_request_fn: Any,
    ) -> None:
        # provider/fn 注入而非模块直引:让权规则函数目前定义在 manus 模块级,
        # S4c 收口后可平移进本模块;测试也借此注入桩
        self._conversation_state = conversation_state
        self._llm_first_enabled = llm_first_enabled_provider
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
        # ANALYZE_RESUME，也强行进入
        if intent != Intent.ANALYZE_RESUME and "诊断" in (user_input or ""):
            logger.info("🧭 触发诊断关键词兜底拦截: intent UNKNOWN -> ANALYZE_RESUME")
            intent = Intent.ANALYZE_RESUME

        # 让权守卫(在一切意图覆盖之后):发送语义/复合请求等规则接不稳的输入,
        # 规则层弃权,交给 ReAct loop 由 LLM 自主选工具
        yield_reason = self._yield_reason(user_input) if intent != Intent.UNKNOWN else None
        # LLM-first 路由:所有业务意图全量让权,规则识别结果仅作日志参考
        if yield_reason is None and self._llm_first_enabled() and intent not in (
            Intent.UNKNOWN, Intent.GREETING,
        ):
            yield_reason = "LLM-first"
        # 无简历时,优化/编辑/分析的规则流程无米下锅(只会吐固定引导文案),
        # 一律让权给 LLM——system prompt「产品语境」段已定义标准的无简历引导
        if yield_reason is None and intent in {
            Intent.OPTIMIZE_SECTION, Intent.FULL_OPTIMIZE, Intent.EDIT_CV, Intent.ANALYZE_RESUME,
        } and not ctx.resume_available:
            yield_reason = "无简历"

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

        # LLM-first / 让权:enhanced_query 可能带 /[tool:xxx] 之类的规则路由标记,
        # 写回 memory 等于规则在暗中给 LLM 指路(名义让权、实际遥控)。让权时一律
        # 使用原始输入,规则产物仅落日志(Codex review 2026-07-10)。
        # 注意 intent 本来就是 UNKNOWN 时(yielded=-)规则同样会做 /[tool:] 改写
        # ——LLM-first 开启即全量禁止写回,不只在让权分支(实测日志抓到的第二个口子)。
        if (yield_reason or self._llm_first_enabled()) and enhanced_query != user_input:
            logger.info(f"[llm-first] 规则改写已忽略: {enhanced_query!r}")
            enhanced_query = user_input
        # 观测:规则候选 vs 最终路由,用于评估 LLM-first 翻车面
        logger.info(
            f"🧠 意图路由: intent={intent.value} rule_tool={tool} "
            f"source={intent_source} yielded={yield_reason or '-'}"
        )
        if enhanced_query != user_input:
            logger.info(f"📝 增强后的查询: {enhanced_query}")

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

    @staticmethod
    def _extract_replace_request(user_input: str) -> Optional[tuple]:
        text = (user_input or "").strip()
        if not text:
            return None
        # 示例:
        # - 把我的简历的腾讯改成字节跳动
        # - 把“腾讯”改为“字节跳动”
        match = re.search(
            r"把(?:我的)?(?:简历(?:里|中|上的?)?(?:的)?)?(.+?)\s*(?:改成|改为|变成)\s*[\"“”']?(.+?)[\"“”']?$",
            text,
            re.IGNORECASE,
        )
        if not match:
            return None
        old_value = (match.group(1) or "").strip().strip("\"'“”")
        new_value = (match.group(2) or "").strip().strip("\"'“”")
        if not old_value or not new_value:
            return None
        return old_value, new_value

    def decide_staged_edit(
        self,
        user_input: str,
        *,
        resume_available: bool,
        path_resolver: Callable[[str], Optional[str]],
    ) -> Optional[StagedEditDecision]:
        """EDIT_CV 按值替换快路径的判定（Wave 2a-S4c-2，从 Manus.think() 纯搬运）。

        判定顺序与原 think() 逐行一致：规则解析 → 让权守卫 → 有简历 → 公司路径
        定位。命中返回 StagedEditDecision（构造/落地交 Manus）；否则返回 None，
        调用方回落常规流程。path_resolver 由 Manus 注入（读 ResumeDataStore）。"""
        replace_req = self._extract_replace_request(user_input)
        # LLM-first 路由下前置快路径整体退役;规则模式下让权守卫仍覆盖复合/发送语义
        if replace_req and (self._llm_first_enabled() or self._yield_reason(user_input)):
            logger.info("🧭 staged-edit 快路径让权,交给 LLM 工具循环")
            replace_req = None
        if not (replace_req and resume_available):
            return None
        source_value, target_value = replace_req
        mapped_path = path_resolver(source_value)
        if not (mapped_path and mapped_path.endswith(".company")):
            return None
        logger.info(
            "🧭 replace request mapped for direct edit: %s -> %s (path=%s)",
            source_value,
            target_value,
            mapped_path,
        )
        return StagedEditDecision(
            intent=Intent.EDIT_CV,
            tool="cv_editor_agent",
            tool_args={
                "path": mapped_path,
                "action": "update",
                "value": target_value,
            },
        )
