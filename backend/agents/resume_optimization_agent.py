"""
简历优化 Agent

集成诊断系统，提供智能简历优化服务
"""

import json
import logging
import re
from typing import Generator, Dict, Any, Optional
from .cv_agent import CVAgent
from .diagnosis import ResumeDiagnosis, GuidanceEngine, FollowUpSystem

logger = logging.getLogger(__name__)


class ResumeOptimizationAgent(CVAgent):
    """简历优化专用 Agent"""

    def __init__(self, resume_id: str, session_id: str, **kwargs):
        # 初始化父类
        super().__init__(resume_data=None, session_id=session_id, **kwargs)

        self.resume_id = resume_id

        # 初始化诊断系统
        self.diagnosis = ResumeDiagnosis()
        self.guidance = GuidanceEngine()
        self.followup = FollowUpSystem()

        # 状态管理
        self.current_module = None
        self.is_followup_mode = False
        self.has_diagnosed = False

        # 加载简历数据
        self._load_resume_data()

    def _load_resume_data(self):
        """加载简历数据"""
        try:
            # 从 localStorage 或 API 获取简历数据
            # 暂时使用空字典，让诊断系统处理
            self.resume_data = {
                "basic": {},
                "summary": "",
                "experience": [],
                "projects": [],
                "education": [],
                "skills": []
            }
            logger.info(f"简历数据加载完成: {self.resume_id}")

        except Exception as e:
            logger.error(f"加载简历数据失败: {str(e)}")
            self.resume_data = {}

    async def process_message_stream(self, user_message: str) -> Generator[Dict[str, Any], None, None]:
        """
        处理用户消息

        Args:
            user_message: 用户消息

        Yields:
            Dict: 流式响应消息
        """
        try:
            # 检测用户意图
            intent = self._detect_intent(user_message)

            # 根据意图处理
            if intent == "diagnose":
                yield from self._handle_diagnose()

            elif intent == "optimize_module":
                module = self._extract_module_from_message(user_message)
                yield from self._handle_optimize_module(module)

            elif intent == "provide_info":
                if self.is_followup_mode:
                    yield from self._handle_followup(user_message)
                else:
                    # 常规对话，使用父类处理
                    yield from super().process_message_stream(user_message)

            else:
                # 未知意图，使用父类处理
                yield from super().process_message_stream(user_message)

        except Exception as e:
            logger.error(f"处理消息失败: {str(e)}")
            yield {
                "type": "error",
                "content": f"处理失败: {str(e)}",
                "role": "assistant"
            }

    def _handle_diagnose(self) -> Generator[Dict[str, Any], None, None]:
        """处理诊断意图"""

        # 1. 发送"正在诊断"消息
        yield {
            "type": "text",
            "content": "收到！让我先看看您的简历。",
            "role": "assistant"
        }

        # 2. 执行诊断
        report = self.diagnosis.diagnose(self.resume_data)

        # 3. 发送诊断报告
        yield {
            "type": "diagnosis_report",
            "content": report.to_dict(),
            "message": report.to_message(),
            "role": "assistant"
        }

        # 4. 发送引导选项
        choices = self.guidance.generate_guidance_choices(report)
        yield {
            "type": "guidance_choices",
            "choices": choices,
            "message": "您想从哪个方面开始优化？",
            "role": "assistant"
        }

        self.has_diagnosed = True

    def _handle_optimize_module(self, module: str) -> Generator[Dict[str, Any], None, None]:
        """处理模块优化意图"""

        if module == "unknown":
            yield {
                "type": "text",
                "content": "抱歉，我不确定您想优化哪个模块。请从上面的选项中选择，或者直接告诉我：个人总结、工作经历、项目经历、教育经历或技能。",
                "role": "assistant"
            }
            return

        self.current_module = module

        # 生成模块引导问题
        question = self.guidance.generate_module_question(module, self.resume_data)

        yield {
            "type": "text",
            "content": question,
            "role": "assistant"
        }

        # 进入追问模式
        self.is_followup_mode = True

    def _handle_followup(self, user_message: str) -> Generator[Dict[str, Any], None, None]:
        """处理追问模式"""

        # 开始或继续追问
        if not hasattr(self.followup, 'collected_info') or not self.followup.collected_info:
            # 第一次追问
            followup_question = self.followup.start_followup(
                self.current_module,
                user_message
            )
        else:
            # 继续追问
            context = {
                "resume_data": self.resume_data,
                "module": self.current_module
            }
            followup_question = self.followup.continue_followup(
                user_message,
                context
            )

        if followup_question:
            # 还有追问
            yield {
                "type": "followup",
                "content": followup_question,
                "role": "assistant"
            }
        else:
            # 追问完成，尝试生成内容并更新
            yield from self._generate_and_update_resume(user_message)

    def _generate_and_update_resume(self, user_message: str) -> Generator[Dict[str, Any], None, None]:
        """
        生成内容并更新简历

        Args:
            user_message: 用户最后的输入

        Yields:
            Dict: 流式响应
        """

        # 生成优化后的内容
        yield {
            "type": "text",
            "content": "好的，我来帮您生成优化后的内容...",
            "role": "assistant"
        }

        # 这里应该调用 LLM 生成优化内容
        # 暂时使用用户输入作为内容
        optimized_content = user_message

        # 显示预览
        yield {
            "type": "content_preview",
            "content": optimized_content,
            "message": "这是为您生成的内容，您觉得怎么样？",
            "role": "assistant"
        }

        # 注意：实际更新需要用户确认
        # 这里假设用户已经确认
        yield from self._update_resume_field(optimized_content)

    def _update_resume_field(self, content: str) -> Generator[Dict[str, Any], None, None]:
        """
        更新简历字段（简化版本）

        Args:
            content: 要更新的内容

        Yields:
            Dict: 流式响应
        """

        try:
            # 确定更新路径
            path = self._get_module_path(self.current_module)

            # TODO: 实际更新应该通过 CVEditor 工具或 API
            # 暂时只返回成功消息
            yield {
                "type": "update_success",
                "content": content,
                "path": path,
                "message": "✅ 已更新简历！",
                "role": "assistant"
            }

            # 重新加载简历数据
            self._load_resume_data()

            # 生成下一步建议
            try:
                next_step = self.guidance.generate_next_step_suggestion(
                    self.current_module,
                    self.resume_data
                )
            except Exception:
                next_step = "继续优化其他模块吧！还有哪些需要完善的？"

            yield {
                "type": "text",
                "content": next_step,
                "role": "assistant"
            }

            # 退出追问模式
            self.is_followup_mode = False

        except Exception as e:
            logger.error(f"更新简历失败: {str(e)}")
            yield {
                "type": "error",
                "content": f"更新失败: {str(e)}",
                "role": "assistant"
            }

    def _detect_intent(self, message: str) -> str:
        """
        检测用户意图

        Args:
            message: 用户消息

        Returns:
            str: 意图类型 (diagnose, optimize_module, provide_info)
        """

        # 诊断意图关键词
        diagnosis_keywords = [
            "帮我看看", "诊断", "怎么样", "有什么建议",
            "优化简历", "分析简历", "评估简历"
        ]

        # 优化模块关键词
        module_keywords = {
            "个人总结": "summary",
            "总结": "summary",
            "工作经历": "experience",
            "实习": "experience",
            "项目经历": "projects",
            "项目": "projects",
            "教育经历": "education",
            "教育": "education",
            "技能": "skills"
        }

        # 检查诊断意图
        if any(word in message for word in diagnosis_keywords):
            return "diagnose"

        # 检查优化模块意图
        for keyword, module in module_keywords.items():
            if keyword in message:
                # 直接返回模块名
                if hasattr(self, '_detected_module'):
                    self._detected_module = module
                return "optimize_module"

        # 检查是否是从选项中选择的
        if hasattr(self, '_detected_module') and self._detected_module:
            intent = "optimize_module"
            delattr(self, '_detected_module')
            return intent

        # 默认：提供信息
        return "provide_info"

    def _extract_module_from_message(self, message: str) -> str:
        """从消息中提取模块名"""

        module_mapping = {
            "个人总结": "summary",
            "总结": "summary",
            "工作经历": "experience",
            "实习": "experience",
            "项目经历": "projects",
            "项目": "projects",
            "教育经历": "education",
            "教育": "education",
            "技能": "skills"
        }

        for keyword, module in module_mapping.items():
            if keyword in message:
                return module

        return "unknown"

    def _get_module_path(self, module: str) -> str:
        """获取模块的数据路径"""

        path_mapping = {
            "summary": "sections.summary.content",
            "experience": "sections.experience.items[0].summary",
            "projects": "sections.projects.items[0].description",
            "education": "sections.education.items[0].summary",
            "skills": "sections.skills"
        }

        return path_mapping.get(module, "sections.summary.content")
