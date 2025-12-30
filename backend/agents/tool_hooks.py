"""
工具调用钩子实现

参考：sophia-pro/backend/agent/src/amplift/tool_hooks.py

提供工具调用前后的钩子机制，用于：
- 记录工具执行状态
- 发送状态通知
- 错误追踪
"""

import time
import uuid
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class ToolStatus(str, Enum):
    """工具执行状态"""
    START = "start"
    SUCCESS = "success"
    ERROR = "error"


@dataclass
class ToolCallContext:
    """工具调用上下文"""
    tool_call_id: str
    tool_name: str
    description: str
    params: Dict[str, Any]
    result: Any = None
    error: Optional[str] = None
    success: bool = False
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    
    @property
    def duration_ms(self) -> Optional[float]:
        """执行耗时（毫秒）"""
        if self.end_time:
            return (self.end_time - self.start_time) * 1000
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool_call_id": self.tool_call_id,
            "tool_name": self.tool_name,
            "description": self.description,
            "params": self.params,
            "result": self.result,
            "error": self.error,
            "success": self.success,
            "duration_ms": self.duration_ms
        }


class ToolStatusHook:
    """
    工具状态钩子
    
    在工具调用前后记录状态，支持回调通知
    
    使用示例：
        hook = ToolStatusHook(callback=lambda status, ctx: print(f"{status}: {ctx.tool_name}"))
        
        # 工具调用前
        ctx = hook.pre_tool_call("CVEditor", "编辑简历", {"path": "basic.name", "value": "张三"})
        
        # 工具调用后
        hook.post_tool_call(ctx, result={"success": True}, success=True)
    """
    
    def __init__(self, callback: Optional[Callable[[ToolStatus, ToolCallContext], None]] = None):
        """
        Args:
            callback: 状态变更回调函数，接收 (status, context) 参数
        """
        self.callback = callback
        self.call_history: List[ToolCallContext] = []
    
    def pre_tool_call(
        self,
        tool_name: str,
        description: str,
        params: Dict[str, Any]
    ) -> ToolCallContext:
        """
        工具调用前钩子
        
        Args:
            tool_name: 工具名称
            description: 工具描述
            params: 调用参数
        
        Returns:
            ToolCallContext: 调用上下文
        """
        context = ToolCallContext(
            tool_call_id=str(uuid.uuid4())[:8],
            tool_name=tool_name,
            description=description,
            params=params
        )
        
        self.call_history.append(context)
        
        if self.callback:
            self.callback(ToolStatus.START, context)
        
        return context
    
    def post_tool_call(
        self,
        context: ToolCallContext,
        result: Any = None,
        error: Optional[str] = None,
        success: bool = True
    ) -> ToolCallContext:
        """
        工具调用后钩子
        
        Args:
            context: 调用上下文
            result: 执行结果
            error: 错误信息
            success: 是否成功
        
        Returns:
            ToolCallContext: 更新后的上下文
        """
        context.result = result
        context.error = error
        context.success = success
        context.end_time = time.time()
        
        status = ToolStatus.SUCCESS if success else ToolStatus.ERROR
        
        if self.callback:
            self.callback(status, context)
        
        return context
    
    def get_history(self) -> List[Dict[str, Any]]:
        """获取调用历史"""
        return [ctx.to_dict() for ctx in self.call_history]
    
    def clear_history(self):
        """清空调用历史"""
        self.call_history = []


class LoggingToolHook(ToolStatusHook):
    """
    带日志记录的工具钩子
    
    自动打印工具执行日志
    """
    
    def __init__(self, logger=None):
        def log_callback(status: ToolStatus, ctx: ToolCallContext):
            if status == ToolStatus.START:
                msg = f"[Tool] 开始执行: {ctx.tool_name}"
                if ctx.params:
                    msg += f" | 参数: {ctx.params}"
            elif status == ToolStatus.SUCCESS:
                msg = f"[Tool] 执行成功: {ctx.tool_name} | 耗时: {ctx.duration_ms:.1f}ms"
            else:
                msg = f"[Tool] 执行失败: {ctx.tool_name} | 错误: {ctx.error}"
            
            if logger:
                logger.info(msg)
            else:
                print(msg)
        
        super().__init__(callback=log_callback)


def create_tool_wrapper(
    tool_func: Callable,
    tool_name: str,
    description: str,
    hook: Optional[ToolStatusHook] = None
) -> Callable:
    """
    创建带钩子的工具包装器
    
    参考：sophia-pro StreamingLocalPythonExecutor._wrap_tool
    
    Args:
        tool_func: 原始工具函数
        tool_name: 工具名称
        description: 工具描述
        hook: 状态钩子
    
    Returns:
        Callable: 包装后的工具函数
    """
    def wrapped_func(**kwargs):
        context = None
        
        # 调用前钩子
        if hook:
            context = hook.pre_tool_call(tool_name, description, kwargs)
        
        try:
            result = tool_func(**kwargs)
            
            # 调用后钩子（成功）
            if hook and context:
                success = result.get("success", True) if isinstance(result, dict) else True
                hook.post_tool_call(context, result=result, success=success)
            
            return result
        
        except Exception as e:
            # 调用后钩子（失败）
            if hook and context:
                hook.post_tool_call(context, error=str(e), success=False)
            raise
    
    return wrapped_func

