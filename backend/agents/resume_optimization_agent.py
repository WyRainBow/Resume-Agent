"""
简历优化 Agent

集成诊断系统，提供智能简历优化服务

架构设计：
- 继承 CVAgent 获得 LLM 和工具能力
- 诊断系统：分析简历问题
- 引擎系统：生成优化建议和追问
- LLM 集成：动态生成优化内容和追问问题
"""

import json
import logging
import os
from typing import Generator, Dict, Any, Optional, List
import httpx
from .cv_agent import CVAgent
from .diagnosis import ResumeDiagnosis, GuidanceEngine, FollowUpSystem

logger = logging.getLogger(__name__)

# ============================================================================
# LLM Prompts for 简历优化
# ============================================================================

OPTIMIZATION_SYSTEM_PROMPT = """你是专业的简历优化顾问，擅长帮助用户完善简历内容。

你的任务：
1. 根据用户输入和简历现状，生成优化后的简历内容
2. 使用 STAR 法则（Situation, Task, Action, Result）优化经历描述
3. 突出成就和量化结果
4. 使用专业但不过于夸张的语言

优化原则：
- **真实优先**：基于用户提供的信息，不编造不存在的内容
- **简洁有力**：去除冗余表达，每句话都有价值
- **量化成果**：用数字说话（提升X%、覆盖Y用户等）
- **行动导向**：使用强有力的动词（主导、负责、实现、优化等）

输出格式：
- 直接输出优化后的内容，不要解释
- 长描述使用 HTML 格式（<ul><li>...</li></ul>）
- 保持专业和积极的语气"""

FOLLOWUP_SYSTEM_PROMPT = """你是专业的简历顾问，正在帮助用户完善简历。

你的任务：
1. 根据用户已提供的信息，判断是否还需要补充其他关键信息
2. 如果需要补充，提出具体的追问
3. 如果信息已足够，返回 null（不需要追问）

追问原则：
- 优先追问关键信息（缺失会严重影响简历质量）
- 每次只问 1-2 个问题，避免让用户感到压力
- 问题要具体，不要模糊

模块追问要点：
- **个人总结**：职业目标、核心优势、独特价值
- **工作经历**：主要职责、重点项目、量化成果、团队规模
- **项目经历**：项目背景、个人角色、技术栈、项目结果
- **教育经历**：在校期间的亮点（GPA、奖项、论文等）
- **技能**：熟练度、应用场景、认证等

输出格式：
- 需要追问：直接输出追问问题文本
- 不需要追问：输出 null"""


class ResumeOptimizationAgent(CVAgent):
    """简历优化专用 Agent

    架构：
    - 继承 CVAgent：获得 LLM 调用、工具执行、状态管理能力
    - 诊断系统：ResumeDiagnosis 分析简历问题
    - 引导引擎：GuidanceEngine 生成优化建议
    - 追问系统：FollowUpSystem 处理渐进式信息收集
    - LLM 集成：动态生成优化内容，避免硬编码
    """

    # 模块名称映射
    MODULE_NAMES = {
        "summary": "个人总结",
        "experience": "工作经历",
        "projects": "项目经历",
        "education": "教育经历",
        "skills": "专业技能",
        "basic": "基本信息"
    }

    def __init__(self, resume_id: str, session_id: str, **kwargs):
        # 初始化父类（获得 LLM 和工具能力）
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

        # LLM 配置（继承自父类）
        self.llm_api_key = os.getenv("DEEPSEEK_API_KEY")
        self.llm_base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self.llm_model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

        # 追问收集的信息
        self.collected_info: List[str] = []

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

    def process_message_stream(self, user_message: str) -> Generator[Dict[str, Any], None, None]:
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
        """
        处理追问模式（使用 LLM 生成追问）

        架构：
        1. 收集用户提供的信息
        2. 调用 LLM 判断是否需要追问
        3. 如果不需要追问，生成优化内容并更新简历
        """

        # 添加用户输入到已收集信息
        self.collected_info.append(user_message)

        # 使用 LLM 判断是否需要追问
        current_data = self._get_module_current_data(self.current_module)

        for response in self._generate_followup_question_llm(
            module=self.current_module,
            collected_info=self.collected_info,
            current_data=current_data
        ):
            if response["type"] == "followup_question":
                followup_question = response["content"]

                if followup_question:
                    # 还有追问
                    yield {
                        "type": "followup",
                        "content": followup_question,
                        "role": "assistant"
                    }
                else:
                    # 追问完成，生成优化内容
                    yield from self._generate_and_update_resume_final()
                return

    def _generate_and_update_resume_final(self) -> Generator[Dict[str, Any], None, None]:
        """
        生成优化内容并更新简历（最终版本）

        Yields:
            Dict: 流式响应
        """

        # 发送正在处理消息
        yield {
            "type": "text",
            "content": "好的，我来帮您生成优化后的内容...",
            "role": "assistant"
        }

        # 调用 LLM 生成优化内容
        optimized_content = yield from self._generate_optimized_content_llm(
            module=self.current_module,
            collected_info=self.collected_info,
            current_data=self._get_module_current_data(self.current_module)
        )

        # 显示预览
        yield {
            "type": "content_preview",
            "content": optimized_content,
            "message": "这是为您生成的内容，您觉得怎么样？",
            "role": "assistant"
        }

        # 更新简历（假设用户已确认）
        yield from self._update_resume_field(optimized_content)

    def _update_resume_field(self, content: str) -> Generator[Dict[str, Any], None, None]:
        """
        更新简历字段（使用继承的 executor）

        Args:
            content: 要更新的内容

        Yields:
            Dict: 流式响应
        """

        try:
            # 确定更新路径和操作类型
            path = self._get_module_path(self.current_module)
            module = self.current_module

            # 根据模块类型决定操作方式
            if module == "summary":
                # 个人总结：直接更新 summary 字段
                result = self.executor.execute_update("summary", content)
            elif module == "skills":
                # 技能：更新 skills 字段
                result = self.executor.execute_update("skills", content)
            elif module == "experience":
                # 工作经历：如果是空列表，添加；否则更新第一条
                work_list = self.resume_data.get("workExperience", [])
                if not work_list:
                    # 添加新工作经历（需要完整对象）
                    # 这里简单处理，将内容作为 description
                    work_item = {
                        "company": "待填写",
                        "position": "待填写",
                        "startDate": "",
                        "endDate": "",
                        "description": content
                    }
                    result = self.executor.execute_add("workExperience", work_item)
                else:
                    # 更新第一条的 description
                    result = self.executor.execute_update("workExperience[0].description", content)
            elif module == "projects":
                # 项目经历：类似工作经历
                project_list = self.resume_data.get("projects", [])
                if not project_list:
                    project_item = {
                        "name": "待填写",
                        "description": content,
                        "role": "",
                        "startDate": "",
                        "endDate": ""
                    }
                    result = self.executor.execute_add("projects", project_item)
                else:
                    result = self.executor.execute_update("projects[0].description", content)
            elif module == "education":
                # 教育经历：类似处理
                edu_list = self.resume_data.get("education", [])
                if not edu_list:
                    edu_item = {
                        "school": "待填写",
                        "major": "待填写",
                        "degree": "",
                        "startDate": "",
                        "endDate": ""
                    }
                    result = self.executor.execute_add("education", edu_item)
                else:
                    result = self.executor.execute_update("education[0].summary", content)
            else:
                # 默认处理
                result = self.executor.execute_update(path, content)

            if result.success:
                # 更新内部简历数据
                if result.updated_resume:
                    self.state.update_resume(result.updated_resume)
                    self.resume_data = result.updated_resume

                yield {
                    "type": "update_success",
                    "content": content,
                    "path": path,
                    "message": "✅ 已更新简历！",
                    "role": "assistant",
                    "resume_data": self.resume_data,
                    "resume_modified": True
                }

                # 生成下一步建议（使用 LLM）
                yield from self._generate_next_step_llm(self.current_module)

            else:
                yield {
                    "type": "error",
                    "content": f"更新失败: {result.error or '未知错误'}",
                    "role": "assistant"
                }

            # 清理状态
            self.collected_info = []
            self.is_followup_mode = False

        except Exception as e:
            logger.error(f"更新简历失败: {str(e)}")
            yield {
                "type": "error",
                "content": f"更新失败: {str(e)}",
                "role": "assistant"
            }

    def _generate_next_step_llm(self, completed_module: str) -> Generator[Dict[str, Any], None, None]:
        """
        使用 LLM 生成下一步建议

        Args:
            completed_module: 已完成的模块

        Yields:
            Dict: 流式响应
        """
        # 简化版：返回默认建议
        completed_name = self.MODULE_NAMES.get(completed_module, completed_module)

        # 基于诊断报告生成建议
        remaining_modules = [m for m in ["summary", "experience", "projects", "education", "skills"]
                            if m != completed_module]

        if remaining_modules:
            next_module = remaining_modules[0]
            next_name = self.MODULE_NAMES.get(next_module, next_module)
            message = f"✅ {completed_name} 已优化完成！接下来想优化{next_name}吗？"
        else:
            message = "✅ 所有模块都已优化完成！简历看起来不错了！"

        yield {
            "type": "text",
            "content": message,
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

        # 检查是否是"按照我的专业建议"选项
        if "按照我的专业建议" in message or "从最重要的模块开始" in message:
            # 自动选择最高优先级的模块（个人总结）
            self._auto_selected_module = "summary"
            return "optimize_module"

        # 检查诊断意图
        if any(word in message for word in diagnosis_keywords):
            return "diagnose"

        # 检查优化模块意图
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

        # 先检查是否有自动选择的模块
        if hasattr(self, '_auto_selected_module'):
            module = self._auto_selected_module
            delattr(self, '_auto_selected_module')
            return module

        module_mapping = {
            "个人总结": "summary",
            "总结": "summary",
            "工作经历": "experience",
            "工作/实习经历": "experience",
            "实习经历": "experience",
            "实习": "experience",
            "项目经历": "projects",
            "项目": "projects",
            "教育经历": "education",
            "教育": "education",
            "技能": "skills",
            "基本信息": "basic"
        }

        # 先检查完整的关键词匹配
        for keyword, module in module_mapping.items():
            if keyword in message:
                return module

        # 特殊处理：处理"工作/实习经历：xxx"这种格式
        if "工作/实习经历" in message or "工作经历" in message or "实习经历" in message:
            return "experience"
        if "个人总结" in message or "总结" in message:
            return "summary"
        if "项目经历" in message or "项目" in message:
            return "projects"
        if "教育经历" in message or "教育" in message:
            return "education"
        if "技能" in message:
            return "skills"
        if "基本信息" in message or "headline" in message:
            return "basic"

        return "unknown"

    def _get_module_path(self, module: str) -> str:
        """获取模块的数据路径"""

        path_mapping = {
            "summary": "summary",
            "experience": "workExperience",
            "projects": "projects",
            "education": "education",
            "skills": "skills",
            "basic": "basic"
        }

        return path_mapping.get(module, "summary")

    # ========================================================================
    # LLM 集成方法（动态生成内容，避免硬编码）
    # ========================================================================

    def _get_module_current_data(self, module: str) -> str:
        """获取模块当前数据（用于 LLM 上下文）"""
        if not self.resume_data:
            return ""

        module_map = {
            "summary": ("summary",),
            "experience": ("workExperience",),
            "projects": ("projects",),
            "education": ("education",),
            "skills": ("skills",),
            "basic": ("basic",)
        }

        keys = module_map.get(module, ())
        for key in keys:
            data = self.resume_data.get(key)
            if data:
                if isinstance(data, list):
                    return json.dumps(data, ensure_ascii=False)
                elif isinstance(data, dict):
                    return json.dumps(data, ensure_ascii=False)
                else:
                    return str(data)
        return ""

    def _generate_optimized_content_llm(
        self,
        module: str,
        collected_info: List[str],
        current_data: str
    ) -> Generator[Dict[str, Any], None, None]:
        """
        使用 LLM 生成优化后的简历内容

        Args:
            module: 模块名称
            collected_info: 用户已提供的信息
            current_data: 当前简历数据

        Yields:
            Dict: 包含生成内容的响应
        """
        if not self.llm_api_key:
            # 如果没有 LLM，使用简单处理
            combined_info = "\n".join(collected_info)
            yield {
                "type": "generated_content",
                "content": combined_info
            }
            return

        # 构建提示词
        module_name = self.MODULE_NAMES.get(module, module)
        user_prompt = f"""请帮我优化简历的【{module_name}】部分。

用户已提供的信息：
{chr(10).join(f'- {info}' for info in collected_info)}

当前简历中的{module_name}：
{current_data if current_data else '(空白)'}

请根据用户提供的信息，生成优化后的{module_name}内容。
要求：
1. 基于用户提供的信息，不编造不存在的内容
2. 使用 STAR 法则组织内容（适用于经历类）
3. 突出成果和量化指标
4. 使用专业但简洁的语言
5. 长内容使用 HTML 格式（<ul><li>...</li></ul>）

直接输出优化后的内容，不要解释。"""

        try:
            # 调用 LLM API
            headers = {
                "Authorization": f"Bearer {self.llm_api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": self.llm_model,
                "messages": [
                    {"role": "system", "content": OPTIMIZATION_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.7,
            }

            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.llm_base_url}/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                result = response.json()

            # 提取生成的内容
            content = result["choices"][0]["message"]["content"].strip()

            # 移除可能的 markdown 代码块标记
            if content.startswith("```"):
                lines = content.split("\n")
                if lines[0].startswith("```html"):
                    content = "\n".join(lines[1:-1])
                elif lines[0].startswith("```"):
                    content = "\n".join(lines[1:-1])

            yield {
                "type": "generated_content",
                "content": content
            }

        except Exception as e:
            logger.error(f"LLM 生成内容失败: {str(e)}")
            # 降级：使用用户输入
            yield {
                "type": "generated_content",
                "content": "\n".join(collected_info)
            }

    def _generate_followup_question_llm(
        self,
        module: str,
        collected_info: List[str],
        current_data: str
    ) -> Generator[Dict[str, Any], None, None]:
        """
        使用 LLM 生成追问问题

        Args:
            module: 模块名称
            collected_info: 用户已提供的信息
            current_data: 当前简历数据

        Yields:
            Dict: 包含追问问题的响应
        """
        if not self.llm_api_key:
            # 如果没有 LLM，返回默认追问
            yield {
                "type": "followup_question",
                "content": None  # 表示不需要追问
            }
            return

        # 构建提示词
        module_name = self.MODULE_NAMES.get(module, module)
        user_prompt = f"""用户正在完善简历的【{module_name}】部分。

已收集的信息：
{chr(10).join(f'- {info}' for info in collected_info)}

当前简历中的{module_name}：
{current_data if current_data else '(空白)'}

请判断是否还需要追问更多信息。如果信息已足够完善，返回 null。
如果需要追问，提出一个具体的问题。

输出格式：
- 需要追问：直接输出问题文本
- 不需要追问：输出 null"""

        try:
            # 调用 LLM API
            headers = {
                "Authorization": f"Bearer {self.llm_api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": self.llm_model,
                "messages": [
                    {"role": "system", "content": FOLLOWUP_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.3,
            }

            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.llm_base_url}/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                result = response.json()

            # 提取生成的内容
            content = result["choices"][0]["message"]["content"].strip()

            # 检查是否是 null（表示不需要追问）
            if content.lower() in ["null", "无", "不需要", "无需追问"]:
                yield {
                    "type": "followup_question",
                    "content": None
                }
            else:
                yield {
                    "type": "followup_question",
                    "content": content
                }

        except Exception as e:
            logger.error(f"LLM 生成追问失败: {str(e)}")
            # 降级：不追问
            yield {
                "type": "followup_question",
                "content": None
            }
