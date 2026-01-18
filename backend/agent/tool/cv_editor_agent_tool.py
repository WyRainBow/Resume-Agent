"""
CVEditor Agent Tool - 将 CVEditor Agent 包装成 Manus 可调用的工具

参考 MCPAgent 的集成方式，这个工具内部使用 CVEditor Agent 来处理简历编辑任务。
Manus 可以委托简历修改任务给这个工具。
"""

from typing import Optional, Any
import json
from backend.agent.tool.base import BaseTool, ToolResult
from backend.agent.tool.resume_data_store import ResumeDataStore
from backend.agent.llm import LLM


class CVEditorAgentTool(BaseTool):
    """CVEditor Agent 工具

    这是一个特殊的工具，它内部使用 CVEditor Agent 来处理简历编辑任务。
    Manus 可以委托简历修改任务给这个工具，CVEditor 会以 Agent 的方式处理。

    使用场景：
    - 用户要求修改简历中的某个字段
    - 用户要求添加新的工作经历
    - 用户要求删除某个项目
    - 用户要求更新个人信息
    """

    name: str = "cv_editor_agent"
    description: str = """Edit and modify CV/Resume data through the CVEditor Agent.

Use this tool when user requests to modify resume content.

**Keywords:** 修改, 更新, 改成, 改为, 设置, 添加, 增加, 删除, 去掉

**Parameters:**
- path: JSON path to the field (e.g., 'basic.name', 'education[0].school', 'education')
- action: 'update', 'add', or 'delete'
- value: New value (for update/add operations)

Execute modifications immediately when user provides specific details.
"""

    parameters: dict = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "JSON path to the resume field. Examples: 'basic.name', 'education[0].school', 'experience'"
            },
            "action": {
                "type": "string",
                "enum": ["update", "add", "delete"],
                "description": "Operation type: 'update' to modify, 'add' to append to array, 'delete' to remove"
            },
            "value": {
                "type": ["object", "string", "number", "array", "boolean", "null"],
                "description": "New value for update/add operations. For add, provide complete object. For update, provide the new value."
            }
        },
        "required": ["path", "action"]
    }

    class Config:
        arbitrary_types_allowed = True

    async def execute(self, path: str, action: str, value: Any = None) -> ToolResult:
        """执行简历编辑

        内部创建 CVEditor Agent 并运行它来处理编辑任务
        """
        resume_data = ResumeDataStore.get_data(self.session_id)
        if not resume_data:
            return ToolResult(
                output="No resume data loaded. Please use cv_reader_agent tool first to read resume data."
            )

        try:
            # 延迟导入避免循环依赖
            from backend.agent.agent.cv_editor import CVEditor

            # 创建 CVEditor Agent 实例
            cv_editor = CVEditor()

            # 加载简历数据（传入引用，所以修改会直接影响原始数据）
            cv_editor.load_resume(resume_data)

            # 执行编辑操作
            result = await cv_editor.edit_resume(path, action, value)

            if result.get("success"):
                # 同步更新 ResumeDataStore（因为 CVEditor 直接修改了传入的字典引用）
                ResumeDataStore.set_data(resume_data, session_id=self.session_id)
                # 尝试写回 AI 简历存储（如有 resume_id/user_id）
                ResumeDataStore.persist_data(self.session_id)

                # 格式化成功消息
                output = f"✅ {result.get('message', 'Edit completed')}"
                if "new_value" in result:
                    new_val = result["new_value"]
                    if isinstance(new_val, dict):
                        new_val_str = json.dumps(new_val, ensure_ascii=False)
                    else:
                        new_val_str = str(new_val)
                    output += f"\nNew value: {new_val_str}"
                if "new_index" in result:
                    output += f"\nIndex: {result['new_index']}"
                return ToolResult(output=output)
            else:
                return ToolResult(
                    error=f"❌ Edit failed: {result.get('message', 'Unknown error')}"
                )

        except Exception as e:
            return ToolResult(error=f"CVEditor Agent error: {str(e)}")
