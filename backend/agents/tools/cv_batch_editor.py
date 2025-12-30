"""
CVBatchEditor Tool - LangChain 批量简历编辑工具

基于 LangChain BaseTool 实现，支持批量执行多个编辑操作。
"""
from typing import Any, Dict, Optional, Type, List
from pydantic import BaseModel, Field, field_validator
from langchain_core.tools import BaseTool
from langchain_core.callbacks import CallbackManagerForToolRun

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from .cv_editor import CVEditorTool


class CVBatchEditorInput(BaseModel):
    """CVBatchEditor 工具的输入参数定义"""
    operations: List[Dict[str, Any]] = Field(
        ...,
        description=(
            "批量操作列表，每个操作包含 path, action, value 字段。"
            "例如: [{'path': 'basic.name', 'action': 'update', 'value': '张三'}, "
            "{'path': 'education', 'action': 'add', 'value': {...}}]"
        )
    )

    @field_validator('operations')
    @classmethod
    def validate_operations(cls, v):
        if not isinstance(v, list) or len(v) == 0:
            raise ValueError("operations 必须是非空列表")
        for i, op in enumerate(v):
            if not isinstance(op, dict):
                raise ValueError(f"操作 {i} 必须是字典")
            if 'path' not in op:
                raise ValueError(f"操作 {i} 缺少 path 字段")
            if 'action' not in op:
                raise ValueError(f"操作 {i} 缺少 action 字段")
            if op['action'] in ['update', 'add'] and 'value' not in op:
                raise ValueError(f"操作 {i} 的 action 是 {op['action']}，但缺少 value 字段")
        return v


class CVBatchEditorTool(BaseTool):
    """
    批量简历编辑工具

    功能：
    - 支持一次执行多个 CVEditor 操作
    - 原子性：要么全部成功，要么全部失败
    - 返回每个操作的执行结果

    使用示例：
    1. 批量更新基本信息: operations=[
         {'path': 'basic.name', 'action': 'update', 'value': '张三'},
         {'path': 'basic.phone', 'action': 'update', 'value': '13800138000'}
       ]
    2. 批量添加教育经历: operations=[
         {'path': 'education', 'action': 'add', 'value': {...}},
         {'path': 'education', 'action': 'add', 'value': {...}}
       ]
    """

    name: str = "CVBatchEditor"
    description: str = (
        "批量编辑简历数据。支持一次执行多个编辑操作，包括修改(update)、添加(add)、删除(delete)。"
        "每个操作需要提供 path 和 action，update/add 操作还需要 value。"
    )
    args_schema: Type[BaseModel] = CVBatchEditorInput

    # 简历数据引用（由 Agent 注入，会被直接修改）
    resume_data: Dict[str, Any] = Field(default_factory=dict)

    def _run(
        self,
        operations: List[Dict[str, Any]],
        run_manager: Optional[CallbackManagerForToolRun] = None
    ) -> Dict[str, Any]:
        """
        执行批量编辑操作

        Args:
            operations: 操作列表
            run_manager: LangChain 回调管理器

        Returns:
            包含批量操作结果的字典
        """
        # 创建 CVEditor 实例
        editor = CVEditorTool(resume_data=self.resume_data)

        results = []
        succeeded = 0
        failed = 0

        for i, op in enumerate(operations):
            path = op.get('path')
            action = op.get('action')
            value = op.get('value')

            result = editor._run(path=path, action=action, value=value)

            # 添加操作索引
            result['operation_index'] = i

            results.append(result)

            if result.get('success'):
                succeeded += 1
            else:
                failed += 1

        return {
            "success": failed == 0,
            "total": len(operations),
            "succeeded": succeeded,
            "failed": failed,
            "results": results,
            "message": f"批量操作完成：成功 {succeeded} 个，失败 {failed} 个"
        }

    async def _arun(
        self,
        operations: List[Dict[str, Any]],
        run_manager: Optional[CallbackManagerForToolRun] = None
    ) -> Dict[str, Any]:
        """异步执行（直接调用同步方法）"""
        return self._run(operations=operations, run_manager=run_manager)


def create_cv_batch_editor(resume_data: Dict[str, Any]) -> CVBatchEditorTool:
    """
    创建 CVBatchEditor 工具实例

    Args:
        resume_data: 简历数据字典（会被直接修改）

    Returns:
        配置好的 CVBatchEditorTool 实例
    """
    return CVBatchEditorTool(resume_data=resume_data)


# 工具的 OpenAI Function 定义（用于直接 API 调用）
CV_BATCH_EDITOR_FUNCTION_DEF = {
    "type": "function",
    "function": {
        "name": "CVBatchEditor",
        "description": (
            "批量编辑简历数据。支持一次执行多个编辑操作，包括修改(update)、添加(add)、删除(delete)。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "operations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "JSON 路径，如 'basic.name', 'education[0].school'"
                            },
                            "action": {
                                "type": "string",
                                "enum": ["update", "add", "delete"],
                                "description": "操作类型"
                            },
                            "value": {
                                "description": "新值（update/add 时必需）"
                            }
                        },
                        "required": ["path", "action"]
                    },
                    "description": "操作列表"
                }
            },
            "required": ["operations"]
        }
    }
}
