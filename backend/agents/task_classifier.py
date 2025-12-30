"""
TaskClassifier - 任务复杂度分类器

根据用户输入的特征，判断使用 Function Calling 还是 ReAct 模式。

分类逻辑：
1. 简单任务 → Function Calling（更快）
2. 复杂任务 → ReAct（更强推理能力）
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional


class ExecutionMode(str, Enum):
    """执行模式"""
    FUNCTION_CALLING = "function_calling"  # 快速路径
    REACT = "react"                        # 推理路径
    AUTO = "auto"                          # 自动选择


class TaskComplexity(str, Enum):
    """任务复杂度"""
    SIMPLE = "simple"       # 单步操作
    MEDIUM = "medium"       # 多步操作
    COMPLEX = "complex"     # 需要推理规划


@dataclass
class ClassificationResult:
    """分类结果"""
    mode: ExecutionMode
    complexity: TaskComplexity
    confidence: float  # 0-1
    reason: str


class TaskClassifier:
    """
    任务复杂度分类器

    根据用户输入的特征，决定使用哪种执行模式。
    """

    # 简单任务关键词（单步操作）
    SIMPLE_TASK_KEYWORDS = [
        "查看", "读取", "显示", "看看", "有什么",
        "名字", "姓名", "电话", "邮箱", "职位",
        "改", "修改", "更新", "换成", "变成",
        "删除", "移除",
    ]

    # 简单操作模式（正则）
    SIMPLE_PATTERNS = [
        r"^把\s*(.+?)\s*改成\s*(.+)$",  # "把名字改成张三"
        r"^修改\s*(.+?)\s*为\s*(.+)$",   # "修改姓名为张三"
        r"^删除\s*(.+)$",                # "删除第一条工作经历"
        r"^查看\s*(.+)$",                # "查看教育经历"
        r"^读取\s*(.+)$",                # "读取基本信息"
    ]

    # 复杂任务关键词（需要推理）
    COMPLEX_TASK_KEYWORDS = [
        "优化", "改进", "完善", "提升", "增强",
        "分析", "评估", "检查", "诊断",
        "建议", "推荐", "指导",
        "批量", "全部", "所有", "整份",
        "重新", "重构", "调整",
    ]

    # 多步骤任务关键词
    MULTI_STEP_KEYWORDS = [
        "先.*然后", "首先.*其次", "再.*还",
        "同时", "一起", "分别",
        "并且", "而且", "另外",
    ]

    # 模糊任务（需要更多信息）
    AMBIGUOUS_KEYWORDS = [
        "添加", "新增", "增加",
        "工作经历", "教育经历", "项目",
    ]

    @classmethod
    def classify(
        cls,
        user_message: str,
        resume_data: Optional[dict] = None
    ) -> ClassificationResult:
        """
        分类用户任务

        Args:
            user_message: 用户输入
            resume_data: 当前简历数据（可选，用于辅助判断）

        Returns:
            分类结果
        """
        message = user_message.strip()
        message_lower = message.lower()

        # 检查是否是简单操作
        simple_result = cls._check_simple_task(message, message_lower)
        if simple_result:
            return simple_result

        # 检查是否是复杂操作
        complex_result = cls._check_complex_task(message, message_lower)
        if complex_result:
            return complex_result

        # 检查是否是多步骤操作
        multi_result = cls._check_multi_step_task(message, message_lower)
        if multi_result:
            return multi_result

        # 检查是否是模糊任务（可能需要澄清）
        ambiguous_result = cls._check_ambiguous_task(message, message_lower)
        if ambiguous_result:
            return ambiguous_result

        # 默认：中等复杂度，优先 Function Calling
        return ClassificationResult(
            mode=ExecutionMode.FUNCTION_CALLING,
            complexity=TaskComplexity.MEDIUM,
            confidence=0.5,
            reason="默认模式"
        )

    @classmethod
    def _check_simple_task(
        cls,
        message: str,
        message_lower: str
    ) -> Optional[ClassificationResult]:
        """检查是否是简单任务"""

        # 检查简单关键词
        for keyword in cls.SIMPLE_TASK_KEYWORDS:
            if keyword in message:
                # 确保不是复杂任务
                if not any(kw in message for kw in cls.COMPLEX_TASK_KEYWORDS):
                    return ClassificationResult(
                        mode=ExecutionMode.FUNCTION_CALLING,
                        complexity=TaskComplexity.SIMPLE,
                        confidence=0.9,
                        reason=f"包含简单操作关键词: {keyword}"
                    )

        # 检查简单模式
        for pattern in cls.SIMPLE_PATTERNS:
            if re.search(pattern, message):
                return ClassificationResult(
                    mode=ExecutionMode.FUNCTION_CALLING,
                    complexity=TaskComplexity.SIMPLE,
                    confidence=0.95,
                    reason=f"匹配简单操作模式: {pattern[:20]}..."
                )

        # 检查打招呼等简单对话
        greetings = ["你好", "hello", "hi", "您好", "在吗", "在"]
        if message_lower in greetings or any(g in message_lower for g in greetings if len(message) < 10):
            return ClassificationResult(
                mode=ExecutionMode.FUNCTION_CALLING,
                complexity=TaskComplexity.SIMPLE,
                confidence=1.0,
                reason="打招呼/简单对话"
            )

        return None

    @classmethod
    def _check_complex_task(
        cls,
        message: str,
        message_lower: str
    ) -> Optional[ClassificationResult]:
        """检查是否是复杂任务"""

        # 检查复杂关键词
        complex_keywords_found = []
        for keyword in cls.COMPLEX_TASK_KEYWORDS:
            if keyword in message:
                complex_keywords_found.append(keyword)

        if complex_keywords_found:
            return ClassificationResult(
                mode=ExecutionMode.REACT,
                complexity=TaskComplexity.COMPLEX,
                confidence=0.8 + len(complex_keywords_found) * 0.05,
                reason=f"包含复杂任务关键词: {', '.join(complex_keywords_found)}"
            )

        # 检查长输入（可能包含复杂描述）
        if len(message) > 150:
            return ClassificationResult(
                mode=ExecutionMode.REACT,
                complexity=TaskComplexity.MEDIUM,
                confidence=0.7,
                reason=f"长输入({len(message)}字符)，可能需要推理"
            )

        return None

    @classmethod
    def _check_multi_step_task(
        cls,
        message: str,
        message_lower: str
    ) -> Optional[ClassificationResult]:
        """检查是否是多步骤任务"""

        # 检查多步骤关键词
        for pattern in cls.MULTI_STEP_KEYWORDS:
            if re.search(pattern, message):
                return ClassificationResult(
                    mode=ExecutionMode.REACT,
                    complexity=TaskComplexity.MEDIUM,
                    confidence=0.85,
                    reason=f"检测到多步骤操作: {pattern[:10]}..."
                )

        # 检查是否包含多个操作（逗号分隔）
        # 例如："把名字改成张三，电话改成123456"
        if "，" in message or "," in message:
            parts = re.split("[,，]", message)
            if len(parts) >= 2:
                # 检查每个部分是否是独立操作
                operation_count = 0
                for part in parts:
                    part = part.strip()
                    if any(kw in part for kw in ["改成", "修改", "更新", "删除", "添加"]):
                        operation_count += 1

                if operation_count >= 2:
                    return ClassificationResult(
                        mode=ExecutionMode.FUNCTION_CALLING,  # 使用 CVBatchEditor
                        complexity=TaskComplexity.MEDIUM,
                        confidence=0.9,
                        reason=f"检测到多个操作: {operation_count}个"
                    )

        return None

    @classmethod
    def _check_ambiguous_task(
        cls,
        message: str,
        message_lower: str
    ) -> Optional[ClassificationResult]:
        """检查是否是模糊任务"""

        # 模糊任务通常需要更多信息，先用 Function Calling 处理
        # 如果需要澄清，LLM 会返回 clarify 消息
        for keyword in cls.AMBIGUOUS_KEYWORDS:
            if keyword in message and len(message) < 30:
                return ClassificationResult(
                    mode=ExecutionMode.FUNCTION_CALLING,
                    complexity=TaskComplexity.MEDIUM,
                    confidence=0.6,
                    reason=f"可能需要补充信息: {keyword}"
                )

        return None

    @classmethod
    def should_use_react(
        cls,
        user_message: str,
        resume_data: Optional[dict] = None
    ) -> bool:
        """
        快速判断是否应该使用 ReAct 模式

        Args:
            user_message: 用户输入
            resume_data: 当前简历数据

        Returns:
            是否使用 ReAct
        """
        result = cls.classify(user_message, resume_data)
        return result.mode == ExecutionMode.REACT

    @classmethod
    def explain_classification(
        cls,
        user_message: str
    ) -> str:
        """
        解释分类结果（用于调试）

        Args:
            user_message: 用户输入

        Returns:
            分类解释字符串
        """
        result = cls.classify(user_message)

        return (
            f"任务: {user_message[:50]}...\n"
            f"模式: {result.mode.value}\n"
            f"复杂度: {result.complexity.value}\n"
            f"置信度: {result.confidence:.2f}\n"
            f"原因: {result.reason}"
        )


# 便捷函数
def classify_task(user_message: str, resume_data: Optional[dict] = None) -> ClassificationResult:
    """分类任务"""
    return TaskClassifier.classify(user_message, resume_data)


def should_use_react(user_message: str, resume_data: Optional[dict] = None) -> bool:
    """判断是否使用 ReAct"""
    return TaskClassifier.should_use_react(user_message, resume_data)
