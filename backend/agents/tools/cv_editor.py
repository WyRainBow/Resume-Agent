"""
CVEditor Tool - LangChain 简历编辑工具

基于 LangChain BaseTool 实现，用于修改、添加或删除简历数据。
"""
from typing import Any, Dict, Optional, Type, Literal
from pydantic import BaseModel, Field, field_validator
from langchain_core.tools import BaseTool
from langchain_core.callbacks import CallbackManagerForToolRun

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from json_path import parse_path, get_by_path, set_by_path


class CVEditorInput(BaseModel):
    """CVEditor 工具的输入参数定义"""
    path: str = Field(
        ...,
        description=(
            "要操作的简历字段的 JSON 路径。"
            "例如: 'basic.name' (修改姓名), 'education[0].school' (修改第一段教育经历的学校), "
            "'education' (向教育经历数组添加新项), 'workExperience[1]' (删除第二段工作经历)。"
        )
    )
    action: Literal["update", "add", "delete"] = Field(
        ...,
        description=(
            "操作类型: "
            "'update' - 修改现有字段的值; "
            "'add' - 向数组添加新元素（path 应指向数组，如 'education'）; "
            "'delete' - 删除字段或数组元素。"
        )
    )
    value: Optional[Any] = Field(
        default=None,
        description=(
            "要设置的新值。'update' 和 'add' 操作必须提供此参数。"
            "对于 'add' 操作，应提供完整的对象，如添加教育经历时提供 {school, major, degree, startDate, endDate}。"
            "对于 'update' 操作，提供要更新的具体值。"
        )
    )
    
    @field_validator('action')
    @classmethod
    def validate_action(cls, v):
        if v not in ["update", "add", "delete"]:
            raise ValueError(f"action 必须是 'update', 'add', 或 'delete'，但收到: {v}")
        return v


class CVEditorTool(BaseTool):
    """
    简历编辑工具
    
    功能：
    - update: 修改指定字段的值
    - add: 向数组添加新元素
    - delete: 删除指定字段或数组元素
    
    使用示例：
    1. 修改姓名: path="basic.name", action="update", value="张三"
    2. 修改第一段教育经历的学校: path="education[0].school", action="update", value="北京大学"
    3. 添加新的教育经历: path="education", action="add", value={school:"清华大学", major:"计算机", ...}
    4. 删除第二段工作经历: path="workExperience[1]", action="delete"
    """
    
    name: str = "CVEditor"
    description: str = (
        "编辑简历数据。支持三种操作: "
        "'update' 修改字段值, 'add' 向数组添加新项, 'delete' 删除字段或数组项。"
        "必须提供 path 和 action 参数。update/add 操作还需要 value 参数。"
    )
    args_schema: Type[BaseModel] = CVEditorInput
    
    # 简历数据引用（由 Agent 注入，会被直接修改）
    resume_data: Dict[str, Any] = Field(default_factory=dict)
    
    def _map_path(self, parts: list) -> list:
        """
        字段路径映射：workExperience <-> experience（兼容前端使用 experience 字段）
        
        Args:
            parts: 解析后的路径部分列表
        
        Returns:
            映射后的路径部分列表
        """
        if not parts or not isinstance(parts[0], str):
            return parts
        
        field_mapping = {
            "workExperience": "experience",
            "experience": "workExperience"
        }
        
        # 如果路径的第一部分是映射字段，尝试映射
        if parts[0] in field_mapping:
            mapped_field = field_mapping[parts[0]]
            mapped_parts = [mapped_field] + parts[1:]
            
            # 优先检查原始路径是否存在
            try:
                get_by_path(self.resume_data, parts)
                # 原始路径存在，使用原始路径
                return parts
            except ValueError:
                # 原始路径不存在，检查映射路径
                try:
                    get_by_path(self.resume_data, mapped_parts)
                    # 映射路径存在，使用映射路径
                    return mapped_parts
                except ValueError:
                    # 两个路径都不存在，优先使用映射路径（用于创建新字段）
                    # 这样确保新创建的数据使用统一的字段名
                    return mapped_parts
        
        return parts
    
    def _run(
        self,
        path: str,
        action: str,
        value: Optional[Any] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None
    ) -> Dict[str, Any]:
        """
        执行编辑操作
        
        Args:
            path: JSON 路径
            action: 操作类型 (update/add/delete)
            value: 新值（update/add 时必需）
            run_manager: LangChain 回调管理器
        
        Returns:
            包含操作结果的字典
        """
        # 参数验证
        if action in ["update", "add"] and value is None:
            return {
                "success": False,
                "message": f"'{action}' 操作需要提供 value 参数",
                "path": path,
                "error_type": "MISSING_PARAM"
            }
        
        try:
            if action == "update":
                return self._update(path, value)
            elif action == "add":
                return self._add(path, value)
            elif action == "delete":
                return self._delete(path)
            else:
                return {
                    "success": False,
                    "message": f"不支持的操作类型: {action}",
                    "path": path,
                    "error_type": "INVALID_ACTION"
                }
                
        except ValueError as e:
            return {
                "success": False,
                "message": f"路径或数据错误: {e}",
                "path": path,
                "error_type": "PATH_ERROR"
            }
        except IndexError as e:
            return {
                "success": False,
                "message": f"索引越界: {e}",
                "path": path,
                "error_type": "INDEX_ERROR"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"编辑失败: {e}",
                "path": path,
                "error_type": "INTERNAL_ERROR"
            }
    
    def _update(self, path: str, value: Any) -> Dict[str, Any]:
        """更新操作"""
        parts = parse_path(path)
        # 应用字段映射
        parts = self._map_path(parts)
        
        # 检查路径中是否包含数组索引
        # 如果路径是 workExperience[0].description，需要确保 workExperience[0] 存在
        for i, part in enumerate(parts):
            if isinstance(part, int):
                # 这是一个数组索引，检查前面的路径是否存在且有足够的元素
                array_path = parts[:i]
                
                # 获取数组
                try:
                    _, _, array = get_by_path(self.resume_data, array_path)
                except ValueError:
                    # 数组路径不存在，需要创建
                    if i == 0:
                        # 根路径不存在，无法创建
                        return {
                            "success": False,
                            "message": f"路径 '{'.'.join(str(p) for p in array_path)}' 不存在，无法更新",
                            "path": path,
                            "error_type": "PATH_NOT_FOUND"
                        }
                    # 创建数组路径
                    set_by_path(self.resume_data, array_path, [])
                    _, _, array = get_by_path(self.resume_data, array_path)
                
                # 确保数组有足够的元素
                if not isinstance(array, list):
                    return {
                        "success": False,
                        "message": f"路径 '{'.'.join(str(p) for p in array_path)}' 不是数组类型",
                        "path": path,
                        "error_type": "TYPE_ERROR"
                    }
                
                # 如果索引超出范围，需要扩展数组
                while len(array) <= part:
                    # 根据下一个路径部分决定添加什么类型的对象
                    if i + 1 < len(parts):
                        next_part = parts[i + 1]
                        if isinstance(next_part, str):
                            # 下一个是字符串键，说明是对象
                            array.append({})
                        else:
                            # 下一个是数字，说明是嵌套数组
                            array.append([])
                    else:
                        # 这是最后一个部分，添加空对象
                        array.append({})
        
        # 设置值
        try:
            set_by_path(self.resume_data, parts, value)
        except ValueError as e:
            return {
                "success": False,
                "message": f"更新失败: {e}",
                "path": path,
                "error_type": "UPDATE_ERROR"
            }
        
        return {
            "success": True,
            "message": f"成功更新字段: {path}",
            "path": path,
            "new_value": value
        }
    
    def _add(self, path: str, value: Any) -> Dict[str, Any]:
        """添加操作（向数组添加元素）"""
        parts = parse_path(path)
        # 应用字段映射
        parts = self._map_path(parts)
        
        # 获取目标数组，若不存在则创建
        try:
            _, _, target = get_by_path(self.resume_data, parts)
        except ValueError:
            # 自动创建数组
            set_by_path(self.resume_data, parts, [])
            _, _, target = get_by_path(self.resume_data, parts)
        
        # 如果目标不是数组，将其替换为包含新值的数组
        if not isinstance(target, list):
            # 将非数组值替换为空数组，然后添加新元素
            set_by_path(self.resume_data, parts, [])
            _, _, target = get_by_path(self.resume_data, parts)
        
        # 添加元素
        target.append(value)
        
        return {
            "success": True,
            "message": f"成功添加新项到: {path}",
            "path": path,
            "new_value": value,
            "new_index": len(target) - 1
        }
    
    def _delete(self, path: str) -> Dict[str, Any]:
        """删除操作"""
        parts = parse_path(path)
        # 应用字段映射
        parts = self._map_path(parts)
        
        # 获取父对象和键
        parent, key, old_value = get_by_path(self.resume_data, parts)
        
        # 执行删除
        if isinstance(parent, list):
            if not isinstance(key, int):
                return {
                    "success": False,
                    "message": "从数组删除需要数字索引",
                    "path": path,
                    "error_type": "TYPE_ERROR"
                }
            del parent[key]
        elif isinstance(parent, dict):
            del parent[key]
        else:
            return {
                "success": False,
                "message": f"无法从 {type(parent).__name__} 类型删除",
                "path": path,
                "error_type": "TYPE_ERROR"
            }
        
        return {
            "success": True,
            "message": f"成功删除: {path}",
            "path": path,
            "deleted_value": old_value
        }
    
    async def _arun(
        self,
        path: str,
        action: str,
        value: Optional[Any] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None
    ) -> Dict[str, Any]:
        """异步执行（直接调用同步方法）"""
        return self._run(path=path, action=action, value=value, run_manager=run_manager)


def create_cv_editor(resume_data: Dict[str, Any]) -> CVEditorTool:
    """
    创建 CVEditor 工具实例
    
    Args:
        resume_data: 简历数据字典（会被直接修改）
    
    Returns:
        配置好的 CVEditorTool 实例
    """
    return CVEditorTool(resume_data=resume_data)


# 工具的 OpenAI Function 定义（用于直接 API 调用）
CV_EDITOR_FUNCTION_DEF = {
    "type": "function",
    "function": {
        "name": "CVEditor",
        "description": (
            "编辑简历数据。支持修改(update)、添加(add)、删除(delete)操作。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": (
                        "要操作的简历字段的 JSON 路径。"
                        "例如: 'basic.name', 'education[0].school', 'education', 'workExperience[1]'。"
                    )
                },
                "action": {
                    "type": "string",
                    "enum": ["update", "add", "delete"],
                    "description": (
                        "操作类型: 'update' 修改值, 'add' 添加到数组, 'delete' 删除。"
                    )
                },
                "value": {
                    "type": ["object", "string", "number", "array", "boolean", "null"],
                    "description": (
                        "新值。update/add 操作必需。"
                        "添加教育经历示例: {\"school\": \"北京大学\", \"major\": \"计算机\", \"degree\": \"本科\"}"
                    )
                }
            },
            "required": ["path", "action"]
        }
    }
}


