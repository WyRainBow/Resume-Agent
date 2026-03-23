"""
CVEditor Agent Tool - 将 CVEditor Agent 包装成 Manus 可调用的工具

参考 MCPAgent 的集成方式，这个工具内部使用 CVEditor Agent 来处理简历编辑任务。
Manus 可以委托简历修改任务给这个工具。
"""

from typing import Optional, Any, Dict
import json
import re
from backend.agent.tool.base import BaseTool, ToolResult
from backend.agent.tool.resume_data_store import ResumeDataStore
from backend.agent.llm import LLM
from backend.core.logger import get_logger

logger = get_logger(__name__)


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
                "type": "string",
                "description": "New value for update/add operations (will be parsed as JSON if needed). For add, provide complete object. For update, provide the new value."
            }
        },
        "required": ["path", "action"]
    }

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def _stringify_value(value: Any) -> str:
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False, indent=2)
        if value is None:
            return "null"
        return str(value)

    @staticmethod
    def _resolve_simple_edit_path(path: str, resume_data: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
        """将简单编辑路径映射到当前简历结构（internships <-> experience）。"""
        meta: Dict[str, Any] = {"normalized_path": path}
        match = re.match(r"^internships\[(\d+)\]\.company$", path)
        if not match:
            return path, meta

        index = int(match.group(1))
        internships = resume_data.get("internships")
        experience = resume_data.get("experience")

        if isinstance(internships, list):
            if index >= len(internships):
                raise ValueError(f"当前只有 {len(internships)} 段实习，无法修改第 {index + 1} 段")
            meta["section"] = "internships"
            meta["index"] = index
            return path, meta

        if isinstance(experience, list):
            if index >= len(experience):
                raise ValueError(f"当前只有 {len(experience)} 段经历，无法修改第 {index + 1} 段")
            mapped_path = f"experience[{index}].company"
            meta["section"] = "internships"
            meta["index"] = index
            meta["normalized_path"] = mapped_path
            return mapped_path, meta

        raise ValueError("当前简历中未找到可修改的实习/经历条目，请先完善对应内容")

    async def execute(self, path: str, action: str, value: Any = None) -> ToolResult:
        """执行简历编辑

        内部创建 CVEditor Agent 并运行它来处理编辑任务
        """
        # 🔍 诊断日志
        logger.info(f"[CVEditorAgentTool] execute called: session_id={self.session_id}, path={path}, action={action}")
        
        resume_data = ResumeDataStore.get_data(self.session_id)
        meta = ResumeDataStore._meta_by_session.get(self.session_id, {})
        logger.info(f"[CVEditorAgentTool] resume_data: {bool(resume_data)}, meta: {meta}")
        
        if not resume_data:
            return ToolResult(
                output="No resume data loaded. Please use cv_reader_agent tool first to read resume data."
            )

        try:
            normalized_path, simple_edit_meta = self._resolve_simple_edit_path(path, resume_data)
            # 延迟导入避免循环依赖
            from backend.agent.agent.cv_editor import CVEditor

            # 创建 CVEditor Agent 实例
            cv_editor = CVEditor()

            # 加载简历数据（传入引用，所以修改会直接影响原始数据）
            cv_editor.load_resume(resume_data)

            # 执行编辑操作
            result = await cv_editor.edit_resume(normalized_path, action, value)

            if result.get("success"):
                # 同步更新 ResumeDataStore（因为 CVEditor 直接修改了传入的字典引用）
                ResumeDataStore.set_data(resume_data, session_id=self.session_id)
                # 尝试写回 AI 简历存储（如有 resume_id/user_id）
                persisted = ResumeDataStore.persist_data(self.session_id)

                # 格式化成功消息
                old_val = result.get("old_value")
                new_val = result.get("new_value")
                output = f"✅ {result.get('message', 'Edit completed')}"
                if not persisted:
                    # 🔧 改进：检查持久化失败的具体原因
                    meta = ResumeDataStore._meta_by_session.get(self.session_id, {})
                    resume_id = meta.get("resume_id")
                    user_id = meta.get("user_id")
                    
                    if not resume_id or not user_id:
                        logger.error(
                            f"[CVEditorAgentTool] 持久化失败：缺少元数据。"
                            f"session_id={self.session_id}, resume_id={resume_id}, user_id={user_id}"
                        )
                        output += (
                            f"\n❌ **持久化失败**: 缺少必要的元数据（resume_id 或 user_id）。"
                            f"请联系管理员或刷新页面重试。"
                        )
                    else:
                        logger.warning(
                            f"[CVEditorAgentTool] 持久化失败：数据库操作失败。"
                            f"session_id={self.session_id}, resume_id={resume_id}, user_id={user_id}"
                        )
                        output += (
                            f"\n⚠️ **持久化失败**: 修改已应用在内存中，但未保存到数据库。"
                            f"请刷新页面确认，或稍后重试。"
                        )
                if action == "update":
                    output += (
                        "\n\n修改前：\n```text\n"
                        f"{self._stringify_value(old_val)}\n```\n"
                        "修改后：\n```text\n"
                        f"{self._stringify_value(new_val)}\n```"
                    )
                elif "new_value" in result:
                    new_val_str = self._stringify_value(new_val)
                    output += f"\nNew value: {new_val_str}"
                if "new_index" in result:
                    output += f"\nIndex: {result['new_index']}"
                structured_data = {
                    "type": "resume_edit_diff",
                    "section": simple_edit_meta.get("section", "basic"),
                    "field": "name"
                    if normalized_path == "basic.name"
                    else "company"
                    if normalized_path.endswith(".company")
                    else normalized_path.split(".")[-1],
                    "index": simple_edit_meta.get("index"),
                    "before": self._stringify_value(old_val),
                    "after": self._stringify_value(new_val),
                    "patch": {
                        "path": normalized_path,
                        "action": action,
                        "value": new_val,
                    },
                }
                return ToolResult(output=output, system=json.dumps(structured_data, ensure_ascii=False))
            else:
                return ToolResult(
                    error=f"❌ Edit failed: {result.get('message', 'Unknown error')}"
                )

        except Exception as e:
            return ToolResult(error=f"CVEditor Agent error: {str(e)}")
