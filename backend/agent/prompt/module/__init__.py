"""
模块分析器 Prompt 模板

各模块分析器的提示词模板。
"""

from backend.agent.prompt.module.education_prompt import (
    EDUCATION_ANALYSIS_PROMPT,
    EDUCATION_OPTIMIZATION_PROMPT,
    EDUCATION_SYSTEM_PROMPT,
)

__all__ = [
    "EDUCATION_SYSTEM_PROMPT",
    "EDUCATION_ANALYSIS_PROMPT",
    "EDUCATION_OPTIMIZATION_PROMPT",
]
