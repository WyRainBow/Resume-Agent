"""
CVReader Tool - LangChain 简历读取工具

基于 LangChain BaseTool 实现，用于读取简历数据的指定字段或完整内容。
"""
from typing import Any, Dict, Optional, Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from langchain_core.callbacks import CallbackManagerForToolRun

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from json_path import parse_path, get_by_path


class CVReaderInput(BaseModel):
    """CVReader 工具的输入参数定义"""
    path: Optional[str] = Field(
        default=None,
        description=(
            "要读取的简历字段的 JSON 路径。"
            "例如: 'basic.name' (姓名), 'education[0].school' (第一段教育经历的学校), "
            "'workExperience[1].description' (第二段工作经历的描述)。"
            "如果不提供路径，则返回完整简历数据。"
        )
    )


class CVReaderTool(BaseTool):
    """
    简历读取工具
    
    功能：
    - 读取简历的完整数据
    - 读取简历的指定字段（通过 JSON 路径）
    
    支持的路径格式：
    - basic.name - 基本信息中的姓名
    - basic.phone - 基本信息中的电话
    - basic.email - 基本信息中的邮箱
    - education - 所有教育经历
    - education[0] - 第一段教育经历
    - education[0].school - 第一段教育经历的学校
    - workExperience - 所有工作经历
    - workExperience[0].company - 第一段工作经历的公司
    - projects - 所有项目经历
    - skillContent - 技能描述
    """
    
    name: str = "CVReader"
    description: str = (
        "读取简历数据。可以读取完整简历或指定字段。"
        "使用 path 参数指定要读取的字段路径，"
        "例如 'basic.name' 读取姓名，'education[0]' 读取第一段教育经历。"
        "不传 path 则返回完整简历。"
    )
    args_schema: Type[BaseModel] = CVReaderInput
    
    # 简历数据引用（由 Agent 注入）
    resume_data: Dict[str, Any] = Field(default_factory=dict)
    
    def _run(
        self,
        path: Optional[str] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None
    ) -> Dict[str, Any]:
        """
        执行读取操作
        
        Args:
            path: JSON 路径，可选
            run_manager: LangChain 回调管理器
        
        Returns:
            包含读取结果的字典
        """
        try:
            if not path:
                # 返回完整简历
                return {
                    "success": True,
                    "message": "成功读取完整简历数据",
                    "data": self.resume_data,
                    "path": None
                }
            
            # 解析路径
            parts = parse_path(path)
            
            # 字段映射：workExperience <-> experience（兼容前端使用 experience 字段）
            field_mapping = {
                "workExperience": "experience",
                "experience": "workExperience"
            }
            
            # 如果路径的第一部分是映射字段，尝试映射
            mapped_parts = parts.copy()
            if len(parts) > 0 and isinstance(parts[0], str) and parts[0] in field_mapping:
                mapped_field = field_mapping[parts[0]]
                # 先尝试使用原始路径
                try:
                    _, _, value = get_by_path(self.resume_data, parts)
                except ValueError:
                    # 如果原始路径失败，尝试映射后的路径
                    mapped_parts[0] = mapped_field
                    try:
                        _, _, value = get_by_path(self.resume_data, mapped_parts)
                    except ValueError:
                        value = None
                else:
                    # 原始路径成功，使用原始值
                    pass
            else:
                # 非映射字段，直接读取
                try:
                    _, _, value = get_by_path(self.resume_data, parts)
                except ValueError:
                    value = None
            
            # 如果读取失败，根据路径类型返回默认值
            if value is None:
                # 如果是数组类型的路径（如 workExperience, education），返回空数组
                if len(parts) == 1 and isinstance(parts[0], str):
                    # 检查是否是常见的数组字段（包括映射字段）
                    array_fields = ["workExperience", "experience", "education", "skills", "projects"]
                    if parts[0] in array_fields:
                        value = []
                    else:
                        # 其他字段返回 None
                        value = None
                else:
                    value = None
            
            return {
                "success": True,
                "message": f"成功读取字段: {path}",
                "data": value,
                "path": path
            }
            
        except ValueError as e:
            return {
                "success": False,
                "message": f"路径解析错误: {e}",
                "path": path,
                "error_type": "PATH_ERROR"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"读取失败: {e}",
                "path": path,
                "error_type": "INTERNAL_ERROR"
            }
    
    async def _arun(
        self,
        path: Optional[str] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None
    ) -> Dict[str, Any]:
        """异步执行（直接调用同步方法）"""
        return self._run(path=path, run_manager=run_manager)


def create_cv_reader(resume_data: Dict[str, Any]) -> CVReaderTool:
    """
    创建 CVReader 工具实例
    
    Args:
        resume_data: 简历数据字典
    
    Returns:
        配置好的 CVReaderTool 实例
    """
    return CVReaderTool(resume_data=resume_data)


# 工具的 OpenAI Function 定义（用于直接 API 调用）
CV_READER_FUNCTION_DEF = {
    "type": "function",
    "function": {
        "name": "CVReader",
        "description": (
            "读取简历数据。可以读取完整简历或指定字段。"
            "使用 path 参数指定要读取的字段路径。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": (
                        "要读取的简历字段的 JSON 路径。"
                        "例如: 'basic.name', 'education[0].school', 'workExperience[1].description'。"
                        "不传则返回完整简历。"
                    )
                }
            }
        }
    }
}


