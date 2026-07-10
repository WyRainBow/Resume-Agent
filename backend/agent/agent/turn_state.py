"""单轮执行状态（Wave 2a-S1）：收拢原 Manus 5 个散落 PrivateAttr flag。

此前 _pending_immediate_stream / _pending_edit_tool_call / _pending_resume_patches /
_finish_after_load_resume_tool / _current_turn_read_only 直接散在 Manus 上，
跨方法读写、生命周期不明。收拢是位置归一，不改任何语义。

注意 pending_resume_patches 非严格单轮：轮内由优化用例 queue、AgentStream
发射事件时 drain，异常/停止时残留会跨轮——语义保持现状（spec 锁定决策
D3/D8），reset_for_new_turn 不清它。
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class TurnExecutionState:
    """一次用户消息触发的执行轮内的可变状态。"""

    # qwq 诊断流参数：think() fast-path 装配，AgentStream 消费后置 None
    pending_immediate_stream: Optional[Dict[str, Any]] = None
    # 待执行的编辑工具调用：本轮 think() 装配、下一次 think() 消费
    pending_edit_tool_call: Optional[Dict[str, Any]] = None
    # 待发射的简历补丁队列（非严格单轮，见模块 docstring）
    pending_resume_patches: List[Dict[str, Any]] = field(default_factory=list)
    # load_resume 工具完成后本轮直接收尾
    finish_after_load_resume_tool: bool = False
    # 本轮为只读查询：execute_tool 拦截编辑类工具
    read_only: bool = False

    def queue_patch(self, patch: Dict[str, Any]) -> None:
        self.pending_resume_patches.append(patch)

    def drain_patches(self) -> List[Dict[str, Any]]:
        patches = list(self.pending_resume_patches)
        self.pending_resume_patches = []
        return patches

    def reset_for_new_turn(self) -> None:
        self.pending_immediate_stream = None
        self.pending_edit_tool_call = None
        self.finish_after_load_resume_tool = False
        self.read_only = False
        # patches 不清：保持现状跨轮残留语义（D3）
