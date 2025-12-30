"""
MessageBuilder - 消息构建器

提供标准化的响应消息格式，确保前后端一致性。

消息类型：
- text: 普通文本回复
- tool_call: 工具调用信息
- tool_result: 工具执行结果
- clarify: 澄清请求（缺少信息时）
- error: 错误信息
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum
import time
import uuid


class MessageType(str, Enum):
    """消息类型"""
    TEXT = "text"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    CLARIFY = "clarify"
    ERROR = "error"


@dataclass
class AgentMessage:
    """Agent 响应消息"""
    type: MessageType
    content: str
    session_id: str = ""
    tool_call: Optional[Dict[str, Any]] = None
    tool_result: Optional[Dict[str, Any]] = None
    thinking: Optional[str] = None  # 思考过程
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    message_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        result = {
            "type": self.type.value,
            "content": self.content,
            "session_id": self.session_id,
            "message_id": self.message_id,
            "timestamp": self.timestamp
        }
        
        if self.tool_call:
            result["tool_call"] = self.tool_call
        
        if self.tool_result:
            result["tool_result"] = self.tool_result
        
        if self.thinking:
            result["thinking"] = self.thinking
        
        if self.metadata:
            result["metadata"] = self.metadata
        
        return result


class MessageBuilder:
    """
    消息构建器
    
    提供清晰的工厂方法创建标准化消息
    """
    
    @staticmethod
    def text(content: str, session_id: str = "", **metadata) -> AgentMessage:
        """创建普通文本消息"""
        return AgentMessage(
            type=MessageType.TEXT,
            content=content,
            session_id=session_id,
            metadata=metadata
        )
    
    @staticmethod
    def tool_call(
        tool_name: str,
        tool_params: Dict[str, Any],
        description: str = "",
        session_id: str = "",
        **metadata
    ) -> AgentMessage:
        """创建工具调用消息"""
        return AgentMessage(
            type=MessageType.TOOL_CALL,
            content=description or f"调用工具: {tool_name}",
            session_id=session_id,
            tool_call={
                "name": tool_name,
                "params": tool_params
            },
            metadata=metadata
        )
    
    @staticmethod
    def tool_result(
        tool_name: str,
        success: bool,
        result: Any,
        reply: str,
        tool_params: Optional[Dict[str, Any]] = None,
        session_id: str = "",
        **metadata
    ) -> AgentMessage:
        """创建工具执行结果消息"""
        return AgentMessage(
            type=MessageType.TOOL_RESULT,
            content=reply,
            session_id=session_id,
            tool_call={
                "name": tool_name,
                "params": tool_params or {}
            } if tool_params else None,
            tool_result={
                "success": success,
                "data": result
            },
            metadata=metadata
        )
    
    @staticmethod
    def clarify(
        prompt: str,
        module: str,
        intent: str,
        collected_data: Dict[str, Any],
        missing_fields: List[str],
        session_id: str = "",
        **metadata
    ) -> AgentMessage:
        """创建澄清请求消息"""
        return AgentMessage(
            type=MessageType.CLARIFY,
            content=prompt,
            session_id=session_id,
            metadata={
                "intent": intent,
                "module": module,
                "collected_data": collected_data,
                "missing_fields": missing_fields,
                **metadata
            }
        )
    
    @staticmethod
    def error(
        message: str,
        error_type: str = "general",
        session_id: str = "",
        **metadata
    ) -> AgentMessage:
        """创建错误消息"""
        return AgentMessage(
            type=MessageType.ERROR,
            content=message,
            session_id=session_id,
            metadata={
                "error_type": error_type,
                **metadata
            }
        )
    
    # ============ 便捷方法 ============
    
    @staticmethod
    def success_add(module: str, data: Dict[str, Any], session_id: str = "") -> AgentMessage:
        """添加成功消息"""
        module_names = {
            "workExperience": "工作经历",
            "education": "教育经历",
            "skills": "技能",
            "projects": "项目经历",
            "basic": "基本信息"
        }
        module_name = module_names.get(module, module)
        
        # 生成描述
        if module == "workExperience":
            desc = f"在{data.get('company', '')}担任{data.get('position', '')}"
        elif module == "education":
            desc = f"在{data.get('school', '')}学习{data.get('major', '')}"
        else:
            desc = ""
        
        reply = f"已为您添加{module_name}"
        if desc:
            reply += f"：{desc}"
        
        return MessageBuilder.tool_result(
            tool_name="CVEditor",
            success=True,
            result={"action": "add", "module": module, "data": data},
            reply=reply,
            tool_params={"path": module, "action": "add", "value": data},
            session_id=session_id,
            module=module
        )
    
    @staticmethod
    def success_update(module: str, path: str, old_value: Any, new_value: Any, session_id: str = "") -> AgentMessage:
        """更新成功消息"""
        return MessageBuilder.tool_result(
            tool_name="CVEditor",
            success=True,
            result={"action": "update", "path": path, "old": old_value, "new": new_value},
            reply=f"已更新：{new_value}",
            tool_params={"path": path, "action": "update", "value": new_value},
            session_id=session_id,
            module=module
        )
    
    @staticmethod
    def success_delete(module: str, description: str, session_id: str = "") -> AgentMessage:
        """删除成功消息"""
        return MessageBuilder.tool_result(
            tool_name="CVEditor",
            success=True,
            result={"action": "delete", "module": module},
            reply=f"已删除{description}",
            tool_params={"path": module, "action": "delete"},
            session_id=session_id,
            module=module
        )
    
    @staticmethod
    def success_read(module: str, data: Any, session_id: str = "", path: str = None) -> AgentMessage:
        """读取成功消息"""
        module_names = {
            "workExperience": "工作经历",
            "education": "教育经历",
            "skills": "技能",
            "projects": "项目经历",
            "basic": "基本信息"
        }
        module_name = module_names.get(module, module)
        
        # 如果是读取具体字段（如 basic.name），使用更简洁的格式
        if path and "." in path and path != module:
            # 读取具体字段，直接显示值
            if data is None:
                reply = f"该字段暂无数据"
            elif isinstance(data, (str, int, float, bool)):
                reply = f"{data}"
            else:
                reply = f"{data}"
        else:
            # 格式化数据展示
            if isinstance(data, list):
                if len(data) == 0:
                    reply = f"您还没有{module_name}记录"
                else:
                    reply = f"您的{module_name}：\n" + MessageBuilder._format_list_data(module, data)
            elif isinstance(data, dict):
                reply = f"您的{module_name}：\n" + MessageBuilder._format_dict_data(data)
            elif data is None:
                reply = f"您还没有{module_name}记录"
            else:
                reply = f"您的{module_name}：{data}"
        
        return MessageBuilder.tool_result(
            tool_name="CVReader",
            success=True,
            result=data,
            reply=reply,
            tool_params={"path": path or module},
            session_id=session_id,
            module=module
        )
    
    @staticmethod
    def need_more_info(
        module: str,
        intent: str,
        collected: Dict[str, Any],
        missing: List[str],
        session_id: str = ""
    ) -> AgentMessage:
        """需要更多信息消息"""
        # 字段中文名映射
        field_names = {
            "company": "公司",
            "position": "职位",
            "startDate": "开始时间",
            "endDate": "结束时间",
            "description": "工作描述",
            "school": "学校",
            "major": "专业",
            "degree": "学历",
            "name": "名称"
        }
        
        # 构建已收集信息
        collected_str = ""
        if collected:
            collected_items = [f"{field_names.get(k, k)}={v}" for k, v in collected.items() if v]
            if collected_items:
                collected_str = f"已识别：{', '.join(collected_items)}。"
        
        # 构建缺失字段提示
        missing_str = "、".join([field_names.get(f, f) for f in missing])
        
        prompt = f"{collected_str}请补充：{missing_str}"
        
        return MessageBuilder.clarify(
            prompt=prompt,
            module=module,
            intent=intent,
            collected_data=collected,
            missing_fields=missing,
            session_id=session_id
        )
    
    @staticmethod
    def unknown_intent(session_id: str = "") -> AgentMessage:
        """无法识别意图消息"""
        return MessageBuilder.text(
            content="抱歉，我不太理解您的意思。您可以尝试：\n"
                    "- 添加工作经历：「添加一段在XX公司的工作经历」\n"
                    "- 修改信息：「把名字改成张三」\n"
                    "- 查看信息：「查看我的教育经历」",
            session_id=session_id
        )
    
    # ============ 私有方法 ============
    
    @staticmethod
    def _format_list_data(module: str, data: List[Dict]) -> str:
        """格式化列表数据"""
        lines = []
        for i, item in enumerate(data, 1):
            if module == "workExperience":
                line = f"{i}. {item.get('company', '')} - {item.get('position', '')} ({item.get('startDate', '')} ~ {item.get('endDate', '')})"
            elif module == "education":
                line = f"{i}. {item.get('school', '')} - {item.get('major', '')} ({item.get('degree', '')})"
            elif module == "skills":
                line = f"{i}. {item.get('name', '')}"
            elif module == "projects":
                line = f"{i}. {item.get('name', '')} - {item.get('description', '')[:30]}..."
            else:
                line = f"{i}. {item}"
            lines.append(line)
        return "\n".join(lines)
    
    @staticmethod
    def _format_dict_data(data: Dict) -> str:
        """格式化字典数据"""
        lines = []
        for k, v in data.items():
            if v:
                lines.append(f"- {k}: {v}")
        return "\n".join(lines)

