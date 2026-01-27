"""
Rule Matcher - 规则匹配器

基于规则的快速匹配，用于意图识别的第一阶段。

匹配策略：
1. 关键词匹配（短/长关键词不同权重）
2. 正则模式匹配
3. 描述相似度匹配
4. 应用优先级权重

参考规则匹配实现。
"""

import re
from typing import List, Tuple

from backend.core.logger import get_logger

logger = get_logger(__name__)
from backend.agent.services.intent.tool_registry import ToolRegistry, ToolMetadata
from backend.agent.services.intent.weights import IntentScoreWeights


class RuleMatcher:
    """规则匹配器"""

    def __init__(
        self,
        registry: ToolRegistry,
        weights: IntentScoreWeights = None,
        min_confidence: float = 0.3
    ):
        """
        初始化规则匹配器

        Args:
            registry: 工具注册表
            weights: 评分权重配置
            min_confidence: 最低置信度阈值
        """
        self.registry = registry
        self.weights = weights or IntentScoreWeights()
        self.min_confidence = min_confidence

    def match(self, query: str) -> List[Tuple[str, float]]:
        """
        基于规则匹配工具

        Args:
            query: 用户输入

        Returns:
            List[(tool_name, confidence)]: 按置信度排序的匹配结果（最多3个）
        """
        query_lower = query.lower()
        matches: List[Tuple[str, float]] = []

        for tool_name, tool in self.registry.get_all_tools().items():
            score = 0.0

            # 1. 关键词匹配
            for kw in tool.trigger_keywords:
                kw_clean = kw.strip().lower()
                if kw_clean and kw_clean in query_lower:
                    if len(kw_clean) >= 6:
                        score += self.weights.keyword_long
                    else:
                        score += self.weights.keyword_short

            score = min(score, self.weights.keyword_max)

            # 2. 正则模式匹配
            for pattern in tool.patterns:
                try:
                    if re.search(pattern, query_lower, re.IGNORECASE):
                        score += self.weights.pattern
                        break  # 只计算一次
                except re.error as e:
                    logger.warning(f"正则表达式错误 {pattern}: {e}")
                    continue

            # 3. 描述相似度（简单词匹配）
            desc_words = [w for w in tool.description.lower().split() if len(w) > 3]
            desc_hits = sum(1 for w in desc_words if w in query_lower)
            if desc_hits > 0:
                score += min(
                    self.weights.desc_max,
                    desc_hits * self.weights.desc
                )

            # 4. 应用优先级权重
            score *= tool.priority

            # 过滤低分
            if score >= self.min_confidence:
                matches.append((tool_name, min(1.0, score)))

        # 按置信度排序
        matches.sort(key=lambda x: x[1], reverse=True)

        # 最多返回 3 个
        return matches[:3]











