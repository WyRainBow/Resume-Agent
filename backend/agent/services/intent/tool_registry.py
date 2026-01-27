"""
Tool Registry - 工具注册中心

混合方案：
1. 自动从 ToolCollection 发现工具
2. 从 YAML 配置文件加载意图识别配置（覆盖自动发现）
3. 自动提取关键词（如果没有显式配置）

参考 SkillRegistry 实现。
"""

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, FrozenSet, List, Optional

import yaml

from backend.core.logger import get_logger

logger = get_logger(__name__)
from backend.agent.tool.base import BaseTool
from backend.agent.tool.tool_collection import ToolCollection

# 中文停用词表（用于自动提取关键词时过滤）
CHINESE_STOP_WORDS: FrozenSet[str] = frozenset({
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个",
    "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好",
    "自己", "这", "那", "可以", "能", "用", "工具", "使用", "帮助", "进行", "完成",
})

# 英文停用词表
ENGLISH_STOP_WORDS: FrozenSet[str] = frozenset({
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "to", "of", "in", "for", "on", "with",
    "at", "by", "from", "as", "this", "that", "these", "those", "which",
    "who", "what", "you", "use", "used", "using", "tool", "agent",
})


@dataclass
class ToolMetadata:
    """工具元数据"""

    name: str
    description: str
    # 触发关键词（从配置文件或自动提取）
    trigger_keywords: List[str] = field(default_factory=list)
    # 正则匹配模式
    patterns: List[str] = field(default_factory=list)
    # 示例 queries
    example_queries: List[str] = field(default_factory=list)
    # 优先级权重 (1.0 为默认)
    priority: float = 1.0
    # 是否有显式配置（用于判断是否需要自动生成 keywords）
    has_explicit_config: bool = False


class ToolRegistry:
    """
    工具注册中心 - 单例模式

    负责：
    1. 从 ToolCollection 自动发现工具
    2. 从配置文件加载意图识别配置
    3. 提供工具查询接口
    """

    _instance: Optional["ToolRegistry"] = None
    _tools: Dict[str, ToolMetadata] = {}
    _initialized: bool = False

    def __new__(cls) -> "ToolRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, tool_collection: Optional[ToolCollection] = None) -> None:
        if not self._initialized:
            self._tool_collection = tool_collection
            self._load_tools()
            self._initialized = True

    def _get_configs_directory(self) -> Path:
        """获取配置文件目录路径"""
        current_file = Path(__file__).resolve()
        configs_dir = current_file.parent / "configs"
        return configs_dir

    def _load_tools(self) -> None:
        """加载所有工具的元数据（混合方案）"""
        # 1. 从 ToolCollection 自动发现工具
        if self._tool_collection:
            for tool in self._tool_collection.tools:
                metadata = self._create_metadata_from_tool(tool)
                if metadata:
                    self._tools[metadata.name] = metadata
                    logger.debug(f"自动发现工具: {metadata.name}")

        # 2. 尝试加载配置文件（覆盖自动发现）
        configs_dir = self._get_configs_directory()
        if configs_dir.exists():
            for config_file in configs_dir.glob("*.yaml"):
                self._load_config_file(config_file)

        logger.info(f"工具注册表加载完成: {len(self._tools)} 个工具")

    def _create_metadata_from_tool(self, tool: BaseTool) -> Optional[ToolMetadata]:
        """从工具实例创建元数据"""
        if not hasattr(tool, 'name') or not hasattr(tool, 'description'):
            return None

        metadata = ToolMetadata(
            name=tool.name,
            description=tool.description or "",
        )

        # 自动提取关键词（如果没有显式配置）
        if not metadata.trigger_keywords:
            metadata.trigger_keywords = self._extract_keywords_from_description(
                tool.name, tool.description or ""
            )
            metadata.priority = 0.8  # 自动提取的优先级稍低

        return metadata

    def _extract_keywords_from_description(self, name: str, description: str) -> List[str]:
        """
        从工具名称和描述中自动提取关键词

        策略：
        1. 使用工具名称（用下划线/连字符分割）
        2. 提取描述中的重要词汇（过滤停用词）
        """
        keywords: List[str] = []

        # 1. 从工具名称提取
        name_parts = name.replace("-", "_").replace("_", " ").split()
        keywords.extend([p.lower() for p in name_parts if len(p) > 2])

        # 2. 从描述提取重要词汇
        # 处理中英文混合
        # 提取中文词汇（2-4字）
        chinese_words = re.findall(r'[\u4e00-\u9fff]{2,4}', description)
        for word in chinese_words:
            if word not in CHINESE_STOP_WORDS and word not in keywords:
                keywords.append(word)

        # 提取英文词汇（3字符以上）
        english_words = re.findall(r'\b[a-zA-Z]{3,}\b', description.lower())
        for word in english_words:
            if word not in ENGLISH_STOP_WORDS and word not in keywords:
                keywords.append(word)

        # 最多返回 10 个关键词
        return keywords[:10]

    def _load_config_file(self, config_path: Path) -> None:
        """从 YAML 配置文件加载工具意图配置"""
        try:
            content = config_path.read_text(encoding="utf-8")
            data = yaml.safe_load(content)

            if not data or not isinstance(data, dict):
                logger.warning(f"配置文件格式无效: {config_path}")
                return

            tool_name = data.get("name", "")
            if not tool_name:
                logger.warning(f"配置文件缺少 name 字段: {config_path}")
                return

            # 如果工具已存在，更新元数据；否则创建新的
            if tool_name in self._tools:
                metadata = self._tools[tool_name]
            else:
                metadata = ToolMetadata(name=tool_name, description="")
                self._tools[tool_name] = metadata

            # 加载配置（覆盖自动发现的结果）
            if "keywords" in data:
                metadata.trigger_keywords = self._normalize_keywords(data.get("keywords", []))
            if "patterns" in data:
                metadata.patterns = data.get("patterns", [])
            if "examples" in data:
                metadata.example_queries = data.get("examples", [])
            if "priority" in data and data["priority"] is not None:
                metadata.priority = float(data["priority"])

            metadata.has_explicit_config = True
            logger.debug(f"从配置文件加载: {tool_name} ({config_path.name})")

        except yaml.YAMLError as e:
            logger.warning(f"YAML 解析错误 {config_path}: {e}")
        except Exception as e:
            logger.warning(f"加载配置文件失败 {config_path}: {e}")

    def _normalize_keywords(self, keywords: List[str]) -> List[str]:
        """标准化关键词：去除空白并统一小写"""
        normalized = []
        seen = set()
        for kw in keywords:
            if not isinstance(kw, str):
                continue
            cleaned = kw.strip().lower()
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            normalized.append(cleaned)
        return normalized

    def get_all_tools(self) -> Dict[str, ToolMetadata]:
        """获取所有工具"""
        return self._tools.copy()

    def get_tool(self, name: str) -> Optional[ToolMetadata]:
        """获取指定工具"""
        return self._tools.get(name)

    def get_tools_summary(self) -> str:
        """获取所有工具的摘要描述，用于 LLM 意图分类"""
        summaries = []
        for name, tool in sorted(self._tools.items()):
            keywords = ", ".join(tool.trigger_keywords[:5]) if tool.trigger_keywords else ""
            summary = f"- **{name}**: {tool.description}"
            if keywords:
                summary += f" (keywords: {keywords})"
            summaries.append(summary)
        return "\n".join(summaries)

    def reload(self) -> None:
        """重新加载工具（用于开发时热更新）"""
        self._tools.clear()
        self._load_tools()
        logger.info("工具注册表已重新加载")


# 全局单例访问
def get_tool_registry(tool_collection: Optional[ToolCollection] = None) -> ToolRegistry:
    """获取 ToolRegistry 单例"""
    if ToolRegistry._instance is None:
        return ToolRegistry(tool_collection)
    return ToolRegistry._instance











