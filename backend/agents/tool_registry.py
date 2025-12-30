"""
ToolRegistry - 工具注册表

管理所有可用的工具，提供：
- 工具注册
- 工具查询
- 工具元信息
"""
from typing import Any, Callable, Dict, List, Optional, Type
from dataclasses import dataclass, field


@dataclass
class ToolInfo:
    """工具信息"""
    name: str
    handler: Any  # 工具类或函数
    description: str
    params: List[str]
    required_params: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "params": self.params,
            "required_params": self.required_params
        }


class ToolRegistry:
    """
    工具注册表
    
    功能：
    1. 注册和管理所有可用工具
    2. 提供工具元信息
    3. 支持动态添加工具
    """
    
    _instance = None
    _tools: Dict[str, ToolInfo] = {}
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tools = {}
        return cls._instance
    
    def register(
        self,
        name: str,
        handler: Any,
        description: str,
        params: List[str],
        required_params: List[str] = None
    ) -> None:
        """
        注册工具
        
        Args:
            name: 工具名称
            handler: 工具处理器（类或函数）
            description: 工具描述
            params: 参数列表
            required_params: 必填参数列表
        """
        self._tools[name] = ToolInfo(
            name=name,
            handler=handler,
            description=description,
            params=params,
            required_params=required_params or []
        )
    
    def get(self, name: str) -> Optional[ToolInfo]:
        """获取工具信息"""
        return self._tools.get(name)
    
    def get_handler(self, name: str) -> Optional[Any]:
        """获取工具处理器"""
        tool = self._tools.get(name)
        return tool.handler if tool else None
    
    def has(self, name: str) -> bool:
        """检查工具是否存在"""
        return name in self._tools
    
    def list_tools(self) -> List[str]:
        """列出所有工具名称"""
        return list(self._tools.keys())
    
    def get_all_info(self) -> List[Dict[str, Any]]:
        """获取所有工具信息"""
        return [tool.to_dict() for tool in self._tools.values()]
    
    def get_tools_for_llm(self) -> str:
        """获取适合 LLM 的工具描述"""
        descriptions = []
        for tool in self._tools.values():
            params_str = ", ".join(tool.params)
            descriptions.append(f"- {tool.name}({params_str}): {tool.description}")
        return "\n".join(descriptions)
    
    def clear(self) -> None:
        """清空所有工具（主要用于测试）"""
        self._tools = {}


# 全局注册表实例
tool_registry = ToolRegistry()


def register_tool(
    name: str,
    description: str,
    params: List[str],
    required_params: List[str] = None
):
    """
    装饰器：注册工具
    
    使用方式：
    @register_tool("CVReader", "读取简历数据", ["path"])
    class CVReader:
        ...
    """
    def decorator(cls):
        tool_registry.register(
            name=name,
            handler=cls,
            description=description,
            params=params,
            required_params=required_params
        )
        return cls
    return decorator


def setup_default_tools():
    """注册默认工具"""
    from .tools.cv_reader import CVReaderTool
    from .tools.cv_editor import CVEditorTool
    
    # 注册 CVReader
    tool_registry.register(
        name="CVReader",
        handler=CVReaderTool,
        description="读取简历数据，支持读取整个简历或指定路径的数据",
        params=["path"],
        required_params=["path"]
    )
    
    # 注册 CVEditor
    tool_registry.register(
        name="CVEditor",
        handler=CVEditorTool,
        description="编辑简历数据，支持添加、更新、删除操作",
        params=["path", "action", "value"],
        required_params=["path", "action"]
    )

