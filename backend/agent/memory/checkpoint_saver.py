"""
CheckpointSaver - 版本快照与回溯机制

参考 LangGraph Checkpointer 设计，为简历优化提供版本控制能力。
支持保存状态快照、回滚到指定版本、版本对比等功能。
"""

import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, NamedTuple
from dataclasses import dataclass, field, asdict
from pydantic import BaseModel


class Checkpoint(NamedTuple):
    """单个检查点快照"""
    version: int
    timestamp: str
    agent: str
    action: str
    resume_snapshot: Dict[str, Any]
    operation: Dict[str, Any]
    metadata: Dict[str, Any]
    checksum: str


@dataclass
class ResumeSnapshot:
    """简历快照数据"""
    raw_content: str
    sections: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ResumeSnapshot":
        return cls(
            raw_content=data.get("raw_content", ""),
            sections=data.get("sections", []),
            metadata=data.get("metadata", {})
        )


@dataclass
class Operation:
    """操作记录"""
    action: str  # analyze | optimize | edit | load
    input: str
    output: str
    section: Optional[str] = None
    changes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Operation":
        return cls(
            action=data.get("action", ""),
            input=data.get("input", ""),
            output=data.get("output", ""),
            section=data.get("section"),
            changes=data.get("changes", [])
        )


@dataclass
class CheckpointMetadata:
    """检查点元数据"""
    duration_ms: Optional[int] = None
    model: Optional[str] = None
    user_feedback: Optional[str] = None
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CheckpointMetadata":
        return cls(
            duration_ms=data.get("duration_ms"),
            model=data.get("model"),
            user_feedback=data.get("user_feedback"),
            tags=data.get("tags", [])
        )


class CheckpointSaver:
    """
    检查点保存器 - 管理简历优化的版本历史

    功能：
    - save() 保存当前状态快照
    - rollback(version) 回滚到指定版本
    - get_version(version) 获取版本信息
    - list_versions() 列出所有版本
    - compare(v1, v2) 对比两个版本
    """

    def __init__(self, storage_path: str = "data/checkpoints"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

        self._checkpoints: List[Checkpoint] = []
        self._current_version = 0
        self._current_resume: Optional[ResumeSnapshot] = None

        # 尝试加载已有检查点
        self._load_from_disk()

    def _calculate_checksum(self, resume_snapshot: ResumeSnapshot) -> str:
        """计算简历快照的校验和"""
        content = json.dumps(resume_snapshot.to_dict(), sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _get_checkpoint_file(self, version: int) -> Path:
        """获取指定版本的检查点文件路径"""
        return self.storage_path / f"checkpoint_v{version}.json"

    def _save_to_disk(self, checkpoint: Checkpoint) -> None:
        """将检查点保存到磁盘"""
        file_path = self._get_checkpoint_file(checkpoint.version)
        data = {
            "version": checkpoint.version,
            "timestamp": checkpoint.timestamp,
            "agent": checkpoint.agent,
            "action": checkpoint.action,
            "resume_snapshot": checkpoint.resume_snapshot,
            "operation": checkpoint.operation,
            "metadata": checkpoint.metadata,
            "checksum": checkpoint.checksum
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_from_disk(self) -> None:
        """从磁盘加载所有检查点"""
        self._checkpoints = []
        self._current_version = 0

        for file_path in sorted(self.storage_path.glob("checkpoint_v*.json")):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                checkpoint = Checkpoint(
                    version=data["version"],
                    timestamp=data["timestamp"],
                    agent=data["agent"],
                    action=data["action"],
                    resume_snapshot=data["resume_snapshot"],
                    operation=data["operation"],
                    metadata=data["metadata"],
                    checksum=data["checksum"]
                )
                self._checkpoints.append(checkpoint)
                self._current_version = max(self._current_version, checkpoint.version)
            except Exception as e:
                # 跳过损坏的文件
                continue

    def save(
        self,
        resume_snapshot: ResumeSnapshot,
        operation: Operation,
        agent: str = "manus",
        metadata: Optional[CheckpointMetadata] = None
    ) -> int:
        """
        保存当前状态快照

        Args:
            resume_snapshot: 简历快照
            operation: 操作记录
            agent: 执行操作的 Agent
            metadata: 元数据

        Returns:
            保存的版本号
        """
        self._current_version += 1
        version = self._current_version

        metadata_dict = metadata.to_dict() if metadata else {}
        checksum = self._calculate_checksum(resume_snapshot)

        checkpoint = Checkpoint(
            version=version,
            timestamp=datetime.now().isoformat(),
            agent=agent,
            action=operation.action,
            resume_snapshot=resume_snapshot.to_dict(),
            operation=operation.to_dict(),
            metadata=metadata_dict,
            checksum=checksum
        )

        self._checkpoints.append(checkpoint)
        self._current_resume = resume_snapshot

        # 保存到磁盘
        self._save_to_disk(checkpoint)

        return version

    def rollback(self, version: int) -> Optional[ResumeSnapshot]:
        """
        回滚到指定版本

        Args:
            version: 目标版本号

        Returns:
            该版本的简历快照，如果版本不存在则返回 None
        """
        for checkpoint in reversed(self._checkpoints):
            if checkpoint.version == version:
                self._current_resume = ResumeSnapshot.from_dict(checkpoint.resume_snapshot)
                return self._current_resume
        return None

    def get_version(self, version: int) -> Optional[Dict[str, Any]]:
        """
        获取指定版本的信息

        Args:
            version: 版本号

        Returns:
            版本信息字典，如果版本不存在则返回 None
        """
        for checkpoint in self._checkpoints:
            if checkpoint.version == version:
                return {
                    "version": checkpoint.version,
                    "timestamp": checkpoint.timestamp,
                    "agent": checkpoint.agent,
                    "action": checkpoint.action,
                    "operation": checkpoint.operation,
                    "metadata": checkpoint.metadata,
                    "checksum": checkpoint.checksum
                }
        return None

    def list_versions(self) -> List[Dict[str, Any]]:
        """
        列出所有版本

        Returns:
            版本信息列表
        """
        return [
            {
                "version": cp.version,
                "timestamp": cp.timestamp,
                "agent": cp.agent,
                "action": cp.action,
                "section": cp.operation.get("section"),
                "checksum": cp.checksum
            }
            for cp in self._checkpoints
        ]

    def compare(self, version1: int, version2: int) -> Optional[Dict[str, Any]]:
        """
        对比两个版本的差异

        Args:
            version1: 版本1
            version2: 版本2

        Returns:
            差异信息字典
        """
        v1_data = None
        v2_data = None

        for cp in self._checkpoints:
            if cp.version == version1:
                v1_data = cp
            if cp.version == version2:
                v2_data = cp

        if not v1_data or not v2_data:
            return None

        return {
            "version1": {
                "version": v1_data.version,
                "timestamp": v1_data.timestamp,
                "action": v1_data.action
            },
            "version2": {
                "version": v2_data.version,
                "timestamp": v2_data.timestamp,
                "action": v2_data.action
            },
            "checksum_same": v1_data.checksum == v2_data.checksum,
            "actions": [
                {"version": v1_data.version, "action": v1_data.action, "agent": v1_data.agent},
                {"version": v2_data.version, "action": v2_data.action, "agent": v2_data.agent}
            ]
        }

    def get_current_resume(self) -> Optional[ResumeSnapshot]:
        """获取当前简历快照"""
        return self._current_resume

    def get_latest_version(self) -> int:
        """获取最新版本号"""
        return self._current_version

    def clear(self) -> None:
        """清除所有检查点"""
        self._checkpoints = []
        self._current_version = 0
        self._current_resume = None

        # 删除磁盘文件
        for file_path in self.storage_path.glob("checkpoint_v*.json"):
            file_path.unlink()

    def get_version_count(self) -> int:
        """获取版本总数"""
        return len(self._checkpoints)

    def has_changes_since(self, version: int) -> bool:
        """
        检查自指定版本后是否有变化

        Args:
            version: 版本号

        Returns:
            是否有变化
        """
        target_checksum = None
        for cp in self._checkpoints:
            if cp.version == version:
                target_checksum = cp.checksum
                break

        if target_checksum is None:
            return False

        # 检查后续版本是否有不同的 checksum
        for cp in self._checkpoints:
            if cp.version > version and cp.checksum != target_checksum:
                return True

        return False

    def get_resume_at_version(self, version: int) -> Optional[ResumeSnapshot]:
        """
        获取指定版本的简历快照

        Args:
            version: 版本号

        Returns:
            简历快照
        """
        for cp in self._checkpoints:
            if cp.version == version:
                return ResumeSnapshot.from_dict(cp.resume_snapshot)
        return None

    def delete_version(self, version: int) -> bool:
        """
        删除指定版本

        Args:
            version: 版本号

        Returns:
            是否删除成功
        """
        for i, cp in enumerate(self._checkpoints):
            if cp.version == version:
                self._checkpoints.pop(i)

                # 删除磁盘文件
                file_path = self._get_checkpoint_file(version)
                if file_path.exists():
                    file_path.unlink()

                return True
        return False

    def export_history(self) -> str:
        """
        导出完整历史记录为 JSON 字符串

        Returns:
            JSON 字符串
        """
        history = [
            {
                "version": cp.version,
                "timestamp": cp.timestamp,
                "agent": cp.agent,
                "action": cp.action,
                "operation": cp.operation,
                "metadata": cp.metadata,
                "checksum": cp.checksum
            }
            for cp in self._checkpoints
        ]
        return json.dumps(history, ensure_ascii=False, indent=2)

    def import_history(self, json_str: str) -> int:
        """
        从 JSON 字符串导入历史记录

        Args:
            json_str: JSON 字符串

        Returns:
            导入的版本数量
        """
        try:
            history = json.loads(json_str)
            count = 0

            for item in history:
                checkpoint = Checkpoint(
                    version=item["version"],
                    timestamp=item["timestamp"],
                    agent=item["agent"],
                    action=item["action"],
                    resume_snapshot=item["resume_snapshot"],
                    operation=item["operation"],
                    metadata=item["metadata"],
                    checksum=item["checksum"]
                )

                # 避免重复
                if not any(cp.version == checkpoint.version for cp in self._checkpoints):
                    self._checkpoints.append(checkpoint)
                    self._save_to_disk(checkpoint)
                    count += 1

            # 更新当前版本号
            if self._checkpoints:
                self._current_version = max(cp.version for cp in self._checkpoints)

            return count
        except Exception:
            return 0
