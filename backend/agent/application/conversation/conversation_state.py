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
import os
import re

from backend.core.logger import get_logger
from backend.agent.domain.intent.edit_rules import parse_fast_simple_edit_text
from backend.agent.domain.intent.greeting_rules import is_fast_greeting_text
from backend.agent.domain.intent.load_resume_rules import (
    is_pasted_resume_import_text,
)

logger = get_logger(__name__)
FAST_GREETING_ENABLED = (
    os.getenv("AGENT_FAST_GREETING_ENABLED", "true").strip().lower() != "false"
)
FAST_SIMPLE_EDIT_ENABLED = (
    os.getenv("AGENT_FAST_SIMPLE_EDIT_ENABLED", "true").strip().lower() != "false"
)

# 只读查看：读取/展示简历内容，不含优化/修改意图
_READ_ONLY_QUERY_RE = re.compile(
    r"(读取|查看|展示|显示|列出|看看|给我看|告诉我|说一下|发我)"
)
_OPTIMIZE_VERB_PATTERN = (
    r"优化|润色|完善|改进|提升|调整|打磨|修改|改写|重写|改一改|改改|"
    r"改得更好|写得更好|写得更专业|改好|改短|改成|改为|精简|改"
)
_NEGATED_EDIT_RE = re.compile(
    rf"(?:别|不要|不用|无需|先别|暂时别)[^，。；,!;]{{0,24}}"
    rf"(?:{_OPTIMIZE_VERB_PATTERN})"
)
_WRITE_QUERY_RE = re.compile(
    rf"(?:{_OPTIMIZE_VERB_PATTERN}|更新|添加|删除|导入|新增|录入|插入|"
    r"写入|应用|替换|设置|编辑)"
)


def _is_negated_edit_read_only(text: str) -> bool:
    return bool(_NEGATED_EDIT_RE.search(text) and _READ_ONLY_QUERY_RE.search(text))


def is_read_only_query(user_input: str) -> bool:
    """用户是否在只读查看简历（不应触发 cv_editor）。"""
    text = (user_input or "").strip()
    if not text:
        return False
    if _is_negated_edit_read_only(text):
        return True
    if _WRITE_QUERY_RE.search(text):
        return False
    return bool(_READ_ONLY_QUERY_RE.search(text))


_ADD_EXPERIENCE_RE = re.compile(
    r"(导入|新增|添加|录入|插入|写入).{0,40}(经历|实习|工作|岗位)"
    r"|(帮我|请)?(导入|新增|添加).{0,12}(一段|一条)?.{0,20}实习"
)


def is_add_experience_query(user_input: str) -> bool:
    """用户是否在新增/导入一段经历（应走 add，禁止 STAR 兜底写回）。"""
    return bool(_ADD_EXPERIENCE_RE.search((user_input or "").strip()))


# 整份优化：判断"要不要在注入 system prompt 前脱敏隐私字段"。
# 故意不依赖 Intent.FULL_OPTIMIZE——LLM-first 让权守卫（intent_router.py:99-107）
# 把除 GREETING/UNKNOWN 外的所有意图统一清空成 UNKNOWN 再交给 LLM 判断，
# FULL_OPTIMIZE 这个分支自 2026-07-11 LLM-first 重构后就再没有真正传到过
# prompt_builder（501 行生产日志实测验证：零命中 intent=full_optimize）。
# 脱敏与否是安全边界判断，不能依赖一个会被路由层清空的信号，必须直接对
# 用户原始文本判断。
#
# 独立 review 用同一份生产日志实测出：穷举"全面/整体/全局优化"这类强
# 关键词覆盖不住"我要优化简历"这种真实生产原话——这句话不含任何强关键词，
# 但 Agent 会自主展开成跨多模块的全篇优化，穷举关键词的路子治标不治本。
# 改成语义路由：用户说「改/优化/润色/完善简历」但没有给出具体模块或字段时，
# 统一视为宽泛优化；指定模块/字段时才视为局部修改。这个判断同时服务于诊断
# 调度、上下文脱敏和整份优化进度，避免三处各维护一套近义词。
_OPTIMIZE_VERB_RE = re.compile(
    rf"(?:{_OPTIMIZE_VERB_PATTERN})"
)
_SPECIFIC_SECTION_RE = re.compile(
    r"(工作经历|工作经验|实习经历|实习|教育背景|教育经历|技能|技术栈|"
    r"项目经历|项目|自我评价|开源经历|基本信息|求职意向|姓名|标题|电话|"
    r"手机号|邮箱|联系方式|地址|学校|"
    r"专业(?:名称|方向|字段|改成|改为)|(?:修改|更新|填写|设置).{0,4}专业|"
    r"GPA|绩点|奖项|错别字|排版|格式|"
    r"第[一二三四五六七八九十0-9]+(?:段|条|项)|这(?:句|段|条)|"
    r"(?:experience|projects?|education|basic)\s*\[?\d*)"
)
_WHOLE_RESUME_RE = re.compile(
    r"((整份|通篇|全篇|整体|全面|全局|全部).{0,4}(简历|履历))|"
    r"((简历|履历).{0,4}(整体|全面|全局|全部))|"
    r"^(?:请|帮我|我要|给我|把)?(?:整体|全面|全局)优化(?:一下)?"
    r"(?:我的|这份)?(?:简历|履历)?[吧。！!？?]*$"
)
_DIAGNOSIS_RE = re.compile(
    r"((诊断|评估|分析).{0,10}(简历|履历))|"
    r"((简历|履历).{0,10}(诊断|评估|分析|质量|问题|毛病|不足|短板|打分|评分))|"
    r"((简历|履历).{0,8}(怎么样|如何|能打几分))|"
    r"((招聘者|面试官|HR).{0,8}角度.{0,10}(简历|履历))"
)
_DIAGNOSIS_VERB_RE = re.compile(r"(诊断|评估|分析|检查)")
_TARGET_PROBLEM_RE = re.compile(
    r"(工作|实习|项目|教育|技能|自我评价|开源).{0,12}"
    r"(问题|毛病|不足|短板|怎么样|如何)"
)
_GENERIC_RESUME_REVIEW_RE = re.compile(
    r"^(?:请|麻烦)?(?:帮我)?(?:整体|全面)?看(?:看|一下|下)?"
    r"(?:我的|这份|当前)?简历(?:吧|怎么样|如何)?[。！!？?]*$"
)
_NARROW_TARGET_RE = re.compile(r"(简历|履历)(?:里|内|中)(?:面)?(?:的)?")
_DIRECT_EDIT_RE = re.compile(r"(改成|改为|替换|删除|添加|新增|填写|设置)")
_GENERIC_WHOLE_EDIT_RE = re.compile(
    r"((简历|履历)(?:里|内|中)(?:面)?(?:的)?(?:全部|所有|整体|通篇)?"
    r"(?:内容|文字|表述|措辞|表达))|"
    r"((简历|履历)(?:改成|改为|写成)(?:一份|一个)?(?:更|更加)?"
    r"(?:专业|优秀|有竞争力|更好)(?:的)?(?:版本)?)"
)
_JD_EDIT_RE = re.compile(
    r"((按|根据|针对).{0,12}(JD|目标岗位|职位描述|岗位描述|招聘要求|岗位要求))|"
    r"((JD|职位描述|岗位描述|招聘要求|岗位要求).{0,12}(优化|改写|定制))",
    re.IGNORECASE,
)


class ResumeRequestRoute(str, Enum):
    """简历请求的稳定产品路由，不替代 LLM 对具体操作参数的判断。"""

    BROAD_OPTIMIZE = "broad_optimize"
    DIAGNOSE = "diagnose"
    SPECIFIC_EDIT = "specific_edit"
    OTHER = "other"


def classify_resume_request(user_input: str) -> ResumeRequestRoute:
    """把近义表达归一为诊断入口、局部编辑或普通请求。

    宽泛优化只决定「先诊断」这一产品阶段；进入具体修改后，字段和工具仍由
    Agent 基于上下文决定。明确的模块/字段修改优先，不被整份诊断阻塞。
    """
    text = re.sub(r"\s+", "", (user_input or "").strip())
    if not text:
        return ResumeRequestRoute.OTHER
    if text == "针对诊断结果逐项修改":
        return ResumeRequestRoute.BROAD_OPTIMIZE
    if is_add_experience_query(text):
        return ResumeRequestRoute.SPECIFIC_EDIT

    has_edit_verb = bool(_OPTIMIZE_VERB_RE.search(text))
    has_named_target = bool(
        _SPECIFIC_SECTION_RE.search(text) or _JD_EDIT_RE.search(text)
    )
    has_specific_target = bool(
        has_named_target
        or _NARROW_TARGET_RE.search(text)
        or _DIRECT_EDIT_RE.search(text)
    )
    has_whole_scope = bool(_WHOLE_RESUME_RE.search(text))
    mentions_resume = "简历" in text or "履历" in text

    if (
        _DIAGNOSIS_RE.search(text)
        or _TARGET_PROBLEM_RE.search(text)
        or (
            _DIAGNOSIS_VERB_RE.search(text)
            and (mentions_resume or has_specific_target or has_whole_scope)
        )
        or _GENERIC_RESUME_REVIEW_RE.fullmatch(text)
    ):
        return ResumeRequestRoute.DIAGNOSE

    if _is_negated_edit_read_only(text):
        return ResumeRequestRoute.OTHER

    negated_edit = _NEGATED_EDIT_RE.search(text)
    if negated_edit and not _OPTIMIZE_VERB_RE.search(
        _NEGATED_EDIT_RE.sub("", text)
    ):
        return ResumeRequestRoute.OTHER

    if (
        has_edit_verb
        and _GENERIC_WHOLE_EDIT_RE.search(text)
        and not has_named_target
    ):
        return ResumeRequestRoute.BROAD_OPTIMIZE

    if has_edit_verb and has_specific_target:
        return ResumeRequestRoute.SPECIFIC_EDIT

    if has_edit_verb and (mentions_resume or has_whole_scope):
        return ResumeRequestRoute.BROAD_OPTIMIZE

    return ResumeRequestRoute.OTHER


def is_full_optimize_query(user_input: str) -> bool:
    """宽泛优化进入只读诊断入口；不代表已经授权自动写简历。"""
    return classify_resume_request(user_input) is ResumeRequestRoute.BROAD_OPTIMIZE


# 诊断后的显式应用文案：覆盖诊断卡/建议 chip 的真实措辞（"针对诊断结果逐项修改"
# "按建议帮我修改""按照诊断建议帮我修改简历""帮我处理简历诊断中的问题"
# "开始优化简历"），不含"我要优化简历"这类未引用诊断的泛优化——那仍走先诊断。
_DIAGNOSIS_APPLY_RE = re.compile(
    # 引用介词 + 诊断/建议 + 动手动词："针对诊断结果逐项修改""按照诊断建议帮我修改简历"
    r"(?:针对|按照?|根据|依照)[^，。;！!？?]{0,8}(?:诊断|建议)"
    r"[^，。;！!？?]{0,12}(?:修改|优化|修复|处理|改)"
    # 诊断/建议在前 + 动手动词："诊断建议帮我修改""建议直接优化"
    r"|(?:诊断|建议)[^，。;！!？?]{0,10}(?:帮我|给我|直接)?(?:逐项)?(?:修改|优化|修复|处理)"
    # 处理诊断中的问题："帮我处理简历内容诊断中的问题"
    r"|处理[^，。;！!？?]{0,16}诊断[^，。;！!？?]{0,10}(?:问题|建议)"
    # 明确启动语："开始优化简历""开始帮我优化简历"
    r"|开始(?:帮我)?(?:优化|修改)(?:我的|这份|一下)?(?:简历|履历)"
)


# 只读查看修改建议的文案（2026-07-16 诊断/建议拆分）：诊断卡「查看修改建议」
# chip 及同义说法。"查看"类是读，不是改——必须先于 apply 判定拦截，否则
# "查看这次诊断的修改建议"会被 _DIAGNOSIS_APPLY_RE 的"建议…修改"分支误判为
# 写入轮（实测 agent 直接动手改简历）。
_VIEW_SUGGESTIONS_RE = re.compile(
    r"(?:查看|看看|看一下|看下|展示|给我看|列出)"
    r"[^，。;！!？?]{0,16}(?:修改)?建议"
)


def is_view_suggestions_query(user_input: str) -> bool:
    """用户是否在请求查看诊断的修改建议（只读，不修改简历）。"""
    text = re.sub(r"\s+", "", (user_input or "").strip())
    if not text:
        return False
    return bool(_VIEW_SUGGESTIONS_RE.search(text))


def is_diagnosis_apply_query(user_input: str) -> bool:
    """用户是否显式要求按诊断/建议动手修改（Phase 3 写入入口）。

    只判文本；「本会话确实已产出诊断」由 Manus 侧结合
    `resume_diagnosis_completed_for` 会话状态把关（见
    `_diagnosis_completed_for_loaded_resume`），两者同时成立才解除
    diagnosis_only 只读闸。
    """
    text = re.sub(r"\s+", "", (user_input or "").strip())
    if not text:
        return False
    # "先别按建议改"之类的否定表达不算 apply
    if _NEGATED_EDIT_RE.search(text):
        return False
    # "查看修改建议"类是读不是改，优先归 view（见 is_view_suggestions_query）
    if _VIEW_SUGGESTIONS_RE.search(text):
        return False
    return bool(_DIAGNOSIS_APPLY_RE.search(text))

# 可选导入新的意图识别系统
try:
    from backend.agent.domain.intent.intent_enhancer import AgentIntentEnhancer
    from backend.agent.domain.intent.tool_registry import get_tool_registry
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
    GREETING = "greeting"  # 问候（含快速规则命中）- 交给问候提示词走 LLM 生成
    LOAD_RESUME = "load_resume"  # 加载简历 - 需检查重复
    ANALYZE_RESUME = "analyze_resume"  # 分析简历（触发 Agent 委托）
    OPTIMIZE_SECTION = "optimize_section"  # 优化某模块（触发 Agent 委托）
    FULL_OPTIMIZE = "full_optimize"  # 全面优化（触发 Agent 委托）
    EDIT_CV = "edit_cv"  # 编辑简历（简单规则命中时直调编辑工具）
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
                from backend.agent.domain.intent.intent_classifier import IntentClassifier
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

    def is_fast_greeting(self, user_input: str) -> bool:
        """本地快速问候判定，不触发 LLM。"""
        if not FAST_GREETING_ENABLED:
            return False
        return is_fast_greeting_text(user_input)

    def parse_fast_simple_edit(self, user_input: str) -> Optional[Dict[str, Any]]:
        """本地快速解析简单编辑意图（改名字 / 改实习公司N）。"""
        if not FAST_SIMPLE_EDIT_ENABLED:
            return None
        return parse_fast_simple_edit_text(user_input)

    @staticmethod
    def _looks_like_real_file_path(candidate: str) -> bool:
        """过滤 Java/Go 等技术词被误识别为 /Go 这类路径的情况。"""
        path = (candidate or "").strip().strip("'\"")
        if not path:
            return False
        if re.search(r"\.(?:md|txt|json|yaml|yml|pdf|docx?)$", path, re.IGNORECASE):
            return True
        if re.match(r"^[A-Za-z]:\\", path):
            return True
        if re.match(r"^(?:~\/|\./|\.\./).+", path):
            return True
        if path.startswith("/") and path.count("/") >= 2:
            return True
        return False

    @staticmethod
    def _extract_resume_file_path(user_input: str) -> Optional[str]:
        """从输入中提取简历文件路径（用于 cv_reader_agent）。"""
        raw = (user_input or "").strip()
        if not raw or is_pasted_resume_import_text(raw):
            return None

        patterns = [
            r"(?:加载|导入|读取)\s*(?:我的)?简历(?:文件)?\s*[:：]?\s*([^\s]+)",
            r"(?:load|import|read)\s*(?:my\s+)?(?:resume|cv)\s*[:：]?\s*([^\s]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, raw, re.IGNORECASE)
            if match:
                candidate = (match.group(1) or "").strip().strip("'\"")
                if candidate and ConversationStateManager._looks_like_real_file_path(
                    candidate
                ):
                    return candidate

        direct_path = re.search(
            r"((?:~\/|\./|\.\./)[^\s]+|[A-Za-z]:\\[^\s]+|[^\s]+\.(?:md|txt|json|yaml|yml|pdf|docx?))",
            raw,
            re.IGNORECASE,
        )
        if direct_path:
            candidate = direct_path.group(1).strip().strip("'\"")
            if ConversationStateManager._looks_like_real_file_path(candidate):
                return candidate

        return None

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

        # 对话粘贴导入：不应走 load_resume / cv_reader 文件路径逻辑
        if is_pasted_resume_import_text(user_input):
            return {
                "intent": Intent.UNKNOWN,
                "tool": None,
                "tool_args": {},
                "context_prompt": "",
                "should_skip_llm": False,
                "enhanced_query": user_input,
                "intent_result": None,
                "intent_source": "paste_import_guard",
            }

        # 🚀 快速问候路径：直接命中，不走 LLM/工具识别
        if self.is_fast_greeting(user_input):
            self.context.state = ConversationState.GREETING
            return {
                "intent": Intent.GREETING,
                "tool": None,
                "tool_args": {},
                "context_prompt": "",
                "should_skip_llm": True,
                "enhanced_query": user_input,
                "intent_result": None,
                "intent_source": "fast_rule",
            }

        # 🚀 简单编辑路径：本地规则优先，不走 LLM 意图分类
        if is_add_experience_query(user_input):
            return {
                "intent": Intent.EDIT_CV,
                "tool": None,
                "tool_args": {},
                "context_prompt": "",
                "should_skip_llm": False,
                "enhanced_query": user_input,
                "intent_result": None,
                "intent_source": "fast_rule_add_experience",
            }

        simple_edit_payload = self.parse_fast_simple_edit(user_input)
        if simple_edit_payload:
            return {
                "intent": Intent.EDIT_CV,
                "tool": "cv_editor_agent",
                "tool_args": {
                    "path": simple_edit_payload["path"],
                    "action": simple_edit_payload["action"],
                    "value": simple_edit_payload["value"],
                },
                "context_prompt": "",
                "should_skip_llm": True,
                "enhanced_query": user_input,
                "intent_result": None,
                "intent_source": "fast_rule",
                "simple_edit_payload": simple_edit_payload,
            }

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
                        "intent_source": "enhanced_rule",
                    }
                    self.context.state = ConversationState.GREETING
                    return result

                # 检查是否识别到工具
                if intent_result and intent_result.matched_tools:
                    tool_name = intent_result.matched_tools[0]
                    tool_args = {}
                    top_intent = Intent.UNKNOWN

                    if tool_name == "cv_reader_agent":
                        file_path = self._extract_resume_file_path(user_input)
                        if file_path:
                            tool_args["file_path"] = file_path
                            top_intent = Intent.LOAD_RESUME
                        elif self.context.resume_loaded:
                            # 简历已加载，不走 LOAD_RESUME 快路径
                            # 交给 Hybrid + LLM 直接基于 context 回答
                            return {
                                "intent": Intent.UNKNOWN,
                                "tool": None,
                                "tool_args": {},
                                "context_prompt": "",
                                "should_skip_llm": False,
                                "enhanced_query": user_input,
                                "intent_result": intent_result,
                                "intent_source": "enhanced_rule_hybrid_fallback",
                            }
                        else:
                            tool_name = "show_resume"
                            top_intent = Intent.LOAD_RESUME
                    elif tool_name == "show_resume":
                        if self.context.resume_loaded:
                            return {
                                "intent": Intent.UNKNOWN,
                                "tool": None,
                                "tool_args": {},
                                "context_prompt": "",
                                "should_skip_llm": False,
                                "enhanced_query": user_input,
                                "intent_result": intent_result,
                                "intent_source": "enhanced_rule_hybrid_fallback",
                            }
                        top_intent = Intent.LOAD_RESUME

                    result = {
                        "intent": top_intent,
                        "tool": tool_name,
                        "tool_args": tool_args,
                        "context_prompt": "",
                        "should_skip_llm": False,
                        "enhanced_query": enhanced_query,
                        "intent_result": intent_result,
                        "intent_source": "enhanced_rule",
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
                        "intent_source": "enhanced_rule",
                    }

                result = {
                    "intent": Intent.UNKNOWN,
                    "tool": None,
                    "tool_args": {},
                    "context_prompt": "",
                    "should_skip_llm": False,
                    "enhanced_query": enhanced_query,
                    "intent_result": intent_result,
                    "intent_source": "enhanced_rule",
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
            "intent_source": "llm",
        }

        if intent == Intent.GREETING:
            # 问候 - 不调用工具，交给 LLM 返回问候
            result["tool"] = None
            self.context.state = ConversationState.GREETING
        elif intent == Intent.LOAD_RESUME:
            file_path = self._extract_resume_file_path(user_input) or info.get("file_path")
            if file_path:
                result["tool"] = "cv_reader_agent"
                result["tool_args"] = {"file_path": file_path}
            elif self.context.resume_loaded:
                result["intent"] = Intent.UNKNOWN
                result["tool"] = None
            else:
                result["tool"] = "show_resume"
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

        if is_add_experience_query(text):
            return Intent.EDIT_CV, self._extract_section(text.strip().lower())

        normalized = text.strip().lower()
        section = self._extract_section(normalized)

        if "全面优化" in normalized or "整体优化" in normalized or "全局优化" in normalized:
            return Intent.FULL_OPTIMIZE, section

        # 语义修改类请求（量化/润色/突出/改进/丰富），有具体指向时走 EDIT_CV 让 LLM 调工具
        SEMANTIC_EDIT_KEYWORDS = ["量化", "润色", "突出", "改进", "丰富", "改写", "重写"]
        if any(kw in normalized for kw in SEMANTIC_EDIT_KEYWORDS):
            # 有明确 section 指向，或包含"经历"/"条"等指代，走 EDIT_CV
            if section or any(w in normalized for w in ["经历", "条", "第一", "第二", "第三", "腾讯", "工作", "项目", "教育"]):
                return Intent.EDIT_CV, section

        # 描述正文里可能出现「SQL优化」「应用」等词，不能据此判为优化意图
        if "优化" in normalized and not is_add_experience_query(text):
            return Intent.OPTIMIZE_SECTION, section

        # 「润色/完善/提升 + 简历」等整篇打磨说法与「优化简历」同义，统一走优化链路
        # （带 section/经历指向的已被上面 EDIT_CV 分支接住，这里只兜「…简历」）
        _optimize_synonyms = ("润色", "完善", "提升", "改好", "改得更好", "写得更好")
        if (
            any(kw in normalized for kw in _optimize_synonyms)
            and "简历" in normalized
            and not is_add_experience_query(text)
        ):
            return Intent.OPTIMIZE_SECTION, section

        if (
            ("分析" in normalized or "评估" in normalized or "诊断" in normalized)
            and not is_add_experience_query(text)
        ):
            if "简历" in normalized or section or "诊断" in normalized:
                return Intent.ANALYZE_RESUME, section

        return None, None

    def _extract_section(self, text: str) -> Optional[str]:
        """Extract section name from text."""
        section_map = {
            "工作经历": ["工作经历", "工作经验", "工作", "实习经历", "实习"],
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
        # LOAD_RESUME / EDIT_CV 走直接工具调用，保证稳定性与低延迟；
        # EDIT_CV 的可见推理由 Manus 在调用前明确输出。
        return intent in {Intent.LOAD_RESUME, Intent.EDIT_CV}
