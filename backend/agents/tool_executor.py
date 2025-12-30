"""
ToolExecutor - 工具执行器

参考：sophia-pro/backend/agent/src/amplift/streaming_executor.py

负责：
1. 根据规划结果构建工具调用
2. 执行工具并返回结果
3. 处理执行错误
4. 工具调用钩子（前/后）
"""
from typing import Any, Callable, Dict, List, Optional, Tuple
from dataclasses import dataclass
import copy

from .chat_state import IntentType
from .tool_hooks import ToolStatusHook, ToolCallContext, ToolStatus


@dataclass
class ExecutionResult:
    """工具执行结果"""
    success: bool
    tool_name: str
    tool_params: Dict[str, Any]
    result: Any
    error: Optional[str] = None
    updated_resume: Optional[Dict[str, Any]] = None
    duration_ms: Optional[float] = None  # 执行耗时
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "tool_name": self.tool_name,
            "tool_params": self.tool_params,
            "result": self.result,
            "error": self.error,
            "duration_ms": self.duration_ms
        }


class ToolExecutor:
    """
    工具执行器
    
    参考 sophia-pro StreamingLocalPythonExecutor 设计：
    - 支持工具调用钩子（pre/post tool call hooks）
    - 统一的工具执行接口
    - 错误处理和结果包装
    
    功能：
    1. 根据规划结果构建工具调用参数
    2. 执行工具
    3. 处理错误和返回结果
    4. 支持工具调用钩子
    """
    
    def __init__(
        self, 
        resume_data: Dict[str, Any] = None,
        tool_hook: Optional[ToolStatusHook] = None
    ):
        """
        初始化执行器
        
        Args:
            resume_data: 简历数据
            tool_hook: 工具状态钩子（可选）
        """
        self.resume_data = resume_data or {}
        self.tool_hook = tool_hook
        
        # 初始化工具实例
        self._reader = None
        self._editor = None
    
    @property
    def reader(self):
        """懒加载 CVReader"""
        if self._reader is None:
            from .tools.cv_reader import CVReaderTool
            self._reader = CVReaderTool(resume_data=self.resume_data)
        return self._reader
    
    @property
    def editor(self):
        """懒加载 CVEditor"""
        if self._editor is None:
            from .tools.cv_editor import CVEditorTool
            self._editor = CVEditorTool(resume_data=self.resume_data)
        return self._editor
    
    def update_resume_data(self, resume_data: Dict[str, Any]) -> None:
        """更新简历数据"""
        self.resume_data = resume_data
        # 重置工具实例
        self._reader = None
        self._editor = None
    
    def execute_read(self, path: str) -> ExecutionResult:
        """
        执行读取操作
        
        Args:
            path: 读取路径
        
        Returns:
            ExecutionResult
        """
        params = {"path": path}
        context = None
        
        # 调用前钩子
        if self.tool_hook:
            context = self.tool_hook.pre_tool_call("CVReader", "读取简历数据", params)
        
        try:
            # 使用 LangChain 工具的 _run 方法
            result = self.reader._run(path=path)
            success = result.get("success", False)
            
            # 调用后钩子
            if self.tool_hook and context:
                self.tool_hook.post_tool_call(context, result=result, success=success)
            
            return ExecutionResult(
                success=success,
                tool_name="CVReader",
                tool_params=params,
                result=result.get("data"),
                error=result.get("message") if not success else None,
                duration_ms=context.duration_ms if context else None
            )
        except Exception as e:
            # 调用后钩子（失败）
            if self.tool_hook and context:
                self.tool_hook.post_tool_call(context, error=str(e), success=False)
            
            return ExecutionResult(
                success=False,
                tool_name="CVReader",
                tool_params=params,
                result=None,
                error=str(e),
                duration_ms=context.duration_ms if context else None
            )
    
    def execute_add(self, path: str, value: Dict[str, Any]) -> ExecutionResult:
        """
        执行添加操作
        
        Args:
            path: 添加路径（模块名，如 workExperience）
            value: 要添加的数据
        
        Returns:
            ExecutionResult
        """
        params = {"path": path, "action": "add", "value": value}
        context = None
        
        # 调用前钩子
        if self.tool_hook:
            context = self.tool_hook.pre_tool_call("CVEditor", f"添加{path}数据", params)
        
        try:
            # 使用 LangChain 工具的 _run 方法
            result = self.editor._run(path=path, action="add", value=value)
            success = result.get("success", False)
            
            # 同步更新 resume_data 并重置 reader（关键：确保 CVReader 读取最新数据）
            if success:
                self.resume_data = copy.deepcopy(self.editor.resume_data)
                self._reader = None  # 重置 reader，下次读取使用最新数据
            
            # 调用后钩子
            if self.tool_hook and context:
                self.tool_hook.post_tool_call(context, result=result, success=success)
            
            return ExecutionResult(
                success=success,
                tool_name="CVEditor",
                tool_params=params,
                result=result.get("new_value"),
                error=result.get("message") if not success else None,
                updated_resume=self.resume_data if success else None,
                duration_ms=context.duration_ms if context else None
            )
        except Exception as e:
            # 调用后钩子（失败）
            if self.tool_hook and context:
                self.tool_hook.post_tool_call(context, error=str(e), success=False)
            
            return ExecutionResult(
                success=False,
                tool_name="CVEditor",
                tool_params=params,
                result=None,
                error=str(e),
                duration_ms=context.duration_ms if context else None
            )
    
    def execute_update(self, path: str, value: Any) -> ExecutionResult:
        """
        执行更新操作
        
        Args:
            path: 更新路径（如 workExperience[0].company）
            value: 新值
        
        Returns:
            ExecutionResult
        """
        params = {"path": path, "action": "update", "value": value}
        context = None
        
        # 调用前钩子
        if self.tool_hook:
            context = self.tool_hook.pre_tool_call("CVEditor", f"更新{path}", params)
        
        try:
            # 使用 LangChain 工具的 _run 方法
            result = self.editor._run(path=path, action="update", value=value)
            success = result.get("success", False)
            
            # 同步更新 resume_data 并重置 reader（关键：确保 CVReader 读取最新数据）
            if success:
                self.resume_data = copy.deepcopy(self.editor.resume_data)
                self._reader = None  # 重置 reader，下次读取使用最新数据
            
            # 调用后钩子
            if self.tool_hook and context:
                self.tool_hook.post_tool_call(context, result=result, success=success)
            
            return ExecutionResult(
                success=success,
                tool_name="CVEditor",
                tool_params=params,
                result=result.get("new_value"),
                error=result.get("message") if not success else None,
                updated_resume=self.resume_data if success else None,
                duration_ms=context.duration_ms if context else None
            )
        except Exception as e:
            # 调用后钩子（失败）
            if self.tool_hook and context:
                self.tool_hook.post_tool_call(context, error=str(e), success=False)
            
            return ExecutionResult(
                success=False,
                tool_name="CVEditor",
                tool_params=params,
                result=None,
                error=str(e),
                duration_ms=context.duration_ms if context else None
            )
    
    def execute_delete(self, path: str) -> ExecutionResult:
        """
        执行删除操作
        
        Args:
            path: 删除路径
        
        Returns:
            ExecutionResult
        """
        params = {"path": path, "action": "delete"}
        context = None
        
        # 调用前钩子
        if self.tool_hook:
            context = self.tool_hook.pre_tool_call("CVEditor", f"删除{path}", params)
        
        try:
            # 使用 LangChain 工具的 _run 方法
            result = self.editor._run(path=path, action="delete")
            success = result.get("success", False)
            
            # 同步更新 resume_data 并重置 reader（关键：确保 CVReader 读取最新数据）
            if success:
                self.resume_data = copy.deepcopy(self.editor.resume_data)
                self._reader = None  # 重置 reader，下次读取使用最新数据
            
            # 调用后钩子
            if self.tool_hook and context:
                self.tool_hook.post_tool_call(context, result=result, success=success)
            
            return ExecutionResult(
                success=success,
                tool_name="CVEditor",
                tool_params=params,
                result=result.get("deleted_value"),
                error=result.get("message") if not success else None,
                updated_resume=self.resume_data if success else None,
                duration_ms=context.duration_ms if context else None
            )
        except Exception as e:
            # 调用后钩子（失败）
            if self.tool_hook and context:
                self.tool_hook.post_tool_call(context, error=str(e), success=False)
            
            return ExecutionResult(
                success=False,
                tool_name="CVEditor",
                tool_params=params,
                result=None,
                error=str(e),
                duration_ms=context.duration_ms if context else None
            )
    
    def execute(
        self,
        intent: IntentType,
        module: str,
        data: Dict[str, Any] = None,
        path: str = None
    ) -> ExecutionResult:
        """
        根据意图执行工具
        
        Args:
            intent: 意图类型
            module: 模块名
            data: 数据（用于 ADD/UPDATE）
            path: 路径（用于 UPDATE/DELETE/READ）
        
        Returns:
            ExecutionResult
        """
        if intent == IntentType.READ:
            return self.execute_read(path or module)
        
        elif intent == IntentType.ADD:
            return self.execute_add(module, data or {})
        
        elif intent == IntentType.UPDATE:
            if not path:
                return ExecutionResult(
                    success=False,
                    tool_name="CVEditor",
                    tool_params={"action": "update"},
                    result=None,
                    error="更新操作需要指定路径"
                )
            return self.execute_update(path, data)
        
        elif intent == IntentType.DELETE:
            if not path:
                return ExecutionResult(
                    success=False,
                    tool_name="CVEditor",
                    tool_params={"action": "delete"},
                    result=None,
                    error="删除操作需要指定路径"
                )
            return self.execute_delete(path)
        
        else:
            return ExecutionResult(
                success=False,
                tool_name="",
                tool_params={},
                result=None,
                error=f"不支持的意图类型: {intent}"
            )
    
    def get_resume_data(self) -> Dict[str, Any]:
        """获取当前简历数据"""
        return self.resume_data
