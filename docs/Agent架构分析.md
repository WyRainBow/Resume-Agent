# AI 简历 Agent 架构分析

## 一、项目概述

本项目是一个基于 AI 的简历编辑助手，通过对话交互帮助用户创建、修改和优化简历。项目采用前后端分离架构：

- **前端**: React + TypeScript + Vite
- **后端**: Python + FastAPI
- **AI 引擎**: DeepSeek LLM + Function Calling

### 参考架构
- **sophia-pro**: 项目参考了 sophia-pro 的 Agent 架构设计
- **UP简历** (https://upcv.tech/builder/cmjnzf6a33jnula2cw94ptbdz): 产品形态参考

---

## 二、核心设计模式

### 2.1 Capability 模式（能力包系统）

**位置**: `backend/agents/capability.py`

Capability 模式是本项目的核心设计模式，用于动态配置 Agent 行为，避免创建多个垂直的 Agent 类。

#### 设计理念
```
传统方式:                    Capability 方式:
┌─────────────┐              ┌─────────────┐
│  BaseAgent  │              │   CVAgent   │
├─────────────┤              │             │
│EditAgent    │  → 避免 →     │ + Capability │
│OptAgent     │  创建多个     │   - base     │
│AdvAgent     │   Agent 类   │   - advanced │
└─────────────┘              │   - optimizer│
                             └─────────────┘
```

#### 核心组件

**1. ToolPolicy（工具策略白名单）**
```python
@dataclass
class ToolPolicy:
    whitelist: Optional[List[str]] = None      # 白名单（None = 无限制）
    enabled_tools: List[str]                   # 启用的工具
    disabled_tools: List[str]                  # 禁用的工具

    def get_effective_tools(self, all_available_tools) -> List[str]:
        # 白名单优先，然后应用启用/禁用规则
        if self.whitelist is not None:
            effective = [t for t in self.whitelist if t in all_available_tools]
        # ...
```

**2. Capability（能力包定义）**
```python
@dataclass
class Capability:
    name: str                                  # 能力包名称
    description: str                           # 描述
    system_prompt_addendum: str                # 追加到 system prompt
    tool_policy: ToolPolicy                    # 工具策略
    setup: Optional[Callable]                  # 初始化函数（可选）
```

**3. 预定义 Capability**
```python
BASE_CAPABILITY = Capability(
    name="base",
    system_prompt_addendum="基础简历编辑能力...",
    tool_policy=ToolPolicy(whitelist=["CVReader", "CVEditor"])
)

ADVANCED_CAPABILITY = Capability(
    name="advanced",
    system_prompt_addendum="STAR 法则指导...",
    tool_policy=ToolPolicy(whitelist=["CVReader", "CVEditor"])
)

OPTIMIZER_CAPABILITY = Capability(
    name="optimizer",
    system_prompt_addendum="批量优化模式...",
    tool_policy=ToolPolicy(whitelist=["CVReader", "CVEditor"])
)
```

#### Capability 工作流程

```
用户请求 → API → AgentManager.get_or_create()
                     ↓
                解析 capability 参数
                     ↓
                CVAgent.__init__(capability="advanced")
                     ↓
                _resolve_capability() → CapabilityRegistry.get()
                     ↓
                构建 System Prompt (base + capability.addendum)
                     ↓
                获取有效工具 (根据 ToolPolicy 过滤)
                     ↓
                调用 LLM（使用过滤后的工具列表）
```

#### 架构优势
1. **单一 Agent 类**: 不需要为每种能力创建单独的 Agent
2. **运行时配置**: 可动态切换 Capability
3. **工具权限控制**: 通过白名单限制可用工具
4. **Prompt 模块化**: System Prompt 可组合

---

### 2.2 ReAct 模式（推理-行动循环）

**位置**: `backend/agents/react_agent.py`

ReAct (Reasoning + Acting) 是一种经典的 Agent 模式，结合了推理和行动。

#### 核心概念

```
ReAct 循环:
┌─────────────────────────────────────────────────────┐
│  1. Thought (思考)  →  2. Action (行动)            │
│         ↑                    ↓                      │
│         └────────  3. Observation (观察)  ←────────┘
│                              ↓
│                    4. 重复或完成                    │
└─────────────────────────────────────────────────────┘
```

#### ReActStep 类型
```python
class ReActStepType(str, Enum):
    THOUGHT = "thought"       # 思考步骤
    ACTION = "action"         # 行动步骤
    OBSERVATION = "observation"  # 观察结果
    ANSWER = "answer"         # 最终答案
```

#### ReActPromptBuilder
```python
class ReActPromptBuilder:
    """构建 ReAct 风格的 Prompt"""

    DEFAULT_TEMPLATE = """
    你是一个简历助手，可以使用工具来帮助用户。

    可用工具:
    {tools}

    使用以下格式:

    Question: 用户的问题
    Thought: 你应该怎么做
    Action: 工具名称
    Observation: 工具返回的结果
    ... (可以重复 Thought/Action/Observation)
    Thought: 我知道最终答案了
    Answer: 最终答案

    开始!

    Question: {input}
    Thought: {agent_scratchpad}
    """
```

#### 本项目的 ReAct 应用

虽然项目引入了 ReAct 模块，但当前实现主要通过 LLM Function Calling 实现：

```
传统 ReAct:                    本项目实现:
Thought → Action → Obs → ...   LLM 分析 → Tool Call → Result → LLM → 回复
```

当前 CVAgent 更接近 **Tool-Calling Agent** 模式，而非显式的 ReAct 循环。

---

### 2.3 MessageBuilder 模式（消息构建器）

**位置**: `backend/agents/message_builder.py`

MessageBuilder 是工厂模式的应用，用于创建标准化的响应消息。

#### 核心设计

**1. MessageType 枚举**
```python
class MessageType(str, Enum):
    TEXT = "text"                    # 普通文本
    THINKING = "thinking"            # 思考过程
    TOOL_CALL = "tool_call"          # 工具调用
    TOOL_RESULT = "tool_result"      # 工具结果
    CLARIFY = "clarify"              # 澄清请求
    CONTENT = "content"              # 最终回复
    ERROR = "error"                  # 错误
    DONE = "done"                    # 完成标记

    # ReAct 相关
    PROCEDURE_START = "procedure_start"
    STEP_START = "step_start"
    FINAL_ANSWER = "final_answer"
```

**2. AgentMessage 数据类**
```python
@dataclass
class AgentMessage:
    type: MessageType
    content: str
    tool_call: Optional[Dict[str, Any]]
    tool_result: Optional[Dict[str, Any]]
    thinking: Optional[str]
    metadata: Dict[str, Any]
    timestamp: float
    message_id: str

    def to_dict(self) -> Dict[str, Any]:
        # 序列化为字典，便于 API 响应
```

**3. 工厂方法**
```python
class MessageBuilder:
    @staticmethod
    def text(content: str, **metadata) -> AgentMessage:
        return AgentMessage(type=MessageType.TEXT, content=content, ...)

    @staticmethod
    def tool_call(tool_name: str, tool_params: Dict, ...) -> AgentMessage:
        return AgentMessage(type=MessageType.TOOL_CALL, ...)

    @staticmethod
    def clarify(prompt: str, module: str, ...) -> AgentMessage:
        return AgentMessage(type=MessageType.CLARIFY, ...)

    # 便捷方法
    @staticmethod
    def success_add(module: str, data: Dict, ...) -> AgentMessage:
        # 添加成功消息

    @staticmethod
    def need_more_info(module: str, missing: List[str], ...) -> AgentMessage:
        # 需要更多信息消息
```

#### 消息流转

```
CVAgent.process_message()
        ↓
MessageBuilder.tool_call()  → 前端显示"正在调用工具..."
        ↓
ToolExecutor.execute()      → 执行实际操作
        ↓
MessageBuilder.tool_result() → 前端显示"工具执行结果"
        ↓
MessageBuilder.text()       → 最终回复
```

#### 设计优势
1. **统一格式**: 所有消息类型标准化
2. **类型安全**: 通过枚举避免字符串拼写错误
3. **丰富元数据**: 支持传递额外信息
4. **序列化友好**: 直接转换为 API 响应

---

### 2.4 LangChain BaseTool 模式

**位置**: `backend/agents/tools/`

虽然项目没有直接使用 LangChain 库，但参考了 LangChain 的 BaseTool 设计模式。

#### LangChain BaseTool 原型
```python
# LangChain 风格
from langchain.tools import BaseTool

class CVReaderTool(BaseTool):
    name = "CVReader"
    description = "读取简历数据"

    def _run(self, path: str) -> Dict:
        # 同步执行
        pass

    async def _arun(self, path: str) -> Dict:
        # 异步执行
        pass
```

#### 本项目的工具实现

**1. CVReaderTool**
```python
class CVReaderTool:
    """读取简历数据工具"""

    def __init__(self, resume_data: Dict[str, Any]):
        self.resume_data = resume_data

    def _run(self, path: str) -> Dict:
        """执行读取操作"""
        # 支持 JSONPath 风格: basic.name, workExperience[0].company
        keys = path.split(".")
        result = self.resume_data

        for key in keys:
            # 处理数组索引: workExperience[0]
            if "[" in key and "]" in key:
                # ...
            else:
                result = result.get(key)

        return {"success": True, "result": result}
```

**2. CVEditorTool**
```python
class CVEditorTool:
    """编辑简历数据工具"""

    def __init__(self, resume_data: Dict[str, Any]):
        self.resume_data = resume_data

    def _run(self, path: str, action: str, value: Any) -> Dict:
        """执行编辑操作"""
        if action == "update":
            return self._update(path, value)
        elif action == "add":
            return self._add(path, value)
        elif action == "delete":
            return self._delete(path)
```

**3. ToolRegistry（工具注册中心）**
```python
class ToolRegistry:
    """工具注册表（单例模式）"""

    _instance = None
    _tools: Dict[str, ToolInfo] = {}

    def register(self, name: str, handler: Any, ...):
        """注册工具"""
        self._tools[name] = ToolInfo(name=name, handler=handler, ...)

    def get(self, name: str) -> Optional[ToolInfo]:
        """获取工具"""
        return self._tools.get(name)
```

#### 工具定义（LLM Function Calling 格式）

```python
LLM_TOOLS_DEFINITION = [
    {
        "type": "function",
        "function": {
            "name": "CVReader",
            "description": "读取简历数据...",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "字段路径"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "CVEditor",
            "description": "编辑简历...",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "action": {"enum": ["update", "add", "delete"]},
                    "value": {"description": "新值"}
                },
                "required": ["path", "action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "CVBatchEditor",
            "description": "批量编辑...",
            "parameters": {
                "type": "object",
                "properties": {
                    "operations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "path": {"type": "string"},
                                "action": {"enum": ["update", "add", "delete"]},
                                "value": {}
                            }
                        }
                    }
                },
                "required": ["operations"]
            }
        }
    }
]
```

#### 工具执行流程

```
LLM 返回 tool_calls
        ↓
CVAgent._execute_llm_tool(tool_name, tool_params)
        ↓
ToolRegistry.get_handler(tool_name)
        ↓
CVReaderTool/CVEditorTool._run(...)
        ↓
返回 {"success": bool, "result": Any, "updated_resume": Dict}
        ↓
更新 AgentState.resume_data
```

---

## 三、Agent 状态管理

### 3.1 AgentState

**位置**: `backend/agents/agent_state.py`

AgentState 是参考 sophia-pro 的统一状态管理方案。

```python
class AgentState:
    """Agent 状态管理"""

    def __init__(self, resume_data: Dict = None, session_id: str = ""):
        self.resume_data = resume_data or {}
        self.session_id = session_id
        self.chat_history = []          # 对话历史
        self._context_summary = None    # 上下文摘要
        self._pending_task = None       # 待补充任务

    def add_message(self, role: str, content: str, **metadata):
        """添加消息到历史"""

    def get_context_for_llm(self, current_message: str, resume_summary: str) -> List[Dict]:
        """获取适合 LLM 的上下文（自动压缩长历史）"""

    def estimate_tokens(self) -> int:
        """估算历史消息的 token 数"""

    def needs_summarization(self) -> bool:
        """检查是否需要摘要（超过阈值）"""

    def start_pending_task(self, module: str, intent: str, ...):
        """开始待补充任务（多轮对话）"""
```

#### 上下文压缩策略

```python
def get_context_for_llm(self, current_message: str, resume_summary: str) -> List[Dict]:
    messages = []

    # 1. 如果有摘要，添加摘要
    if self._context_summary:
        messages.append({
            "role": "system",
            "content": f"之前对话摘要: {self._context_summary}"
        })

    # 2. 添加简历摘要
    messages.append({
        "role": "system",
        "content": f"当前简历: {resume_summary}"
    })

    # 3. 添加最近的消息（有数量限制）
    recent_messages = self.chat_history[-MAX_HISTORY:]
    messages.extend(recent_messages)

    # 4. 添加当前消息
    messages.append({"role": "user", "content": current_message})

    return messages
```

### 3.2 AgentManager（会话管理）

**位置**: `backend/agents/agent_manager.py`

```python
class AgentManager:
    """Agent 管理器（单例模式）"""

    SESSION_EXPIRE_TIME = 3600  # 1小时过期
    MAX_SESSIONS = 100

    def get_or_create(
        self,
        session_id: Optional[str],
        resume_data: Optional[Dict],
        capability: Optional[str]
    ) -> tuple[str, CVAgent]:
        """获取或创建会话"""

        # 1. 清理过期会话
        self._cleanup_expired()

        # 2. 尝试获取已有会话
        if session_id and session_id in self._sessions:
            session = self._sessions[session_id]
            session.touch()
            # 动态更新 capability
            if capability:
                session.agent.set_capability(capability)
            return session_id, session.agent

        # 3. 创建新会话
        new_session_id = session_id or self._generate_session_id()
        agent = CVAgent(resume_data=resume_data, capability=capability)
        self._sessions[new_session_id] = AgentSession(...)
        return new_session_id, agent
```

#### 多轮对话数据一致性保证

```python
# 关键设计：在多轮对话中，信任 Agent 自己维护的数据
# 不要用前端传递的旧数据覆盖 Agent 中已更新的数据

if session_id and session_id in self._sessions:
    session = self._sessions[session_id]
    session.touch()

    # ⚠️ 重要：不使用前端传递的 resume_data 覆盖
    # 前端传递的 resume_data 只在创建新会话时使用
    # 已有会话中，Agent 通过工具调用自己维护数据
    return session_id, session.agent
```

---

## 四、API 路由设计

### 4.1 路由结构

**位置**: `backend/routes/cv_agent.py`

```python
router = APIRouter(prefix="/api/cv-agent", tags=["CV Agent"])

# 核心接口
@router.post("/chat")                    # 非流式对话
@router.post("/chat/stream")             # 流式对话（SSE）

# 会话管理
@router.get("/session/{session_id}")     # 获取会话信息
@router.delete("/session/{session_id}")  # 删除会话
@router.get("/sessions")                 # 列出所有会话
@router.get("/stats")                    # 获取统计信息
@router.post("/clear-all")               # 清空所有会话
```

### 4.2 请求/响应模型

```python
class ChatRequest(BaseModel):
    message: str                    # 用户消息
    session_id: Optional[str]       # 会话 ID（可选）
    resume_data: Optional[Dict]     # 当前简历数据
    capability: Optional[str]       # 能力包: base|advanced|optimizer

class ChatResponse(BaseModel):
    session_id: str                 # 会话 ID
    type: str                       # 消息类型
    content: str                    # 回复内容
    tool_call: Optional[Dict]       # 工具调用信息
    tool_result: Optional[Dict]     # 工具执行结果
    thinking: Optional[str]         # 思考过程
    metadata: Optional[Dict]        # 元数据
    resume_data: Optional[Dict]     # 更新后的简历数据
    resume_modified: bool           # 简历是否被修改
```

### 4.3 SSE 流式响应

```python
@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def event_generator():
        # 获取或创建 Agent
        session_id, agent = agent_manager.get_or_create(...)

        # 使用队列传递事件（同步 → 异步桥接）
        event_queue = queue.Queue()

        def run_sync_generator():
            for event in agent.process_message_stream(request.message):
                event_queue.put(event)
            event_queue.put(None)  # 结束标记

        # 启动后台线程
        thread = threading.Thread(target=run_sync_generator)
        thread.start()

        # 异步读取事件
        while True:
            event = await asyncio.to_thread(lambda: event_queue.get(timeout=0.1))
            if event is None:
                break

            # 发送 SSE 事件
            yield {
                "event": event.get("type", "message"),
                "data": json.dumps(event, ensure_ascii=False)
            }

    return EventSourceResponse(event_generator())
```

#### SSE 事件类型

```
thinking        → 思考过程
tool_call       → 工具调用参数
tool_start      → 工具开始执行
tool_result     → 工具执行结果
tool_end        → 工具执行结束
content         → 最终回复内容
clarify         → 需要澄清/补充信息
done            → 完成标记
error           → 错误信息
```

---

## 五、与 SophiaPro Agent 的对比

### 5.1 架构相似点

| 特性 | SophiaPro | 本项目 |
|------|-----------|--------|
| AgentState | 统一状态管理 | ✅ 参考 AgentState |
| Capability | 能力包系统 | ✅ 简化版 Capability |
| ToolPolicy | 工具策略白名单 | ✅ ToolPolicy |
| ReActAgent | ReAct 循环 | ✅ 引入但主要用 Tool-Calling |
| ToolHooks | 工具调用钩子 | ✅ LoggingToolHook |
| MessageBuilder | 消息构建器 | ✅ 完整实现 |

### 5.2 架构差异

| 方面 | SophiaPro | 本项目 |
|------|-----------|--------|
| LLM 集成 | 复杂的多模型支持 | 简化的 DeepSeek API |
| 工具系统 | 基于 LangChain | 自研轻量级工具 |
| ReAct 实现 | 显式 ReAct 循环 | LLM Function Calling |
| 上下文管理 | 复杂的压缩策略 | 简单的历史截断 |

### 5.3 设计决策

1. **为什么选择轻量级工具而非 LangChain？**
   - 减少依赖复杂度
   - 更精细的控制
   - 避免过度封装

2. **为什么主要用 Tool-Calling 而非显式 ReAct？**
   - DeepSeek 的 Function Calling 更可靠
   - 减少 Prompt 复杂度
   - 更容易调试

3. **为什么需要 Capability 系统？**
   - 避免"垂直 Agent"爆炸
   - 支持运行时行为切换
   - 便于 A/B 测试不同 Prompt

---

## 六、项目结构

```
backend/
├── agents/
│   ├── __init__.py              # 模组导出
│   ├── cv_agent.py              # 核心 CVAgent
│   ├── agent_state.py           # 状态管理
│   ├── agent_manager.py         # 会话管理（单例）
│   ├── capability.py            # 能力包系统
│   ├── react_agent.py           # ReAct Agent
│   ├── message_builder.py       # 消息构建器
│   ├── tool_registry.py         # 工具注册表
│   ├── intent_recognizer.py     # 意图识别
│   ├── tool_executor.py         # 工具执行器
│   ├── tool_hooks.py            # 工具钩子
│   ├── chat_state.py            # 对话状态（兼容旧版）
│   └── tools/                   # 工具实现
│       ├── cv_reader.py         # CVReader 工具
│       ├── cv_editor.py         # CVEditor 工具
│       └── cv_batch_editor.py   # CVBatchEditor 工具
│
├── routes/
│   └── cv_agent.py              # API 路由
│
└── main.py                      # FastAPI 应用入口

frontend/
├── src/
│   ├── pages/
│   │   └── AIConversation/      # AI 对话页面
│   │       └── index.tsx        # 对话 UI + SSE 处理
│   └── services/
│       └── api.ts               # API 客户端
```

---

## 七、数据流图

### 7.1 完整对话流程

```
┌─────────────┐
│   用户输入   │ "在腾讯工作，做前端开发"
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  前端 (React)                                           │
│  1. 收集用户消息                                         │
│  2. 获取当前 session_id 和 resume_data                  │
│  3. 调用 /api/cv-agent/chat/stream                      │
└──────┬──────────────────────────────────────────────────┘
       │ POST /api/cv-agent/chat/stream
       ▼
┌─────────────────────────────────────────────────────────┐
│  API 路由层 (FastAPI)                                   │
│  1. AgentManager.get_or_create(session_id, capability)  │
│  2. 返回 SSE EventSourceResponse                        │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  AgentManager (单例)                                    │
│  1. 检查是否有已有会话                                   │
│  2. 有 → 返回已有 Agent，更新 capability                │
│  3. 无 → 创建新 Agent (CVAgent)                         │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  CVAgent                                                │
│  1. state.add_message("user", message)                  │
│  2. _call_llm_agent_stream()                            │
│     - 构建上下文（历史 + 摘要 + 简历数据）                │
│     - 调用 DeepSeek API (Function Calling)              │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  DeepSeek LLM                                           │
│  1. 分析用户意图                                         │
│  2. 决定调用工具                                         │
│  3. 返回 tool_calls                                     │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  CVAgent._execute_llm_tool()                            │
│  1. 解析 tool_name 和 tool_params                       │
│  2. ToolExecutor.execute()                              │
│  3. 更新 state.resume_data                              │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Tool (CVReader/CVEditor/CVBatchEditor)                │
│  1. 执行具体操作                                         │
│  2. 返回结果 {"success": bool, "result": Any}           │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  CVAgent (第二轮 LLM 调用)                              │
│  1. 将工具结果添加到消息历史                             │
│  2. 再次调用 LLM 生成最终回复                            │
│  3. state.add_message("assistant", reply)               │
└──────┬──────────────────────────────────────────────────┘
       │ SSE 事件流
       ▼
┌─────────────────────────────────────────────────────────┐
│  前端 (SSE 消费)                                         │
│  1. thinking → 显示"思考中..."                           │
│  2. tool_call → 显示"调用工具..."                        │
│  3. tool_result → 显示执行结果                           │
│  4. content → 显示最终回复                               │
│  5. 更新本地 resume_data                                │
└─────────────────────────────────────────────────────────┘
```

### 7.2 多轮对话流程

```
第1轮: "在腾讯工作"
  ↓ LLM 调用 CVEditor(workExperience, add, {company: "腾讯"})
  ↓ 返回: "请补充职位和开始时间"

第2轮: "前端开发，2021年到2023年"
  ↓ LLM 识别到上下文（有 pending_task）
  ↓ LLM 调用 CVEditor(workExperience, add, {company: "腾讯", position: "前端", ...})
  ↓ 返回: "已添加工作经历"
  ↓ 清空 pending_task
```

---

## 八、关键设计决策总结

### 8.1 为什么采用 LLM-First 架构？

初期项目使用了规则引擎（IntentRecognizer）+ LLM 兜底的分层架构，后来简化为纯 LLM 架构：

**原因**:
1. LLM 能力足够强，可处理大部分场景
2. 规则维护成本高，难以覆盖边缘情况
3. LLM Function Calling 更可靠

### 8.2 为什么需要 AgentManager 单例？

**原因**:
1. 会话复用：同一 session_id 使用同一个 Agent
2. 状态保持：多轮对话需要保持历史
3. 资源控制：限制最大会话数

### 8.3 为什么 SSE 而非 WebSocket？

**原因**:
1. 单向流式：服务端 → 客户端足够
2. 实现简单：基于 HTTP，无需额外协议
3. 自动重连：浏览器原生支持

### 8.4 如何保证数据一致性？

**关键设计**:
```python
# 在 AgentManager.get_or_create() 中
if session_id and session_id in self._sessions:
    # ⚠️ 重要：不使用前端传递的 resume_data 覆盖
    # 前端传递的 resume_data 只在创建新会话时使用
    return session_id, session.agent
```

这解决了"更新后再操作，数据被覆盖"的 Bug。

---

## 九、未来优化方向

1. **引入真正的 ReAct 循环**: 目前是 Tool-Calling，可以尝试显式的 Thought-Action-Observation 循环

2. **上下文压缩优化**: 目前是简单截断，可以引入更智能的摘要策略

3. **工具调用缓存**: 对相同的 read 操作进行缓存

4. **多 LLM 支持**: 抽象 LLM 接口，支持切换不同模型

5. **Capability A/B 测试**: 自动测试不同 Capability 的效果

---

## 十、参考资料

- **SophiaPro**: 内部参考架构项目
- **UP简历**: https://upcv.tech/builder/cmjnzf6a33jnula2cw94ptbdz
- **LangChain**: https://python.langchain.com/
- **ReAct Paper**: "ReAct: Synergizing Reasoning and Acting in Language Models"
- **DeepSeek API**: https://platform.deepseek.com/
