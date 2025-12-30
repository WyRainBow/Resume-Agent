"""
ToolRegistry - 工具注册中心

参考架构：sophia-pro/backend/agent/src/amplift/

功能：
1. 动态工具注册和发现
2. 统一的工具管理接口
3. 工具元数据管理
4. 工具版本管理
"""
from typing import Any, Callable, Dict, List, Optional, Type, Union
from dataclasses import dataclass, field
from enum import Enum
import inspect
import logging

logger = logging.getLogger(__name__)


class ToolStatus(str, Enum):
    """工具状态"""
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    EXPERIMENTAL = "experimental"


@dataclass
class ToolMetadata:
    """工具元数据"""
    name: str
    description: str
    version: str = "1.0.0"
    status: ToolStatus = ToolStatus.ACTIVE
    category: str = "general"
    parameters: Dict[str, Any] = field(default_factory=dict)
    examples: List[Dict[str, Any]] = field(default_factory=list)
    author: str = ""
    tags: List[str] = field(default_factory=list)


class ToolRegistry:
    """
    工具注册中心

    提供：
    1. 工具类注册
    2. 工具实例管理
    3. 工具发现和查询
    4. 工具元数据管理

    使用示例:
        @ToolRegistry.register("cv_reader")
        class CVReaderTool(BaseTool):
            pass

        # 或使用工厂函数
        ToolRegistry.register_factory("cv_reader", create_cv_reader)

        # 获取工具
        tool_class = ToolRegistry.get_tool("cv_reader")
        tool_instance = ToolRegistry.create_tool("cv_reader", resume_data=data)
    """

    # 工具类注册表
    _tools: Dict[str, Type] = {}

    # 工具工厂函数注册表
    _factories: Dict[str, Callable] = {}

    # 工具元数据注册表
    _metadata: Dict[str, ToolMetadata] = {}

    # 工具实例缓存（单例模式）
    _instances: Dict[str, Any] = {}

    @classmethod
    def register(
        cls,
        name: str,
        tool_class: Optional[Type] = None,
        metadata: Optional[ToolMetadata] = None,
        replace: bool = False
    ) -> Union[Type, Callable]:
        """
        注册工具类（装饰器或直接调用）

        Args:
            name: 工具名称
            tool_class: 工具类（为 None 时用作装饰器）
            metadata: 工具元数据
            replace: 是否替换已存在的工具

        Returns:
            装饰器函数或工具类本身
        """
        def decorator(cls_: Type) -> Type:
            if name in cls._tools and not replace:
                logger.warning(f"工具 '{name}' 已存在，使用 replace=True 来替换")
                return cls_

            cls._tools[name] = cls_
            if metadata:
                cls._metadata[name] = metadata
            else:
                # 自动生成元数据
                cls._metadata[name] = cls._generate_metadata(name, cls_)

            logger.info(f"注册工具: {name} -> {cls_.__name__}")
            return cls_

        if tool_class is not None:
            return decorator(tool_class)
        return decorator

    @classmethod
    def register_factory(
        cls,
        name: str,
        factory: Callable,
        metadata: Optional[ToolMetadata] = None
    ) -> None:
        """
        注册工具工厂函数

        Args:
            name: 工具名称
            factory: 工厂函数
            metadata: 工具元数据
        """
        cls._factories[name] = factory
        if metadata:
            cls._metadata[name] = metadata
        logger.info(f"注册工具工厂: {name}")

    @classmethod
    def get_tool(cls, name: str) -> Optional[Type]:
        """
        获取工具类

        Args:
            name: 工具名称

        Returns:
            工具类或 None
        """
        return cls._tools.get(name)

    @classmethod
    def get_factory(cls, name: str) -> Optional[Callable]:
        """
        获取工具工厂函数

        Args:
            name: 工具名称

        Returns:
            工厂函数或 None
        """
        return cls._factories.get(name)

    @classmethod
    def create_tool(
        cls,
        name: str,
        **kwargs
    ) -> Optional[Any]:
        """
        创建工具实例

        优先使用工厂函数，其次使用工具类

        Args:
            name: 工具名称
            **kwargs: 工具构造参数

        Returns:
            工具实例或 None
        """
        # 先检查工厂函数
        factory = cls.get_factory(name)
        if factory:
            try:
                return factory(**kwargs)
            except Exception as e:
                logger.error(f"工厂函数创建工具失败: {name}, 错误: {e}")
                return None

        # 检查工具类
        tool_class = cls.get_tool(name)
        if tool_class:
            try:
                return tool_class(**kwargs)
            except Exception as e:
                logger.error(f"工具类创建实例失败: {name}, 错误: {e}")
                return None

        logger.warning(f"工具不存在: {name}")
        return None

    @classmethod
    def get_or_create_instance(
        cls,
        name: str,
        **kwargs
    ) -> Optional[Any]:
        """
        获取或创建工具实例（单例模式）

        Args:
            name: 工具名称
            **kwargs: 工具构造参数（仅首次创建时使用）

        Returns:
            工具实例
        """
        if name in cls._instances:
            return cls._instances[name]

        instance = cls.create_tool(name, **kwargs)
        if instance:
            cls._instances[name] = instance
        return instance

    @classmethod
    def list_tools(cls, status: Optional[ToolStatus] = None) -> List[str]:
        """
        列出所有工具名称

        Args:
            status: 过滤状态（可选）

        Returns:
            工具名称列表
        """
        if status is None:
            return list(cls._tools.keys()) + list(cls._factories.keys())

        result = []
        for name, meta in cls._metadata.items():
            if meta.status == status:
                result.append(name)
        return result

    @classmethod
    def get_metadata(cls, name: str) -> Optional[ToolMetadata]:
        """
        获取工具元数据

        Args:
            name: 工具名称

        Returns:
            工具元数据或 None
        """
        return cls._metadata.get(name)

    @classmethod
    def get_all_metadata(cls) -> Dict[str, ToolMetadata]:
        """
        获取所有工具元数据

        Returns:
            工具元数据字典
        """
        return cls._metadata.copy()

    @classmethod
    def exists(cls, name: str) -> bool:
        """
        检查工具是否存在

        Args:
            name: 工具名称

        Returns:
            是否存在
        """
        return name in cls._tools or name in cls._factories

    @classmethod
    def unregister(cls, name: str) -> bool:
        """
        注销工具

        Args:
            name: 工具名称

        Returns:
            是否成功
        """
        success = False

        if name in cls._tools:
            del cls._tools[name]
            success = True

        if name in cls._factories:
            del cls._factories[name]
            success = True

        if name in cls._metadata:
            del cls._metadata[name]
            success = True

        if name in cls._instances:
            del cls._instances[name]

        if success:
            logger.info(f"注销工具: {name}")

        return success

    @classmethod
    def clear_cache(cls) -> None:
        """清空实例缓存"""
        cls._instances.clear()
        logger.info("清空工具实例缓存")

    @classmethod
    def _generate_metadata(cls, name: str, tool_class: Type) -> ToolMetadata:
        """
        从工具类自动生成元数据

        Args:
            name: 工具名称
            tool_class: 工具类

        Returns:
            工具元数据
        """
        # 尝试从类属性获取
        description = getattr(tool_class, "__doc__", "")
        description = getattr(tool_class, "description", description)

        # 尝试获取参数定义
        parameters = {}
        if hasattr(tool_class, "args_schema"):
            schema = tool_class.args_schema
            if hasattr(schema, "model_fields"):
                parameters = {
                    name: {
                        "type": field.annotation.__name__ if hasattr(field.annotation, "__name__") else str(field.annotation),
                        "description": field.description or "",
                        "required": field.is_required(),
                        "default": field.default
                    }
                    for name, field in schema.model_fields.items()
                }

        return ToolMetadata(
            name=name,
            description=description,
            version=getattr(tool_class, "version", "1.0.0"),
            status=getattr(tool_class, "status", ToolStatus.ACTIVE),
            category=getattr(tool_class, "category", "general"),
            parameters=parameters
        )

    @classmethod
    def to_function_definitions(cls) -> List[Dict[str, Any]]:
        """
        生成 OpenAI Function Calling 格式的定义

        Returns:
            函数定义列表
        """
        definitions = []

        for name, tool_class in cls._tools.items():
            if hasattr(tool_class, "to_function_definition"):
                definitions.append(tool_class.to_function_definition())
            elif hasattr(tool_class, "FUNCTION_DEF"):
                definitions.append(tool_class.FUNCTION_DEF)

        return definitions


# 便捷装饰器
def register_tool(
    name: str,
    description: str = "",
    category: str = "general",
    version: str = "1.0.0"
):
    """
    工具注册装饰器

    使用示例:
        @register_tool("cv_reader", description="读取简历数据", category="cv")
        class CVReaderTool(BaseTool):
            pass
    """
    metadata = ToolMetadata(
        name=name,
        description=description,
        version=version,
        category=category
    )
    return ToolRegistry.register(name, metadata=metadata)
