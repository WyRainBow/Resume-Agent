"""
CVAgent - 核心对话 Agent

参考架构：sophia-pro/backend/agent/src/amplift/amplift_agent.py

分层架构：
1. 规则层（IntentRecognizer）：快速、低成本，处理常见场景
2. LLM 层：作为兜底，处理复杂/模糊场景

负责：
1. 接收用户消息，返回响应
2. 维护对话状态（AgentState）
3. 协调意图识别和工具执行
4. 生成标准化响应
"""
import json
import os
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
import httpx

from .agent_state import AgentState, PendingTask
from .chat_state import IntentType  # 保留 IntentType 兼容
from .message_builder import MessageBuilder, AgentMessage, MessageType
from .intent_recognizer import IntentRecognizer, RecognitionResult
from .tool_executor import ToolExecutor, ExecutionResult
from .tool_hooks import ToolStatusHook, LoggingToolHook


# ============================================================================
# LLM 工具定义（OpenAI Function Calling 格式）
# ============================================================================

LLM_TOOLS_DEFINITION = [
    {
        "type": "function",
        "function": {
            "name": "CVReader",
            "description": "读取简历数据。路径: basic.name(姓名), education(教育), workExperience(工作经历)",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "字段路径，如 'basic.name', 'workExperience'"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "CVEditor",
            "description": "编辑简历。update=修改, add=添加, delete=删除",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "路径，如 'basic.name', 'workExperience', 'skills'"},
                    "action": {"type": "string", "enum": ["update", "add", "delete"], "description": "操作类型：update=修改字段值, add=添加新项, delete=删除项"},
                    "value": {
                        "description": "新值。根据 path 和 action 不同：\n- update basic.name: 字符串（如'张三'）\n- update skills: HTML字符串（如'<ul><li>...</li></ul>'）或纯文本（会自动格式化）\n- add workExperience: 对象 {company, position, startDate, endDate, description}\n- add projects: 对象 {name, description, role, startDate, endDate}\n- 列表格式转换: 字符串 '改成有序列表' 或 '改成无序列表'",
                        "oneOf": [
                            {"type": "string"},
                            {"type": "object"}
                        ]
                    }
                },
                "required": ["path", "action"],
                "allOf": [
                    {
                        "if": {"properties": {"action": {"const": "update"}}},
                        "then": {"required": ["value"]}
                    },
                    {
                        "if": {"properties": {"action": {"const": "add"}}},
                        "then": {"required": ["value"]}
                    }
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "CVBatchEditor",
            "description": "批量编辑简历。一次执行多个编辑操作，包括修改(update)、添加(add)、删除(delete)。适用于需要同时修改多个字段的场景。",
            "parameters": {
                "type": "object",
                "properties": {
                    "operations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "path": {"type": "string", "description": "JSON路径，如 'basic.name', 'education[0].school'"},
                                "action": {"type": "string", "enum": ["update", "add", "delete"], "description": "操作类型"},
                                "value": {"description": "新值（update/add时必需）"}
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
]

LLM_SYSTEM_PROMPT = """你是简历编辑助手。有三个工具：CVReader（读取）、CVEditor（编辑）和 CVBatchEditor（批量编辑）。

## 核心原则
1. **提取所有信息**：从用户输入中提取全部可用信息，特别是描述/职责
2. **直接调用工具**：不要问用户补充信息，能提取多少用多少
3. **保留完整描述**：description 字段要保留用户输入的完整内容
4. **格式化描述**：对于长描述，需要格式化为HTML列表格式（`<ul><li>...</li></ul>`），按逻辑分段
5. **区分工作经历和项目经历**：
   - 工作经历（workExperience）：在公司/组织的工作，有明确的公司名称、职位、时间
     - 关键词：工作、实习、就职、任职、在XX公司/部门
     - 示例：「在腾讯云工作」、「我在深言科技做AI应用开发实习生」
   - 项目经历（projects）：具体项目，有项目名称、项目描述、技术栈等
     - 关键词：项目、项目经历、项目描述、开发了XX系统/业务
     - 示例：「添加项目经历：腾讯云域名注册业务」、「开发了AI搜索系统」
   - 重要：如果用户说"腾讯云域名注册业务"，这是项目名称，应该添加到 projects，不是 workExperience

## 字段说明
- basic: name(姓名), phone, email, title(职位)
- workExperience: company(公司), position(职位), startDate(YYYY-MM), endDate(YYYY-MM), description(工作描述/职责，HTML格式)
- projects: name(项目名称), description(项目描述，HTML格式), role(角色), startDate, endDate, techStack(技术栈)
- education: school, major, degree, startDate, endDate
- skills: 顶层字段，HTML格式字符串，如 `<ul><li><strong>后端：</strong> Java、Golang</li><li><strong>数据库：</strong> MySQL、Redis</li></ul>`

## 描述格式化规则
- **短描述**（< 100字）：直接使用纯文本
- **长描述**（≥ 100字）：必须格式化为HTML列表
  - **有序列表**（`<ol>`）：当描述包含编号（1. 2. 3. 或 1.1、1.2 等）时，使用有序列表
  - **无序列表**（`<ul>`）：当描述只有项目符号（-、•）或段落时，使用无序列表
  - 按段落、编号、项目符号等自然分段
  - 每个段落/要点转换为一个 `<li>` 项
  - 保留原文的层次结构（如 1.1、1.2 等子项，使用嵌套 `<ol>`）
  - 示例（有序列表）：`<ol><li>第一项内容</li><li>第二项内容</li></ol>`
  - 示例（无序列表）：`<ul><li>第一段内容</li><li>第二段内容</li></ul>`

## 工作经历示例

用户输入：「在深言科技工作，2022-2026，负责AI搜索系统开发，包括意图识别、多源检索、RAG生成」
调用：CVEditor(path="workExperience", action="add", value={
  "company": "深言科技",
  "position": "AI搜索工程师",
  "startDate": "2022-01",
  "endDate": "2026-01",
  "description": "负责AI搜索系统开发，包括意图识别、多源检索、RAG生成"
})

## 项目经历示例（长描述格式化 - 有序列表）

用户输入：「添加项目经历：腾讯云域名注册业务。负责腾讯云域名注册业务的开发：参与实现了域名注册黑白名单的专项设计、搜索服务的拆分、风险SQL专项治理。1. 搜索服务拆分专项 针对域名Check查询挤占连接资源导致核心业务超时问题、主导服务架构拆分。1.1. 方案设计: 按读/写属性垂直拆分EPP服务为读写两个独立集群、配置物理隔离连接池。1.2. 容灾设计: 设计公共备用集群作为容灾方案。2. 域名黑白名单专项 针对域名秒杀抢注、溢价域名交易、恶意API攻击等核心业务场景、从0到1实现了域名黑白名单模块，提供统一的名单管控。2.1. 多级缓存架构：构建"SDK本地缓存 + Redis分布式缓存"架构、通过Guava Cache和5秒过期策略，支撑近万QPS峰值、本地缓存命中率97%以上。」

调用：CVEditor(path="projects", action="add", value={
  "name": "腾讯云域名注册业务",
  "description": "<ol><li>负责腾讯云域名注册业务的开发：参与实现了域名注册黑白名单的专项设计、搜索服务的拆分、风险SQL专项治理。</li><li><strong>搜索服务拆分专项</strong> 针对域名Check查询挤占连接资源导致核心业务超时问题、主导服务架构拆分。<ol><li>方案设计: 按读/写属性垂直拆分EPP服务为读写两个独立集群、配置物理隔离连接池。</li><li>容灾设计: 设计公共备用集群作为容灾方案。</li></ol></li><li><strong>域名黑白名单专项</strong> 针对域名秒杀抢注、溢价域名交易、恶意API攻击等核心业务场景、从0到1实现了域名黑白名单模块，提供统一的名单管控。<ol><li>多级缓存架构：构建"SDK本地缓存 + Redis分布式缓存"架构、通过Guava Cache和5秒过期策略，支撑近万QPS峰值、本地缓存命中率97%以上。</li></ol></li></ol>",
  "role": "后端开发工程师"
})

注意：当描述包含编号（1. 2. 3. 或 1.1、1.2）时，使用有序列表 `<ol>`，而不是无序列表 `<ul>`。

## 专业技能示例

用户输入：「把skills更新为：后端：熟悉 Java 编程语言、Golang 编程语言等原理。数据库：熟悉 MySQL、MongoDB、ES、Milvus 等主流数据库原理。有非常优秀的 SQL 调优经验。Redis：熟悉 Redis 底层数据结构、分布式锁等机制。」

调用：CVEditor(path="skills", action="update", value="<ul><li><strong>后端：</strong> 熟悉 Java 编程语言、Golang 编程语言等原理</li><li><strong>数据库：</strong> 熟悉 MySQL、MongoDB、ES、Milvus 等主流数据库原理。有非常优秀的 SQL 调优经验</li><li><strong>Redis：</strong> 熟悉 Redis 底层数据结构、分布式锁等机制</li></ul>")

## 列表格式转换规则

**重要**：进行列表格式转换时，系统会自动读取现有内容并转换。你只需要调用 CVEditor，value 设置为 "改成有序列表" 或 "改成无序列表"。

用户输入：「把第一条项目经历的描述改成有序列表」
调用：CVEditor(path="projects[0].description", action="update", value="改成有序列表")

用户输入：「把专业技能改成有序列表」
调用：CVEditor(path="skills", action="update", value="改成有序列表")

**重要：模糊格式转换指令的上下文推断**
如果用户只说"改成有序列表"或"改成无序列表"而没有明确指定字段（如"把专业技能改成有序列表"），你需要根据对话上下文推断：
- 如果最近的操作涉及某个字段（如刚刚更新了 skills），就对该字段进行格式转换
- 如果对话历史中提到某个字段（如"专业技能"、"工作经历"等），就对该字段进行格式转换
- 如果无法确定，可以询问用户，但优先根据上下文推断

示例：
- 用户：「把skills更新为：后端：熟悉Java。数据库：熟悉MySQL。」
- 用户：「改成有序列表」（模糊指令）
- 推断：用户想对刚刚更新的 skills 字段进行格式转换
- 调用：CVEditor(path="skills", action="update", value="改成有序列表")

用户输入：「把专业技能改成HTML无序列表格式」
- **重要**：这种情况需要基于"当前简历数据"中的 skills 内容来生成 HTML。
- 简历摘要会告诉你当前 skills 的内容，请基于这个内容生成 HTML 列表。
- 如果当前 skills 是纯文本，需要将其转换为 `<ul><li>...</li></ul>` 格式。
- 示例：如果简历摘要显示"专业技能内容:后端：熟悉Java。数据库：熟悉MySQL。"
- 调用：CVEditor(path="skills", action="update", value="<ul><li><strong>后端：</strong>熟悉Java</li><li><strong>数据库：</strong>熟悉MySQL</li></ul>")

## 其他示例
「把名字改成张三」→ CVEditor(path="basic.name", action="update", value="张三")
「查看工作经历」→ CVReader(path="workExperience")

## CVBatchEditor 使用场景
当用户需要同时修改多个字段时，使用 CVBatchEditor 更高效：
「把名字改成张三，电话改成13800138000，邮箱改成test@example.com」→ CVBatchEditor(operations=[
  {"path": "basic.name", "action": "update", "value": "张三"},
  {"path": "basic.phone", "action": "update", "value": "13800138000"},
  {"path": "basic.email", "action": "update", "value": "test@example.com"}
])

## CVReader 使用规则（重要！）
当调用 CVReader 获取数据后：
1. **必须使用工具返回的实际数据**，不要使用你的"记忆"或猜测
2. **直接引用返回的 JSON 内容**作为答案
3. 如果工具返回的数据与你之前记忆的不同，**以工具返回的为准**
4. 示例：如果 CVReader 返回 `{"skills": "：后端：熟悉Java。数据库：熟悉MySQL。"}`
   - 正确回答："当前的专业技能是：后端：熟悉Java。数据库：熟悉MySQL。"
   - 错误回答：不要说"前端技术：React"（这是旧数据）

## 重要
- description 字段：保留用户输入的**完整原文**，但需要格式化为HTML列表（长描述）
  - **有编号（1. 2. 3. 或 1.1、1.2）**：使用有序列表 `<ol>`
  - **无编号（只有段落或项目符号）**：使用无序列表 `<ul>`
  - **列表格式转换**：当用户说"改成有序列表"或"改成无序列表"时，读取现有描述，替换 `<ul>`/`<ol>` 标签
- skills 字段：是顶层字段（不是 basic.skills），HTML格式字符串
- 时间格式：YYYY-MM（如 2022-01）
- 如果用户说"补充描述"，就更新最近一条经历的 description
- 格式化时保留原文的层次结构和编号
- **严格区分工作经历和项目经历**：项目名称（如"腾讯云域名注册业务"）应该添加到 projects，不是 workExperience"""


@dataclass
class AgentResponse:
    """Agent 响应
    
    统一的响应格式，包含：
    - message: 标准化消息
    - resume_data: 更新后的简历数据
    - resume_modified: 简历是否被修改
    """
    message: AgentMessage
    resume_data: Optional[Dict[str, Any]] = None
    resume_modified: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        result = self.message.to_dict()
        result["resume_modified"] = self.resume_modified
        if self.resume_data is not None:
            result["resume_data"] = self.resume_data
        return result


class CVAgent:
    """
    简历编辑对话 Agent
    
    架构设计（参考 sophia-pro）：
    - AgentState: 统一的状态管理
    - IntentRecognizer: 意图识别（复用 task_planner 逻辑）
    - ToolExecutor: 工具执行
    - MessageBuilder: 消息构建
    
    功能：
    1. 处理用户消息
    2. 维护对话状态（含多轮补充）
    3. 调用工具执行操作
    4. 生成标准化响应
    """
    
    def __init__(
        self, 
        resume_data: Dict[str, Any] = None, 
        session_id: str = "",
        debug: bool = False,
        enable_llm: bool = True  # 是否启用 LLM 兜底
    ):
        """
        初始化 Agent
        
        分层架构：
        - 规则层（IntentRecognizer）：快速处理常见场景
        - LLM 层：兜底处理复杂场景
        
        Args:
            resume_data: 初始简历数据
            session_id: 会话 ID
            debug: 是否启用调试日志
            enable_llm: 是否启用 LLM 兜底（规则失败时调用）
        """
        self.session_id = session_id
        self.debug = debug
        self.enable_llm = enable_llm
        
        # LLM 配置
        self.llm_api_key = os.getenv("DEEPSEEK_API_KEY")
        self.llm_base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self.llm_model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        
        # 使用 AgentState 统一管理状态
        self.state = AgentState(resume_data=resume_data, session_id=session_id)
        
        # 工具钩子（参考 sophia-pro tool_hooks）
        self.tool_hook = LoggingToolHook() if debug else None
        
        # 初始化组件
        self.recognizer = IntentRecognizer()
        self.executor = ToolExecutor(self.state.resume_data, tool_hook=self.tool_hook)
    
    # 兼容属性：resume_data
    @property
    def resume_data(self) -> Dict[str, Any]:
        return self.state.resume_data
    
    @resume_data.setter
    def resume_data(self, value: Dict[str, Any]):
        self.state.resume_data = value
        self.executor.update_resume_data(value)
    
    # 兼容属性：chat_state（指向 state）
    @property
    def chat_state(self):
        """兼容旧代码的 chat_state 访问"""
        return self.state
    
    def process_message(self, user_message: str) -> AgentResponse:
        """
        处理用户消息
        
        直接使用 LLM 处理所有请求，不再使用规则引擎。
        LLM 通过 Function Calling 调用 CVReader/CVEditor 工具。
        
        Args:
            user_message: 用户输入
        
        Returns:
            AgentResponse
        """
        # 1. 添加用户消息到历史
        self.state.add_message("user", user_message)
        
        if self.debug:
            print(f"[LLM Agent] 处理消息: {user_message[:100]}{'...' if len(user_message) > 100 else ''}")
        
        # 2. 直接调用 LLM Agent（不再使用规则引擎）
        if not (self.enable_llm and self.llm_api_key):
            # 如果没有 LLM，返回错误
            return AgentResponse(
                message=MessageBuilder.error(
                    message="LLM 未启用，无法处理请求",
                    session_id=self.session_id
                ),
                resume_data=self.state.resume_data
            )
        
        response = self._call_llm_agent(user_message)
        
        # 3. 添加助手回复到历史
        self.state.add_message(
            "assistant",
            response.message.content,
            metadata={"type": response.message.type.value}
        )
        
        return response
    
    def process_message_stream(self, user_message: str):
        """
        流式处理用户消息（生成器）
        
        直接使用 LLM 处理所有请求，不再使用规则引擎。
        
        逐步输出：
        1. thinking: 思考过程
        2. tool_call: 工具调用
        3. tool_result: 工具执行结果
        4. content: 最终回复
        5. done: 完成
        
        Args:
            user_message: 用户输入
        
        Yields:
            Dict: 事件数据
        """
        # 1. 输出：接收用户输入
        yield {
            "type": "thinking",
            "content": f"📥 接收用户输入: {user_message[:50]}{'...' if len(user_message) > 50 else ''}\n🤖 使用 LLM 处理"
        }
        
        # 2. 添加用户消息到历史
        self.state.add_message("user", user_message)
        
        # 3. 检查 LLM 是否启用
        if not (self.enable_llm and self.llm_api_key):
            yield {
                "type": "content",
                "content": "LLM 未启用，无法处理请求"
            }
            yield {"type": "done", "content": None}
            return
        
        # 4. 直接调用 LLM Agent（流式）
        for event in self._call_llm_agent_stream(user_message):
            yield event
        
        # 5. 完成
        yield {
            "type": "done",
            "content": None
        }
    
    def _handle_intent_stream(self, recognition, user_message: str):
        """流式处理意图"""
        intent = recognition.intent
        
        if intent == IntentType.READ:
            # 读取操作
            result = self.executor.execute_read(recognition.path or recognition.module)
            
            # 输出工具调用
            yield {
                "type": "tool_call",
                "content": {
                    "name": "CVReader",
                    "params": {"path": recognition.path or recognition.module}
                }
            }
            
            # 输出工具结果
            yield {
                "type": "tool_result",
                "content": result.to_dict()
            }
            
            # 构建回复
            message = MessageBuilder.success_read(
                module=recognition.module,
                path=recognition.path or recognition.module,
                value=result.result,
                session_id=self.session_id
            )
            
            # 添加助手回复到历史
            self.state.add_message(
                "assistant",
                message.content,
                metadata={"type": message.type.value}
            )
            
            yield {
                "type": "content",
                "content": message.content
            }
            
        elif intent == IntentType.ADD:
            # 添加操作（流式）
            for event in self._handle_add_stream(recognition):
                yield event
                
        elif intent == IntentType.UPDATE:
            # 更新操作
            result = self.executor.execute_update(recognition.path, recognition.extracted_data.get("value"))
            
            # 输出工具调用
            yield {
                "type": "tool_call",
                "content": {
                    "name": "CVEditor",
                    "params": {
                        "path": recognition.path,
                        "action": "update",
                        "value": recognition.extracted_data.get("value")
                    }
                }
            }
            
            # 输出工具结果
            yield {
                "type": "tool_result",
                "content": result.to_dict()
            }
            
            if result.success:
                self.state.update_resume(result.updated_resume or self.state.resume_data)
                
                message = MessageBuilder.success_update(
                    module=recognition.module,
                    path=recognition.path,
                    old_value=None,
                    new_value=recognition.extracted_data.get("value"),
                    session_id=self.session_id
                )
                
                # 添加助手回复到历史
                self.state.add_message(
                    "assistant",
                    message.content,
                    metadata={"type": message.type.value}
                )
                
                yield {
                    "type": "content",
                    "content": message.content,
                    "resume_modified": True,
                    "resume_data": self.state.resume_data
                }
            else:
                message = MessageBuilder.error(
                    message=result.error or "更新失败",
                    session_id=self.session_id
                )
                yield {
                    "type": "content",
                    "content": message.content
                }
                
        elif intent == IntentType.DELETE:
            # 删除操作
            result = self.executor.execute_delete(recognition.path)
            
            # 输出工具调用
            yield {
                "type": "tool_call",
                "content": {
                    "name": "CVEditor",
                    "params": {
                        "path": recognition.path,
                        "action": "delete"
                    }
                }
            }
            
            # 输出工具结果
            yield {
                "type": "tool_result",
                "content": result.to_dict()
            }
            
            if result.success:
                self.state.update_resume(result.updated_resume or self.state.resume_data)
                
                message = MessageBuilder.success_delete(
                    module=recognition.module,
                    path=recognition.path,
                    deleted_value=result.result,
                    session_id=self.session_id
                )
                
                # 添加助手回复到历史
                self.state.add_message(
                    "assistant",
                    message.content,
                    metadata={"type": message.type.value}
                )
                
                yield {
                    "type": "content",
                    "content": message.content,
                    "resume_modified": True,
                    "resume_data": self.state.resume_data
                }
            else:
                message = MessageBuilder.error(
                    message=result.error or "删除失败",
                    session_id=self.session_id
                )
                yield {
                    "type": "content",
                    "content": message.content
                }
                
        elif intent == IntentType.CLARIFY:
            # 需要澄清
            message = MessageBuilder.clarify(
                message=recognition.clarify_message or "需要更多信息",
                missing_fields=recognition.missing_fields or [],
                session_id=self.session_id
            )
            
            # 添加助手回复到历史
            self.state.add_message(
                "assistant",
                message.content,
                metadata={"type": message.type.value}
            )
            
            yield {
                "type": "content",
                "content": message.content,
                "metadata": {
                    "intent": "add",
                    "module": recognition.module,
                    "missing_fields": recognition.missing_fields or []
                }
            }
            
        else:
            # 未知意图，使用 LLM 兜底
            for event in self._call_llm_agent_stream(user_message):
                yield event
    
    def _handle_add_stream(self, recognition: RecognitionResult):
        """流式处理添加操作"""
        module = recognition.module
        extracted_data = recognition.extracted_data or {}
        
        # 检查缺失字段
        missing_fields = self._check_missing_fields(module, extracted_data)
        
        if missing_fields:
            # 需要补充信息
            message = MessageBuilder.clarify(
                message=self.recognizer.build_clarify_prompt(module, extracted_data, missing_fields),
                missing_fields=missing_fields,
                session_id=self.session_id
            )
            
            # 添加助手回复到历史
            self.state.add_message(
                "assistant",
                message.content,
                metadata={"type": message.type.value}
            )
            
            yield {
                "type": "content",
                "content": message.content,
                "metadata": {
                    "intent": "add",
                    "module": module,
                    "missing_fields": missing_fields
                }
            }
        else:
            # 信息完整，执行添加
            if module == "basic":
                result = self.executor.execute_update("basic", extracted_data)
            else:
                result = self.executor.execute_add(module, extracted_data)
            
            # 输出工具调用
            yield {
                "type": "tool_call",
                "content": {
                    "name": "CVEditor",
                    "params": {
                        "path": module if module != "basic" else "basic",
                        "action": "update" if module == "basic" else "add",
                        "value": extracted_data
                    }
                }
            }
            
            # 输出工具结果
            yield {
                "type": "tool_result",
                "content": result.to_dict()
            }
            
            if result.success:
                self.state.update_resume(result.updated_resume or self.state.resume_data)
                
                message = MessageBuilder.success_add(
                    module=module,
                    data=extracted_data,
                    session_id=self.session_id
                )
                
                # 添加助手回复到历史
                self.state.add_message(
                    "assistant",
                    message.content,
                    metadata={"type": message.type.value}
                )
                
                yield {
                    "type": "content",
                    "content": message.content,
                    "resume_modified": True,
                    "resume_data": self.state.resume_data
                }
            else:
                message = MessageBuilder.error(
                    message=result.error or "添加失败",
                    session_id=self.session_id
                )
                yield {
                    "type": "content",
                    "content": message.content
                }
    
    def _call_llm_agent_stream(self, user_message: str):
        """流式调用 LLM Agent（直接使用 LLM，不再使用规则引擎）"""
        # 构建消息（包含对话历史）
        messages = [{"role": "system", "content": LLM_SYSTEM_PROMPT}]

        # 添加对话历史和当前消息（使用优化后的上下文管理）
        resume_summary = self._get_resume_summary()
        context_messages = self.state.get_context_for_llm(
            current_message=user_message,
            resume_summary=resume_summary
        )
        messages.extend(context_messages)

        if self.debug:
            print(f"[LLM 流式] 历史消息: {len(self.state.chat_history)}条, 发送: {len(context_messages)}条")
            print(f"[LLM 流式] 简历摘要: {resume_summary[:150]}...")

        # 输出：正在处理（只发送一次 thinking 消息）
        yield {
            "type": "thinking",
            "content": "📥 接收用户输入: {}\n🤖 使用 LLM 处理".format(
                user_message[:50] + ('...' if len(user_message) > 50 else '')
            ),
            "session_id": self.session_id
        }

        # 流式调用 LLM
        accumulated_content = ""
        tool_calls = []
        tool_call_ids = {}  # 用于跟踪工具调用 ID
        has_sent_tool_recognition = False  # 标记是否已发送工具识别消息
        last_content_update_len = 0  # 上次发送内容更新时的长度

        for chunk in self._call_llm_api_stream(messages, tools=LLM_TOOLS_DEFINITION):
            if not chunk:
                continue

            delta = chunk.get("choices", [{}])[0].get("delta", {})

            # 检查是否有工具调用
            if "tool_calls" in delta:
                for tool_call_delta in delta["tool_calls"]:
                    index = tool_call_delta.get("index", 0)

                    # 初始化工具调用对象
                    if index not in tool_call_ids:
                        tool_call_id = tool_call_delta.get("id", f"call_{index}")
                        tool_call_ids[index] = tool_call_id
                        tool_calls.append({
                            "id": tool_call_id,
                            "type": "function",
                            "function": {"name": "", "arguments": ""}
                        })

                    # 更新工具调用信息
                    if "function" in tool_call_delta:
                        func_delta = tool_call_delta["function"]
                        if "name" in func_delta:
                            tool_calls[index]["function"]["name"] = func_delta["name"]
                            # 检测到工具名称后，立即发送 thinking 更新
                            if not has_sent_tool_recognition:
                                has_sent_tool_recognition = True
                                yield {
                                    "type": "thinking",
                                    "content": f"📥 接收用户输入: {user_message[:50]}{'...' if len(user_message) > 50 else ''}\n🤖 使用 LLM 处理\n🔧 准备调用工具: {func_delta['name']}",
                                    "session_id": self.session_id
                                }
                        if "arguments" in func_delta:
                            tool_calls[index]["function"]["arguments"] += func_delta["arguments"]

            # 检查是否有文本内容（只在工具调用之前输出，工具调用时不再输出文本）
            if "content" in delta and delta["content"] and not tool_calls:
                content_chunk = delta["content"]
                accumulated_content += content_chunk
                
                # 每收到内容就发送更新（实现真正的流式输出）
                # 减少发送频率：每 10 个字符发送一次，或者收到标点符号时发送
                if (len(accumulated_content) - last_content_update_len >= 10 or 
                    content_chunk in '。！？，、；：""''【】（）\n'):
                    last_content_update_len = len(accumulated_content)
                    yield {
                        "type": "content_chunk",
                        "content": accumulated_content,
                        "session_id": self.session_id
                    }

        # 构建完整的消息
        if tool_calls:
            # 有工具调用
            message = {
                "role": "assistant",
                "tool_calls": tool_calls
            }

            # 处理工具调用（流式）
            for event in self._handle_llm_tool_calls_stream(message, messages, user_message):
                yield event
        else:
            # 纯文本回复
            content = accumulated_content or "抱歉，我不太理解您的意思"

            # 添加助手回复到历史
            self.state.add_message(
                "assistant",
                content,
                metadata={"type": "text"}
            )

            yield {
                "type": "content",
                "content": content
            }
    
    def _handle_llm_tool_calls_stream(self, llm_message: Dict, messages: List[Dict], user_message: str):
        """流式处理 LLM 工具调用"""
        import time as time_module
        resume_modified = False
        tool_call_info = None
        has_clarify = False  # 是否有澄清请求
        clarify_data = None  # 澄清数据

        for tool_call in llm_message["tool_calls"]:
            func = tool_call["function"]
            tool_name = func["name"]
            tool_params = json.loads(func.get("arguments", "{}"))

            # 输出工具调用参数
            tool_call_info = {
                "name": tool_name,
                "params": tool_params
            }
            yield {
                "type": "tool_call",
                "content": tool_call_info,
                "session_id": self.session_id
            }

            # 输出：工具开始执行（新增）
            yield {
                "type": "tool_start",
                "content": {
                    "tool_name": tool_name,
                    "action": tool_params.get("action", ""),
                    "path": tool_params.get("path", "")
                },
                "session_id": self.session_id
            }

            # 执行工具（计时）
            start_time = time_module.time()
            result = self._execute_llm_tool(tool_name, tool_params)
            duration_ms = int((time_module.time() - start_time) * 1000)

            # 将 duration_ms 添加到 result 中
            result["duration_ms"] = duration_ms

            # 输出工具结果
            yield {
                "type": "tool_result",
                "content": result,
                "session_id": self.session_id
            }

            # 输出：工具执行结束（新增）
            yield {
                "type": "tool_end",
                "content": {
                    "tool_name": tool_name,
                    "success": result.get("success", False),
                    "duration_ms": duration_ms
                },
                "session_id": self.session_id
            }

            # ========== 澄清能力检测 ==========
            # 如果工具返回的是澄清错误（信息不完整）
            if not result.get("success") and result.get("error_type") == "clarify":
                has_clarify = True
                clarify_data = {
                    "module": result.get("module"),
                    "collected_data": result.get("collected_data"),
                    "missing_fields": result.get("missing_fields"),
                    "missing_fields_names": result.get("missing_fields_names"),
                    "prompt": result.get("prompt")
                }
                break  # 停止处理后续工具调用，直接返回澄清请求

            # 输出：工具执行完成（thinking 消息，保留兼容）
            path_info = tool_params.get("path", "N/A")
            status = "✅ 成功" if result.get("success") else "❌ 失败"
            yield {
                "type": "thinking",
                "content": "📥 接收用户输入: {}\n🤖 使用 LLM 处理\n{} 工具执行完成: {} ({})".format(
                    user_message[:50] + ('...' if len(user_message) > 50 else ''),
                    status,
                    tool_name,
                    path_info
                ),
                "session_id": self.session_id
            }

            # 检查是否修改了简历
            if tool_name == "CVEditor" and result.get("success"):
                resume_modified = True

            # 添加工具调用和结果到消息
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [tool_call]
            })
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "content": json.dumps(result, ensure_ascii=False)
            })

        # 如果有澄清请求，发送澄清消息后返回
        if has_clarify and clarify_data:
            yield {
                "type": "clarify",
                "content": clarify_data,
                "session_id": self.session_id
            }
            return

        # 第二次调用 LLM（继续允许工具调用）
        response = self._call_llm_api(messages, tools=LLM_TOOLS_DEFINITION)
        if response:
            next_message = response["choices"][0]["message"]

            # 检查是否还有工具调用（支持多轮工具调用链）
            if next_message.get("tool_calls"):
                # 递归处理下一轮工具调用
                for event in self._handle_llm_tool_calls_stream(next_message, messages, user_message):
                    yield event
                return

            final_reply = next_message.get("content", "操作完成")
        else:
            final_reply = "已为您处理"

        # 添加助手回复到历史
        self.state.add_message(
            "assistant",
            final_reply,
            metadata={"type": "text"}
        )

        yield {
            "type": "content",
            "content": final_reply,
            "resume_modified": resume_modified,
            "resume_data": self.state.resume_data if resume_modified else None,
            "session_id": self.session_id
        }
    
    def _should_use_llm(self, user_message: str) -> bool:
        """
        判断是否应该直接使用 LLM
        
        条件：
        1. LLM 已启用且有 API Key
        2. 输入长度超过阈值（150字符）
        3. 或者：输入包含特定关键词（需要 LLM 理解和格式化）
        """
        if not (self.enable_llm and self.llm_api_key):
            return False
        
        # 长输入直接交给 LLM（规则层难以处理长描述）
        if len(user_message) > 150:
            return True
        
        # 补充描述类请求
        supplement_keywords = ["补充描述", "添加描述", "工作描述", "项目描述", "职责描述"]
        if any(kw in user_message for kw in supplement_keywords):
            return True
        
        # 格式转换请求（需要 LLM 理解如何格式化）
        format_keywords = [
            "HTML格式", "html格式", "无序列表格式", "有序列表格式", "列表格式",
            "改成有序列表", "改成无序列表", "有序列表", "无序列表"
        ]
        if any(kw in user_message for kw in format_keywords):
            return True
        
        # 模糊的格式转换指令（如"改成有序列表"、"改成无序列表"）
        # 如果用户没有明确指定字段（如"把专业技能改成有序列表"），直接交给 LLM
        # LLM 有上下文，知道用户想改什么
        short_format_keywords = ["改成有序列表", "改成无序列表", "有序列表", "无序列表"]
        has_short_format = any(kw in user_message for kw in short_format_keywords)
        
        if has_short_format:
            # 检查是否有明确的字段路径（如"把专业技能改成有序列表"中的"专业技能"）
            # 如果没有明确的字段，交给 LLM 处理（LLM 可以根据上下文推断）
            module_keywords = [
                "专业技能", "技能", "工作经历", "项目经历", "教育经历",
                "描述", "内容", "详情", "第一条", "第二条"
            ]
            has_explicit_field = any(kw in user_message for kw in module_keywords)
            
            # 如果没有明确字段，直接交给 LLM（LLM 可以根据对话上下文推断）
            if not has_explicit_field:
                return True
        
        return False
    
    def _handle_intent(self, recognition: RecognitionResult, user_message: str) -> AgentResponse:
        """处理识别结果"""
        intent = recognition.intent
        module = recognition.module
        
        # 处理未知意图（尝试识别常见场景）
        if intent == IntentType.UNKNOWN:
            return self._handle_unknown_intent(user_message)
        
        # 处理读取意图
        if intent == IntentType.READ:
            return self._handle_read(recognition)
        
        # 处理添加意图
        if intent == IntentType.ADD:
            return self._handle_add(recognition)
        
        # 处理更新意图
        if intent == IntentType.UPDATE:
            return self._handle_update(recognition, user_message)
        
        # 处理删除意图
        if intent == IntentType.DELETE:
            return self._handle_delete(recognition)
        
        # 默认返回未知意图
        return AgentResponse(
            message=MessageBuilder.unknown_intent(self.session_id),
            resume_data=self.state.resume_data
        )
    
    def _handle_read(self, recognition: RecognitionResult) -> AgentResponse:
        """处理读取操作"""
        module = recognition.module
        path = recognition.path or module
        
        # 执行读取
        result = self.executor.execute_read(path)
        
        if result.success:
            message = MessageBuilder.success_read(
                module=module,
                data=result.result,
                session_id=self.session_id,
                path=path
            )
        else:
            message = MessageBuilder.error(
                message=result.error or "读取失败",
                session_id=self.session_id
            )
        
        return AgentResponse(
            message=message,
            resume_data=self.state.resume_data
        )
    
    def _handle_add(self, recognition: RecognitionResult) -> AgentResponse:
        """处理添加操作"""
        module = recognition.module
        extracted_data = recognition.extracted_data
        missing_fields = recognition.missing_fields
        
        # basic 模块特殊处理：使用 update 而不是 add（因为 basic 是对象，不是数组）
        if module == "basic":
            return self._handle_basic_update(extracted_data)
        
        # 检查是否需要补充信息
        if missing_fields:
            # 保存待补充任务（使用 AgentState）
            self.state.start_pending_task(
                module=module,
                intent="add",
                collected_data=extracted_data,
                missing_fields=missing_fields
            )
            
            # 返回澄清消息
            message = MessageBuilder.need_more_info(
                module=module,
                intent="add",
                collected=extracted_data,
                missing=missing_fields,
                session_id=self.session_id
            )
            
            return AgentResponse(
                message=message,
                resume_data=self.state.resume_data
            )
        
        # 信息完整，执行添加
        result = self.executor.execute_add(module, extracted_data)
        
        if result.success:
            # 清空待补充任务
            self.state.clear_pending_task()
            # 更新简历数据
            self.state.update_resume(result.updated_resume or self.state.resume_data)
            
            message = MessageBuilder.success_add(
                module=module,
                data=extracted_data,
                session_id=self.session_id
            )
            
            return AgentResponse(
                message=message,
                resume_data=self.state.resume_data,
                resume_modified=True
            )
        else:
            message = MessageBuilder.error(
                message=result.error or "添加失败",
                session_id=self.session_id
            )
            
            return AgentResponse(
                message=message,
                resume_data=self.state.resume_data
            )
    
    def _handle_basic_update(self, extracted_data: Dict[str, Any]) -> AgentResponse:
        """处理基本信息更新（basic 模块使用 update 而不是 add）"""
        # 合并到现有 basic 数据
        current_basic = self.state.resume_data.get("basic", {})
        if not isinstance(current_basic, dict):
            current_basic = {}
        
        # 更新字段（只更新非空值）
        updated_basic = {**current_basic}
        for key, value in extracted_data.items():
            if value:  # 只更新非空值
                updated_basic[key] = value
        
        # 执行更新
        result = self.executor.execute_update("basic", updated_basic)
        
        if result.success:
            self.state.update_resume(result.updated_resume or self.state.resume_data)
            
            message = MessageBuilder.success_add(
                module="basic",
                data=updated_basic,
                session_id=self.session_id
            )
            
            return AgentResponse(
                message=message,
                resume_data=self.state.resume_data,
                resume_modified=True
            )
        else:
            message = MessageBuilder.error(
                message=result.error or "更新基本信息失败",
                session_id=self.session_id
            )
            
            return AgentResponse(
                message=message,
                resume_data=self.state.resume_data
            )
    
    def _handle_update(self, recognition: RecognitionResult, user_message: str) -> AgentResponse:
        """处理更新操作"""
        module = recognition.module
        path = recognition.path
        
        # 提取要更新的值
        new_value = self.recognizer.extract_update_value(user_message)
        
        if not new_value:
            return AgentResponse(
                message=MessageBuilder.error(
                    message="请告诉我要更新成什么内容",
                    session_id=self.session_id
                ),
                resume_data=self.state.resume_data
            )
        
        if not path:
            return AgentResponse(
                message=MessageBuilder.error(
                    message="请指定要修改的字段，例如「把第一条工作经历的公司改成XXX」",
                    session_id=self.session_id
                ),
                resume_data=self.state.resume_data
            )
        
        # 特殊处理：列表格式转换
        # 如果 new_value 是"有序列表"或"无序列表"，先读取现有值，然后转换
        if isinstance(new_value, str):
            value_lower = new_value.lower()
            if "改成有序列表" in new_value or "改成无序列表" in new_value or "有序列表" in value_lower or "无序列表" in value_lower:
                # 先读取现有值
                read_result = self.executor.execute_read(path)
                if read_result.success and isinstance(read_result.result, str):
                    current_html = read_result.result
                    # 转换列表格式
                    if "有序列表" in value_lower or "改成有序列表" in new_value:
                        # ul -> ol（包括嵌套的 ul）
                        new_value = current_html.replace("<ul>", "<ol>").replace("</ul>", "</ol>")
                    else:
                        # ol -> ul（包括嵌套的 ol）
                        new_value = current_html.replace("<ol>", "<ul>").replace("</ol>", "</ul>")
                else:
                    return AgentResponse(
                        message=MessageBuilder.error(
                            message=f"无法读取路径 {path} 的现有值",
                            session_id=self.session_id
                        ),
                        resume_data=self.state.resume_data
                    )
        
        # 执行更新
        result = self.executor.execute_update(path, new_value)
        
        if result.success:
            self.state.update_resume(result.updated_resume or self.state.resume_data)
            
            message = MessageBuilder.success_update(
                module=module,
                path=path,
                old_value=None,
                new_value=new_value,
                session_id=self.session_id
            )
            
            return AgentResponse(
                message=message,
                resume_data=self.state.resume_data,
                resume_modified=True
            )
        else:
            message = MessageBuilder.error(
                message=result.error or "更新失败",
                session_id=self.session_id
            )
            
            return AgentResponse(
                message=message,
                resume_data=self.state.resume_data
            )
    
    def _handle_delete(self, recognition: RecognitionResult) -> AgentResponse:
        """处理删除操作"""
        module = recognition.module
        path = recognition.path
        index = recognition.index
        
        # 构建删除路径
        if path is None:
            if index is not None:
                path = f"{module}[{index}]"
            else:
                return AgentResponse(
                    message=MessageBuilder.error(
                        message="请指定要删除哪一条，例如「删除第一条工作经历」",
                        session_id=self.session_id
                    ),
                    resume_data=self.state.resume_data
                )
        
        # 执行删除
        result = self.executor.execute_delete(path)
        
        if result.success:
            self.state.update_resume(result.updated_resume or self.state.resume_data)
            
            # 生成描述
            module_names = {
                "workExperience": "工作经历",
                "education": "教育经历",
                "skills": "技能",
                "projects": "项目经历"
            }
            desc = f"第{index + 1}条{module_names.get(module, module)}" if index is not None else path
            
            message = MessageBuilder.success_delete(
                module=module,
                description=desc,
                session_id=self.session_id
            )
            
            return AgentResponse(
                message=message,
                resume_data=self.state.resume_data,
                resume_modified=True
            )
        else:
            message = MessageBuilder.error(
                message=result.error or "删除失败",
                session_id=self.session_id
            )
            
            return AgentResponse(
                message=message,
                resume_data=self.state.resume_data
            )
    
    def update_resume_data(self, resume_data: Dict[str, Any]) -> None:
        """更新简历数据"""
        self.state.update_resume(resume_data)
        self.executor.update_resume_data(resume_data)
    
    def get_resume_data(self) -> Dict[str, Any]:
        """获取当前简历数据"""
        return self.state.resume_data
    
    def get_chat_history(self, n: int = 10) -> list:
        """获取对话历史"""
        return self.state.get_history(n)
    
    def has_pending_task(self) -> bool:
        """是否有待补充任务"""
        return self.state.has_pending_task()
    
    def get_state_summary(self) -> Dict[str, Any]:
        """获取状态摘要（参考 sophia-pro AgentState.to_dict）"""
        pending = self.state.get_pending_task()
        return {
            "session_id": self.session_id,
            "history_count": len(self.state.chat_history),
            "history_tokens": self.state.estimate_tokens(),
            "has_context_summary": bool(self.state.get_context_summary()),
            "needs_summarization": self.state.needs_summarization(),
            "has_pending_task": self.has_pending_task(),
            "pending_module": pending.module if pending else None,
            "pending_missing": pending.missing_fields if pending else []
        }
    
    def generate_context_summary(self) -> str:
        """
        生成上下文摘要（长对话时使用）
        
        摘要内容：
        - 用户的主要操作（添加/修改/查看了什么）
        - 简历当前状态
        
        Returns:
            摘要字符串
        """
        if not self.state.chat_history:
            return ""
        
        # 简单摘要：提取用户操作
        operations = []
        for msg in self.state.chat_history:
            if msg.get("role") == "assistant":
                content = msg.get("content", "")
                # 提取关键操作
                if "添加" in content:
                    operations.append("添加了内容")
                elif "更新" in content or "修改" in content:
                    operations.append("修改了内容")
                elif "删除" in content:
                    operations.append("删除了内容")
                elif "查看" in content or "读取" in content:
                    operations.append("查看了内容")
        
        # 去重
        operations = list(dict.fromkeys(operations))
        
        if operations:
            return f"用户之前{'、'.join(operations[:3])}。"
        return ""
    
    def auto_summarize_if_needed(self) -> None:
        """自动生成摘要（如果需要）"""
        if self.state.needs_summarization():
            summary = self.generate_context_summary()
            if summary:
                self.state.update_context_summary(summary)
                if self.debug:
                    print(f"[上下文摘要] 已生成: {summary}")
    
    def get_state(self) -> AgentState:
        """获取完整状态对象"""
        return self.state
    
    def _handle_unknown_intent(self, user_message: str) -> AgentResponse:
        """
        处理未知意图
        
        分层策略：
        1. 先尝试规则匹配常见场景（打招呼、写简历等）
        2. 规则失败 → 调用 LLM 兜底
        """
        text = user_message.strip().lower()
        
        # 打招呼场景
        greeting_keywords = ["你好", "hello", "hi", "您好", "在吗", "在"]
        if any(kw == text or (len(text) < 5 and kw in text) for kw in greeting_keywords):
            return AgentResponse(
                message=MessageBuilder.text(
                    content="您好！我是您的简历助手，可以帮助您：\n"
                           "📝 **添加信息**：添加工作经历、教育背景等\n"
                           "✏️ **修改信息**：修改已有信息\n"
                           "👀 **查看信息**：查看简历内容\n"
                           "🗑️ **删除信息**：删除不需要的内容\n\n"
                           "您可以这样开始：\n"
                           "- 「我在腾讯工作过」- 添加工作经历\n"
                           "- 「查看我的基本信息」- 查看信息\n"
                           "- 「把名字改成张三」- 修改信息",
                    session_id=self.session_id
                ),
                resume_data=self.state.resume_data
            )
        
        # 写简历/创建简历场景
        create_keywords = ["写简历", "创建简历", "制作简历", "生成简历"]
        if any(kw in text for kw in create_keywords):
            return AgentResponse(
                message=MessageBuilder.text(
                    content="好的，我来帮您创建简历！让我们开始：\n\n"
                           "1️⃣ **基本信息**：请告诉我您的姓名、职位\n"
                           "2️⃣ **工作经历**：例如「我在腾讯做前端，2021年到2023年」\n"
                           "3️⃣ **教育背景**：例如「北京大学，计算机专业，本科」\n\n"
                           "您想从哪个部分开始？",
                    session_id=self.session_id
                ),
                resume_data=self.state.resume_data
            )
        
        # ========== LLM 兜底 ==========
        if self.enable_llm and self.llm_api_key:
            return self._call_llm_agent(user_message)
        
        # 没有启用 LLM，返回默认提示
        return AgentResponse(
            message=MessageBuilder.unknown_intent(self.session_id),
            resume_data=self.state.resume_data
        )
    
    # ========================================================================
    # LLM Agent 方法（规则失败时的兜底）
    # ========================================================================
    
    def _call_llm_agent(self, user_message: str) -> AgentResponse:
        """
        调用 LLM Agent（主要处理方法）
        
        所有用户请求都通过 LLM 处理，LLM 通过 Function Calling 调用工具。
        
        工作流程：
        1. 构建上下文（历史 + 当前消息 + 简历摘要）
        2. LLM 决定调用工具（Function Calling）
        3. 执行工具
        4. 工具结果 → LLM → 最终回复
        
        优化：
        - 包含对话历史（多轮上下文）
        - Token 限制（避免超出上下文窗口）
        - 上下文摘要（长对话支持）
        """
        try:
            # 构建消息（包含历史上下文）
            messages = [{"role": "system", "content": LLM_SYSTEM_PROMPT}]
            
            # 添加对话历史和当前消息（使用优化后的上下文管理）
            resume_summary = self._get_resume_summary()
            context_messages = self.state.get_context_for_llm(
                current_message=user_message,
                resume_summary=resume_summary
            )
            messages.extend(context_messages)
            
            if self.debug:
                print(f"[LLM 上下文] 历史消息: {len(self.state.chat_history)}条, 发送: {len(context_messages)}条")
                print(f"[LLM 简历摘要] {resume_summary[:150]}...")
            
            # 第一次调用 LLM
            response = self._call_llm_api(messages, tools=LLM_TOOLS_DEFINITION)
            if not response:
                return self._fallback_response()
            
            choice = response["choices"][0]
            message = choice["message"]
            
            # 检查是否有工具调用
            if message.get("tool_calls"):
                return self._handle_llm_tool_calls(message, messages, user_message)
            else:
                # 没有工具调用，直接返回 LLM 回复
                return AgentResponse(
                    message=MessageBuilder.text(
                        content=message.get("content", ""),
                        session_id=self.session_id
                    ),
                    resume_data=self.state.resume_data
                )
                
        except Exception as e:
            if self.debug:
                print(f"[LLM Agent 错误] {e}")
            return self._fallback_response()
    
    def _handle_llm_tool_calls(
        self, 
        llm_message: Dict, 
        messages: List[Dict],
        user_message: str
    ) -> AgentResponse:
        """处理 LLM 的工具调用"""
        resume_modified = False
        tool_call_info = None
        
        for tool_call in llm_message["tool_calls"]:
            func = tool_call["function"]
            tool_name = func["name"]
            tool_params = json.loads(func.get("arguments", "{}"))
            
            if self.debug:
                print(f"[LLM 工具调用] {tool_name}({tool_params})")
            
            # 执行工具
            result = self._execute_llm_tool(tool_name, tool_params)
            
            # 记录工具调用信息
            tool_call_info = {
                "name": tool_name,
                "params": tool_params
            }
            
            # 检查是否修改了简历
            if tool_name == "CVEditor" and result.get("success"):
                resume_modified = True
            
            # 添加工具调用和结果到消息
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [tool_call]
            })
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "content": json.dumps(result, ensure_ascii=False)
            })
        
        # 第二次调用 LLM（继续允许工具调用，支持多轮工具）
        response = self._call_llm_api(messages, tools=LLM_TOOLS_DEFINITION)
        if response:
            next_message = response["choices"][0]["message"]
            
            # 检查是否还有工具调用（支持多轮工具调用链）
            if next_message.get("tool_calls"):
                # 递归处理下一轮工具调用
                return self._handle_llm_tool_calls(next_message, messages, user_message)
            
            final_reply = next_message.get("content", "操作完成")
        else:
            final_reply = "已为您处理"
        
        # 构建响应
        msg = MessageBuilder.text(content=final_reply, session_id=self.session_id)
        if tool_call_info:
            msg.tool_call = tool_call_info
        
        return AgentResponse(
            message=msg,
            resume_data=self.state.resume_data,
            resume_modified=resume_modified
        )
    
    def _execute_llm_tool(self, tool_name: str, tool_params: Dict) -> Dict:
        """执行 LLM 调用的工具"""
        if tool_name == "CVReader":
            path = tool_params.get("path")
            return self.executor.execute_read(path).to_dict()
        elif tool_name == "CVEditor":
            path = tool_params.get("path", "")
            action = tool_params.get("action", "update")
            value = tool_params.get("value")

            # 验证必需参数
            if action in ["update", "add"] and value is None:
                return {"success": False, "message": f"'{action}' 操作需要提供 value 参数"}

            # ========== 信息完整性检查（澄清能力） ==========
            if action == "add" and isinstance(value, dict):
                # 检查工作经历必需字段
                if path in ["workExperience", "experience"]:
                    required_fields = ["company", "position"]
                    missing = [f for f in required_fields if not value.get(f)]
                    if missing:
                        field_names = {
                            "company": "公司名称",
                            "position": "职位",
                            "startDate": "开始时间",
                            "endDate": "结束时间",
                            "description": "工作描述"
                        }
                        missing_names = [field_names.get(f, f) for f in missing]
                        return {
                            "success": False,
                            "message": f"信息不完整",
                            "error_type": "clarify",
                            "module": path,
                            "collected_data": value,
                            "missing_fields": missing,
                            "missing_fields_names": missing_names,
                            "prompt": f"请补充以下信息：{', '.join(missing_names)}"
                        }

                # 检查教育经历必需字段
                elif path == "education":
                    required_fields = ["school", "major"]
                    missing = [f for f in required_fields if not value.get(f)]
                    if missing:
                        field_names = {
                            "school": "学校名称",
                            "major": "专业",
                            "degree": "学历",
                            "startDate": "开始时间",
                            "endDate": "结束时间"
                        }
                        missing_names = [field_names.get(f, f) for f in missing]
                        return {
                            "success": False,
                            "message": f"信息不完整",
                            "error_type": "clarify",
                            "module": path,
                            "collected_data": value,
                            "missing_fields": missing,
                            "missing_fields_names": missing_names,
                            "prompt": f"请补充以下信息：{', '.join(missing_names)}"
                        }

                # 检查项目经历必需字段
                elif path == "projects":
                    if not value.get("name"):
                        return {
                            "success": False,
                            "message": "信息不完整",
                            "error_type": "clarify",
                            "module": path,
                            "collected_data": value,
                            "missing_fields": ["name"],
                            "missing_fields_names": ["项目名称"],
                            "prompt": "请补充：项目名称"
                        }

            # 特殊处理：列表格式转换
            # 如果 value 是字符串且包含列表转换指令，先读取现有值，然后转换
            if action == "update" and isinstance(value, str):
                value_lower = value.lower()
                if "改成有序列表" in value or "改成无序列表" in value or "有序列表" in value_lower or "无序列表" in value_lower:
                    # 先读取现有值
                    read_result = self.executor.execute_read(path)
                    if read_result.success and isinstance(read_result.result, str):
                        current_html = read_result.result
                        # 转换列表格式
                        if "有序列表" in value_lower or "改成有序列表" in value:
                            # ul -> ol（包括嵌套的 ul）
                            converted_html = current_html.replace("<ul>", "<ol>").replace("</ul>", "</ol>")
                            # 同时处理嵌套的 ul（如果有的话）
                            converted_html = converted_html.replace("<ol>", "<ol>", 1)  # 确保只替换第一个
                        else:
                            # ol -> ul（包括嵌套的 ol）
                            converted_html = current_html.replace("<ol>", "<ul>").replace("</ol>", "</ul>")
                        value = converted_html
                    else:
                        return {"success": False, "message": f"无法读取路径 {path} 的现有值"}

            if action == "add":
                result = self.executor.execute_add(path, value)
            elif action == "update":
                result = self.executor.execute_update(path, value)
            elif action == "delete":
                result = self.executor.execute_delete(path)
            else:
                return {"success": False, "message": f"未知操作: {action}"}

            # 更新简历数据
            if result.success and result.updated_resume:
                self.state.update_resume(result.updated_resume)

            return result.to_dict()
        elif tool_name == "CVBatchEditor":
            # 批量编辑工具
            from .tools.cv_batch_editor import CVBatchEditorTool
            operations = tool_params.get("operations", [])

            if not operations:
                return {"success": False, "message": "CVBatchEditor 需要提供 operations 参数"}

            # 创建批量编辑器
            batch_editor = CVBatchEditorTool(resume_data=self.state.resume_data)

            # 执行批量操作
            result = batch_editor._run(operations=operations)

            # 如果全部成功，更新简历数据
            if result.get("success"):
                self.state.update_resume(self.state.resume_data)

            return result
        else:
            return {"success": False, "message": f"未知工具: {tool_name}"}
    
    def _call_llm_api(self, messages: List[Dict], tools: List[Dict] = None) -> Optional[Dict]:
        """调用 LLM API（非流式）"""
        try:
            headers = {
                "Authorization": f"Bearer {self.llm_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.llm_model,
                "messages": messages,
                "temperature": 0.1,
            }
            
            if tools:
                payload["tools"] = tools
                payload["tool_choice"] = "auto"
            
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.llm_base_url}/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            if self.debug:
                print(f"[LLM API 错误] {e}")
            return None
    
    def _call_llm_api_stream(self, messages: List[Dict], tools: List[Dict] = None):
        """流式调用 LLM API（同步版本，用于非异步上下文）"""
        try:
            headers = {
                "Authorization": f"Bearer {self.llm_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.llm_model,
                "messages": messages,
                "temperature": 0.1,
                "stream": True  # 启用流式输出
            }
            
            if tools:
                payload["tools"] = tools
                payload["tool_choice"] = "auto"
            
            with httpx.Client(timeout=60.0) as client:
                with client.stream(
                    "POST",
                    f"{self.llm_base_url}/v1/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    response.raise_for_status()
                    
                    # 解析 SSE 流
                    for line in response.iter_lines():
                        if not line:
                            continue
                        
                        # 移除 "data: " 前缀
                        if line.startswith("data: "):
                            line = line[6:]
                        
                        # 检查结束标记
                        if line.strip() == "[DONE]":
                            break
                        
                        try:
                            chunk = json.loads(line)
                            yield chunk
                        except json.JSONDecodeError:
                            continue
                            
        except Exception as e:
            if self.debug:
                print(f"[LLM API 流式错误] {e}")
            yield None
    
    async def _call_llm_api_stream_async(self, messages: List[Dict], tools: List[Dict] = None):
        """流式调用 LLM API（异步版本）"""
        try:
            headers = {
                "Authorization": f"Bearer {self.llm_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.llm_model,
                "messages": messages,
                "temperature": 0.1,
                "stream": True  # 启用流式输出
            }
            
            if tools:
                payload["tools"] = tools
                payload["tool_choice"] = "auto"
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.llm_base_url}/v1/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    response.raise_for_status()
                    
                    # 解析 SSE 流
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        
                        # 移除 "data: " 前缀
                        if line.startswith("data: "):
                            line = line[6:]
                        
                        # 检查结束标记
                        if line.strip() == "[DONE]":
                            break
                        
                        try:
                            chunk = json.loads(line)
                            yield chunk
                        except json.JSONDecodeError:
                            continue
                            
        except Exception as e:
            if self.debug:
                print(f"[LLM API 异步流式错误] {e}")
            yield None
    
    def _get_resume_summary(self) -> str:
        """获取简历摘要（给 LLM 用）"""
        parts = []
        basic = self.state.resume_data.get("basic", {})
        if basic.get("name"):
            parts.append(f"姓名:{basic['name']}")
        
        work = self.state.resume_data.get("workExperience", [])
        parts.append(f"工作经历:{len(work)}条")
        
        edu = self.state.resume_data.get("education", [])
        parts.append(f"教育:{len(edu)}条")
        
        projects = self.state.resume_data.get("projects", [])
        parts.append(f"项目:{len(projects)}条")
        
        # 添加 skills 的实际内容（重要：让 LLM 知道当前技能）
        skills = self.state.resume_data.get("skills", "")
        if skills:
            # 截取前200字符，避免太长
            skills_preview = skills[:200] + ("..." if len(skills) > 200 else "")
            parts.append(f"专业技能内容:{skills_preview}")
        else:
            parts.append("专业技能:无")
        
        return ", ".join(parts) if parts else "空简历"
    
    def _fallback_response(self) -> AgentResponse:
        """兜底响应"""
        return AgentResponse(
            message=MessageBuilder.unknown_intent(self.session_id),
            resume_data=self.state.resume_data
        )

