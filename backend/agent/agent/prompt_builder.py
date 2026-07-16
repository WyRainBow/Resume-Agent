"""动态 prompt 构造（Wave 2a-S2）：从 Manus 迁出，纯搬运不改行为。

职责：system prompt 拼装（含只读/新增经历轮次约束）、简历 context 注入、
office skills addendum、next-step prompt。不碰 memory 写入、不调 LLM——
依赖以构造参数/方法参数显式注入（golden 对拍锁定，见 test_prompt_builder.py）。
"""

from pathlib import Path
from typing import Any, List, Optional

from backend.agent.agent.capability import CapabilityRegistry
from backend.agent.application.conversation.conversation_state import (
    is_add_experience_query,
    is_diagnosis_apply_query,
    is_full_optimize_query,
    is_read_only_query,
)
from backend.agent.application.resume_skill_resolver import ResumeSkillResolver
from backend.agent.config import config
from backend.agent.memory import Intent
from backend.agent.prompt.manus import NEXT_STEP_PROMPT, SYSTEM_PROMPT
from backend.agent.tool.resume_data_store import ResumeDataStore
from backend.agent.utils.optimize_progress import (
    is_optimize_continuation_message,
    render_progress_checklist,
    slice_resume_context_for_module,
)
from backend.core.logger import get_logger

logger = get_logger(__name__)


class PromptBuilder:
    """按会话构造动态 prompt；skills 缓存跨轮共享（与原 Manus._skills_cache 语义一致）。"""

    def __init__(self, session_id: Optional[str], capability: Any, skills_cache: Optional[dict] = None):
        self._session_id = session_id
        self._capability = capability
        self._skills_cache: dict = skills_cache if skills_cache is not None else {}

    async def generate(
        self,
        user_input: str,
        intent: Optional[Intent],
        *,
        resume_loaded: bool,
        current_resume_path: Optional[str],
        recent_messages: List[Any],
    ) -> tuple:
        """
        根据用户输入和对话状态动态生成提示词（Hybrid 模式）

        Hybrid：简历内容注入 system prompt context，读免费，写走 tool。

        返回: (system_prompt, next_step_prompt)
        """
        logger.info(f"🔍 获取到的用户输入: {user_input[:100] if user_input else '(空)'}")

        context_parts = []
        if resume_loaded:
            context_parts.append("✅ 简历已加载（完整内容见下方）")
        else:
            context_parts.append("⚠️ 简历未加载，建议先加载简历")

        if current_resume_path:
            context_parts.append(f"📄 当前简历文件: {current_resume_path}")

        context = "\n".join(context_parts) if context_parts else "初始状态"

        system_prompt = SYSTEM_PROMPT.replace(
            "{directory}", str(config.workspace_root)
        ).replace(
            "{context}", context
        )
        capability = CapabilityRegistry.get(self._capability)
        if capability.instructions_addendum:
            system_prompt = f"{system_prompt}\n\n{capability.instructions_addendum}"
        skills_addendum = self.build_skill_addendum(user_input or "")
        if skills_addendum:
            system_prompt = f"{system_prompt}\n\n{skills_addendum}"

        # Hybrid: 注入简历内容到 system prompt
        # 整份优化场景下过滤隐私信息（phone/email/location），只保留求职相关信息。
        # 不能用 intent == Intent.FULL_OPTIMIZE 判断——LLM-first 让权守卫会把这个
        # 意图统一清空成 UNKNOWN 再交给 LLM，导致这条判断在生产环境从未真正生效过
        # （2026-07-12 debug log 501 行实测：零命中 intent=full_optimize）。脱敏是
        # 安全边界判断，改成直接对用户原始文本判断，不依赖会被路由层清空的 intent。
        #
        # **独立 review 发现并修复的真实 bug**：这里原来用"该会话有未完成任务"
        # （has_active_task）单独触发脱敏/增量注入，跟 manus.py
        # ._maybe_init_optimize_progress/_advance_optimize_progress 的相关性判据
        # （is_full_optimize_query 或 is_optimize_continuation_message）不一致——
        # 任务 alive 期间用户随口一句无关闲聊，也会被这里强制脱敏、且只看得到
        # 当前模块全文（其他模块本轮被切掉），跟 manus.py 那边"无关轮次当普通
        # 对话处理"的口径矛盾。改成跟 manus.py 用同一个相关性判据：本轮必须是
        # 用户主动的整份优化措辞，或系统合成的续跑消息，脱敏/增量注入才生效；
        # 无关轮次按普通 Hybrid 模式处理（不脱敏、给全量原文）。见设计方案七点二。
        progress = ResumeDataStore.get_progress(self._session_id)
        is_continuation = is_optimize_continuation_message(user_input or "")
        is_progress_turn = is_diagnosis_apply_query(
            user_input or ""
        ) or is_continuation
        is_diagnosis_turn = is_full_optimize_query(user_input or "")
        mask_pii = is_diagnosis_turn or is_progress_turn
        resume_text = self.format_resume_for_context(mask_pii=mask_pii)
        if resume_text:
            # 增量注入（设计方案七点二/三点五）：optimizing 阶段、且本轮确实跟
            # 整份优化相关时，只发当前模块全文，其他模块本轮延后发送（只给
            # 标题，不是压缩）；无关轮次/reviewing/无活跃任务时保持全量注入。
            if (
                is_progress_turn
                and progress
                and progress.get("status") == "optimizing"
                and progress.get("pending")
            ):
                resume_text = slice_resume_context_for_module(resume_text, progress["pending"][0])
            system_prompt = f"{system_prompt}\n\n{resume_text}"
            if mask_pii:
                logger.info("📋 简历内容已注入 system prompt（诊断/优化模式，已过滤隐私信息）")
            else:
                logger.info("📋 简历内容已注入 system prompt（Hybrid 模式）")

        # **独立 review round5 发现并修复的真实 bug**：这里原来只要 progress
        # 存在就无条件渲染进度清单，跟上面 mask_pii/切片的相关性门槛不一致
        # ——任务 alive 期间一句无关闲聊、甚至只读查看轮次，也会被塞进
        # "当前模块：X ← 本轮只优化这一个模块……输出 [[MODULE_DONE:X]]"
        # 这种明确引导 LLM 调用 cv_editor_agent 的指令，直接跟紧跟着注入的
        # "禁止调用 cv_editor_agent"只读约束打架，也可能诱发一次跟本轮无关
        # 的编辑。改成跟 mask_pii/切片用同一个 is_progress_turn 判据。
        if progress and is_progress_turn:
            system_prompt = f"{system_prompt}\n\n{render_progress_checklist(progress)}"

        if is_read_only_query(user_input or ""):
            system_prompt = (
                f"{system_prompt}\n\n"
                "## 本轮约束（只读查看）\n"
                "用户正在读取/查看简历内容。**禁止**调用 cv_editor_agent、str_replace_editor"
                "及任何写文件/改代码工具；不要修改简历。"
                "必须直接根据上方「# CV/Resume Context」完整输出原文，禁止去查源码。\n"
                "每条经历的 Details 按多行要点列出（保留 - 开头的子项），不要合并成一大段。\n"
            )
        elif is_add_experience_query(user_input or ""):
            system_prompt = (
                f"{system_prompt}\n\n"
                "## 本轮约束（新增经历）\n"
                "用户要导入/新增一段实习或工作经历：**本轮不是只读**，必须调用 cv_editor_agent；"
                "禁止声称「只读模式」「无法修改」。\n"
                "action=add，path=experience，value 为**单个 JSON 对象**（勿把整个对象再 stringify 成字符串）。\n"
                "字段：company、position、date（不要用 period）、details（HTML ul.custom-list + strong）。\n"
                "details 每条成果单独一个 <li>，禁止把 1.2.3. 或分号分隔的多条成就写进同一个 <li>。\n"
                "禁止 STAR 模板，禁止 update experience[0]，必须 append 新条。\n"
            )

        next_step = await self.generate_next_step_prompt(intent, recent_messages)

        logger.info(f"💭 提示词已生成，当前状态: {context}")
        return system_prompt, next_step

    def format_resume_for_context(self, mask_pii: bool = False) -> str:
        """将当前简历格式化为可注入 system prompt 的文本。

        使用 ReadCVContext 复用已有的格式化逻辑（含索引标记和 path 提示），
        确保 LLM 看到的和 cv_editor_agent 操作的是同一份数据。

        Args:
            mask_pii: 为 True 时过滤电话/邮箱/住址等隐私信息（用于整份优化场景）。
        """
        resume_data = ResumeDataStore.get_data(self._session_id)
        if not resume_data:
            return ""
        try:
            from backend.agent.tool.cv_reader_tool import ReadCVContext
            reader = ReadCVContext()
            reader.set_resume_data(resume_data)
            return reader._format_full_resume(mask_pii=mask_pii)
        except Exception as exc:
            # 简历 context 注入失败会让 LLM 完全看不到简历内容、行为不可预测，
            # 不能静默降级——提升为 error 保证被看到，同时仍返回空串避免整轮请求崩溃。
            logger.error(f"格式化简历注入 context 失败: {exc}")
            return ""

    def build_skill_addendum(self, user_input: str) -> str:
        """
        根据用户输入匹配 backend/agent/skills 下的技能文档，并注入指导。

        当前支持：
        - resume-diagnosis / resume-suggest 完整技能
        - office-files 总入口
        - office-files 子技能：pdf/docx/pptx/xlsx
        """
        text = (user_input or "").lower()
        if not text:
            return ""

        skills_base = Path(__file__).resolve().parents[1] / "skills"
        resume_guidance_parts: list[str] = []
        for skill_name in ResumeSkillResolver().resolve(user_input):
            guidance = self.read_skill(skills_base / skill_name / "SKILL.md")
            if guidance:
                resume_guidance_parts.append(f"[Skill: {skill_name}]\n{guidance}")

        # 关键词触发：文档处理相关请求才加载 skills，避免污染普通对话
        office_keywords = [
            ".pdf", "pdf", "docx", ".docx", "ppt", ".pptx", "pptx",
            "xlsx", ".xlsx", "word", "excel", "powerpoint",
            "文档", "表格", "电子表格", "幻灯片", "演示文稿", "文件处理",
        ]
        office_guidance_parts: list[str] = []
        if any(k in text for k in office_keywords):
            skills_root = skills_base / "office-files"

            # 1) 先加载 office-files 总路由技能
            root_guidance = self.read_skill_excerpt(skills_root / "SKILL.md", max_chars=1800)
            if root_guidance:
                office_guidance_parts.append(f"[Skill: office-files]\n{root_guidance}")

            # 2) 再根据输入匹配子技能
            sub_skill_map = {
                "pdf": [".pdf", "pdf", "合并pdf", "拆分pdf", "提取pdf", "表单pdf"],
                "docx": [".docx", "docx", "word", "文档"],
                "pptx": [".pptx", "pptx", "ppt", "powerpoint", "幻灯片", "演示文稿"],
                "xlsx": [".xlsx", "xlsx", "excel", "表格", "电子表格"],
            }
            for sub_skill, keys in sub_skill_map.items():
                if any(k in text for k in keys):
                    sub_guidance = self.read_skill_excerpt(
                        skills_root / sub_skill / "SKILL.md",
                        max_chars=2200,
                    )
                    if sub_guidance:
                        office_guidance_parts.append(
                            f"[Sub-Skill: {sub_skill}]\n{sub_guidance}"
                        )

        sections: list[str] = []
        if resume_guidance_parts:
            sections.append(
                "## Resume Skills Guidance\n"
                "Follow these complete rules for the current read-only diagnosis turn:\n\n"
                + "\n\n".join(resume_guidance_parts)
            )
        if office_guidance_parts:
            sections.append(
                "## Skills Guidance (from backend/agent/skills)\n"
                "When handling office/document requests, follow the guidance below before choosing tools:\n\n"
                + "\n\n".join(office_guidance_parts)
            )
        return "\n\n".join(sections)

    def read_skill(self, file_path: Path) -> str:
        """Read a required, complete resume Skill and fail visibly if invalid."""
        return self._read_skill(file_path, required=True)

    def read_skill_excerpt(self, file_path: Path, max_chars: int = 2000) -> str:
        """读取技能文档并做截断缓存，避免每轮重复 I/O。"""
        return self._read_skill(file_path, max_chars=max_chars, required=False)

    def _read_skill(
        self,
        file_path: Path,
        *,
        max_chars: int | None = None,
        required: bool,
    ) -> str:
        """Single cached Skill loader with explicit required/optional semantics."""
        key = f"{file_path}|{max_chars or 'full'}"
        if key in self._skills_cache:
            return self._skills_cache[key]
        try:
            if not file_path.exists():
                raise FileNotFoundError(file_path)
            content = file_path.read_text(encoding="utf-8").strip()
            if not content:
                raise RuntimeError(f"Skill file is empty: {file_path}")
            resolved = content if max_chars is None else content[:max_chars]
            self._skills_cache[key] = resolved
            return resolved
        except (OSError, UnicodeError, RuntimeError) as exc:
            if required:
                raise RuntimeError(
                    f"Required resume Skill could not be loaded: {file_path}"
                ) from exc
            logger.warning(f"[Skills] Failed to read optional skill {file_path}: {exc}")
            return ""

    async def generate_next_step_prompt(
        self, intent: Optional[Intent], recent_messages: List[Any]
    ) -> str:
        """生成下一步提示词

        核心设计：
        1. UNKNOWN 意图：返回空字符串，让 LLM 自然回答
        2. 分析完成后：返回结果展示模板
        3. 其他情况：返回默认的 NEXT_STEP_PROMPT

        注意：GREETING 意图在 think() 中直接处理，设置 system_prompt 后走 LLM
        """
        # 🔑 UNKNOWN 意图：返回空字符串，让 LLM 自然回答
        if intent == Intent.UNKNOWN:
            return ""

        # GREETING 在 think() 中专门处理，这里保持空避免提示词串扰
        if intent == Intent.GREETING:
            return ""

        # 检查是否有分析工具刚执行完
        recent_analysis = False
        analysis_tool_name = None

        for msg in reversed(recent_messages[-3:]):
            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc.function.name == 'cv_analyzer_agent':
                        recent_analysis = True
                        break
                if recent_analysis:
                    break

        if not recent_analysis:
            return NEXT_STEP_PROMPT

        # 检查分析结果是否已返回
        analysis_result_returned = False
        for msg in reversed(recent_messages[-5:]):
            if hasattr(msg, 'role') and msg.role == "tool":
                if hasattr(msg, 'name') and msg.name == 'cv_analyzer_agent':
                    analysis_result_returned = True
                    analysis_tool_name = msg.name
                    break
            elif hasattr(msg, 'content') and msg.content:
                if "优化建议示例" in msg.content:
                    analysis_result_returned = True
                    analysis_tool_name = "cv_analyzer_agent"
                    break

        if not analysis_result_returned:
            return NEXT_STEP_PROMPT

        # 获取分析结果内容
        analysis_content = ""
        for msg in reversed(recent_messages[-10:]):
            if msg.role == "tool" and msg.name == 'cv_analyzer_agent':
                analysis_content = msg.content[:5000]
                break

        return f"""## 分析完成，请展示结果

分析工具 ({analysis_tool_name}) 已返回结果，请向用户展示：

{analysis_content[:2000]}

请用中文向用户展示分析结果摘要和优化建议，然后询问是否要应用优化。"""
