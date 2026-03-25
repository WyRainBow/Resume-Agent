"""
CVEditor Agent - 简历编辑 Agent

可以修改、添加或删除简历数据
"""

from typing import Dict, Optional, Any
from pydantic import Field
import json

from backend.agent.agent.toolcall import ToolCallAgent
from backend.agent.tool import ToolCollection, Terminate, CreateChatCompletion
from backend.agent.utils.json_path import parse_path, get_by_path, set_by_path, delete_by_path, exists_path


class CVEditor(ToolCallAgent):
    """简历编辑 Agent

    专门用于修改简历内容的 Agent
    """

    name: str = "CVEditor"
    description: str = "An AI agent that edits and modifies CV/Resume content"

    system_prompt: str = """You are a professional CV/Resume editor. You help users modify and improve their resumes.

Your capabilities:
1. Update existing resume fields (name, email, phone, title, etc.)
2. Add new entries to arrays (education, experience, projects, awards, etc.)
3. Delete unnecessary information
4. Reformat and structure resume data properly

When editing:
- Always preserve the resume data structure
- Use proper JSON path notation: 'basic.name', 'education[0].school', etc.
- When adding new items, provide complete object data
- Maintain data consistency

Available operations:
- update: Modify an existing field's value
- add: Add a new item to an array
- delete: Remove a field or array item
"""

    next_step_prompt: str = """Please analyze the user's request and use the appropriate edit operation (update/add/delete) on the resume data."""

    available_tools: ToolCollection = Field(
        default_factory=lambda: ToolCollection(
            CreateChatCompletion(),
            Terminate(),
        )
    )

    special_tool_names: list[str] = Field(default_factory=lambda: [Terminate().name])

    max_steps: int = 10

    # 当前加载的简历数据
    _resume_data: Optional[Dict] = None

    class Config:
        arbitrary_types_allowed = True

    def load_resume(self, resume_data: Dict) -> str:
        """加载简历数据到 Agent

        Args:
            resume_data: 简历数据字典

        Returns:
            简历摘要文本
        """
        self._resume_data = resume_data

        basic = resume_data.get("basic", {})
        context = f"""Current Resume Loaded for Editing:

Name: {basic.get('name', 'N/A')}
Target Position: {basic.get('title', 'N/A')}

You can edit this resume using update, add, or delete operations.
"""
        from backend.agent.schema import Message
        self.memory.add_message(Message.system_message(context))
        return context

    async def edit_resume(self, path: str, action: str, value: Any = None) -> Dict[str, Any]:
        """编辑简历

        Args:
            path: JSON 路径，如 'basic.name', 'education[0].school'
            action: 操作类型: 'update', 'add', 'delete'
            value: 新值（update/add 时需要）

        Returns:
            操作结果
        """
        if not self._resume_data:
            return {
                "success": False,
                "message": "No resume data loaded. Please load a resume first.",
                "error_type": "NO_RESUME"
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
                    "message": f"Unsupported action: {action}",
                    "error_type": "INVALID_ACTION"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Edit failed: {str(e)}",
                "error_type": "INTERNAL_ERROR"
            }

    def _update(self, path: str, value: Any) -> Dict[str, Any]:
        """更新操作"""
        try:
            old_value = None
            parts = parse_path(path)
            if exists_path(self._resume_data, parts):
                _, _, old_value = get_by_path(self._resume_data, parts)
            set_by_path(self._resume_data, path, value)
            return {
                "success": True,
                "message": f"Successfully updated: {path}",
                "path": path,
                "old_value": old_value,
                "new_value": value,
            }
        except ValueError as e:
            return {
                "success": False,
                "message": f"Update failed: {e}",
                "path": path,
                "error_type": "UPDATE_ERROR"
            }

    def _add(self, path: str, value: Any) -> Dict[str, Any]:
        """添加操作"""
        try:
            parts = parse_path(path)
            _, _, target = get_by_path(self._resume_data, parts)

            if not isinstance(target, list):
                # 创建新数组
                set_by_path(self._resume_data, path, [])
                _, _, target = get_by_path(self._resume_data, parts)

            target.append(value)
            return {
                "success": True,
                "message": f"Successfully added to: {path}",
                "path": path,
                "new_value": value,
                "new_index": len(target) - 1
            }
        except ValueError:
            # 创建新数组并添加
            set_by_path(self._resume_data, path, [value])
            return {
                "success": True,
                "message": f"Created new array and added to: {path}",
                "path": path,
                "new_value": value,
                "new_index": 0
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Add failed: {e}",
                "path": path,
                "error_type": "ADD_ERROR"
            }

    def _delete(self, path: str) -> Dict[str, Any]:
        """删除操作"""
        try:
            old_value = delete_by_path(self._resume_data, path)
            return {
                "success": True,
                "message": f"Successfully deleted: {path}",
                "path": path,
                "deleted_value": str(old_value)[:100]  # 限制长度
            }
        except ValueError as e:
            return {
                "success": False,
                "message": f"Delete failed: {e}",
                "path": path,
                "error_type": "DELETE_ERROR"
            }

    def get_resume_data(self) -> Dict:
        """获取当前简历数据"""
        return self._resume_data or {}

    async def chat(self, message: str, resume_data: Optional[Dict] = None) -> str:
        """与编辑对话

        Args:
            message: 用户消息
            resume_data: 简历数据（如果未加载过）

        Returns:
            AI 回复
        """
        if resume_data:
            self.load_resume(resume_data)
        elif not self._resume_data:
            return "No resume data loaded. Please load a resume first."

        # 添加用户消息
        self.update_memory("user", message)

        # 运行 Agent
        result = await self.run()

        return result
