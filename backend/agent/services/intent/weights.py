"""
Intent Score Weights - 意图识别评分权重配置

参考 Sophia-Pro 的评分权重系统，用于规则匹配时的分数计算。
"""

from dataclasses import dataclass


@dataclass
class IntentScoreWeights:
    """评分权重配置"""

    keyword_short: float = 0.15  # 短关键词（<6字符）
    keyword_long: float = 0.2    # 长关键词（>=6字符）
    keyword_max: float = 0.45    # 关键词匹配最高分
    pattern: float = 0.35        # 正则模式匹配
    desc: float = 0.05           # 描述词匹配（每个词）
    desc_max: float = 0.2        # 描述匹配最高分











