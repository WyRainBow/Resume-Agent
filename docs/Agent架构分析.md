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

### 2.3 混合模式架构（HybridAgent + TaskClassifier）

**位置**: `backend/agents/hybrid_agent.py`, `backend/agents/task_classifier.py`

混合模式架构是本项目的最新设计，根据任务复杂度自动选择执行模式：
- **简单任务** → Function Calling（快速路径）
- **复杂任务** → ReAct（推理路径）

#### 设计理念

```
┌─────────────────────────────────────────┐
│           HybridAgent (统一入口)         │
│  ┌───────────────────────────────────┐  │
│  │  TaskClassifier                   │  │
│  │  根据任务特征选择执行模式：         │  │
│  │  - 简单任务 → Function Calling    │  │
│  │  - 复杂任务 → ReAct               │  │
│  └───────────────────────────────────┘  │
└─────────┬───────────────────────────────┘
          │
    ┌─────┴──────┐
    │            │
    ▼            ▼
┌─────────┐  ┌──────────┐
│  FC     │  │  ReAct   │
│  Agent  │  │  Agent   │
└─────────┘  └──────────┘
    │            │
    └──────┬─────┘
           ▼
    ┌──────────────┐
    │ ToolRegistry │
    │  (统一工具)  │
    └──────────────┘
```

#### TaskClassifier（任务分类器）

```python
class TaskClassifier:
    """任务复杂度分类器"""

    # 简单任务特征
    SIMPLE_TASK_KEYWORDS = [
        "查看", "读取", "显示", "名字", "电话",
        "改", "修改", "更新", "删除",
    ]

    # 复杂任务特征
    COMPLEX_TASK_KEYWORDS = [
        "优化", "改进", "完善", "分析", "评估",
        "批量", "全部", "所有", "整份",
    ]

    @classmethod
    def classify(cls, user_message: str) -> ClassificationResult:
        """分类任务，返回执行模式"""
        # 检查简单任务
        if any(kw in message for kw in cls.SIMPLE_TASK_KEYWORDS):
            return ExecutionMode.FUNCTION_CALLING

        # 检查复杂任务
        if any(kw in message for kw in cls.COMPLEX_TASK_KEYWORDS):
            return ExecutionMode.REACT

        # 默认使用 Function Calling
        return ExecutionMode.FUNCTION_CALLING
```

#### 任务分类示例

| 用户输入 | 分类 | 模式 | 原因 |
|---------|------|------|------|
| "查看我的姓名" | SIMPLE | Function Calling | 单步读取操作 |
| "把名字改成张三" | SIMPLE | Function Calling | 单步修改操作 |
| "删除第一条工作经历" | SIMPLE | Function Calling | 单步删除操作 |
| "优化整份简历" | COMPLEX | ReAct | 需要分析和规划 |
| "分析我的工作经历" | COMPLEX | ReAct | 需要推理能力 |
| "批量更新所有技能" | MEDIUM | Function Calling | 使用 CVBatchEditor |

#### HybridAgent 实现

```python
class HybridAgent:
    """混合模式 Agent"""

    def __init__(
        self,
        resume_data: Dict,
        capability: Capability,
        llm_call_fn: Callable,
        config: HybridAgentConfig = None,
    ):
        self.resume_data = resume_data
        self.capability = capability
        self.llm_call_fn = llm_call_fn
        self.config = config or HybridAgentConfig()

        # 统计信息
        self.stats = {
            "total_requests": 0,
            "function_calling_count": 0,
            "react_count": 0,
        }

    def process_message_stream(self, user_message: str) -> Generator:
        """流式处理"""
        # 1. 分类任务
        classification = TaskClassifier.classify(user_message)

        # 2. 发送分类信息
        yield {
            "type": "mode_selected",
            "mode": classification.mode.value,
            "confidence": classification.confidence,
        }

        # 3. 根据模式执行
        if classification.mode == ExecutionMode.REACT:
            yield from self._process_with_react(user_message)
        else:
            yield from self._process_with_function_calling(user_message)
```

#### 执行模式对比

| 特性 | Function Calling | ReAct |
|------|------------------|-------|
| **速度** | 快（1-2 次 LLM 调用） | 慢（多轮循环） |
| **推理能力** | 基础 | 强 |
| **透明度** | 中等 | 高（每步思考可见） |
| **适用场景** | 简单 CRUD | 复杂分析/优化 |
| **Token 消耗** | 少 | 多 |

#### 混合架构优势

1. **自动优化**：无需手动选择，系统自动判断最优路径
2. **速度与能力平衡**：简单任务快速响应，复杂任务深度推理
3. **透明可观测**：每个请求都有分类信息，可分析模式分布
4. **可配置**：支持强制指定模式（调试或特殊需求）

#### 使用示例

```python
# 创建混合 Agent
agent = create_hybrid_agent(
    resume_data=resume_data,
    capability="advanced",
    llm_call_fn=my_llm_call,
)

# 自动选择模式
for event in agent.process_message_stream("优化我的简历"):
    if event["type"] == "mode_selected":
        print(f"使用模式: {event['mode']}")
    elif event["type"] == "content":
        print(f"回复: {event['content']}")
```

---

### 2.4 MessageBuilder 模式（消息构建器）

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

### 2.5 LangChain BaseTool 模式

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

## 十、优化建议（基于最新架构分析）

### 10.1 对话体验优化

**现状分析**：
- 当前对话流程是：用户输入 → LLM 处理 → 工具调用 → 返回结果
- 相比 SophiaPro，缺少"思考过程可视化"和"执行进度追踪"

**优化方案**：

#### 方案 A：显式思考过程（已实现）

在 System Prompt 中已增加"🤔 分析中..."格式要求，LLM 在调用工具前会输出：
```
🤔 分析中...
1. 理解用户意图：修改简历基本信息中的姓名
2. 提取关键信息：新姓名 = 张三
3. 确定执行方案：调用 CVEditor 工具，修改 basic.name 字段
```

**效果**：增加透明度，让用户了解 AI 的分析逻辑

#### 方案 B：工具执行状态细化

当前已有 `tool_call` 和 `tool_result` 消息，可增加：
- `tool_start`: 工具开始执行
- `tool_progress`: 工具执行进度（可选）
- `tool_end`: 工具执行结束（包含耗时）

**前端展示效果**：
```
🔧 正在执行: CVEditor
   ━━━━━━━━━━━━━━━━━━━━━ 100%
   ✅ 工具执行完成 (45ms)
```

#### 方案 C：ReAct 模式可视化

项目已有 `ReActAgent`，可让用户选择模式：
- **快速模式**：当前 Function Calling 模式（适合简单任务）
- **透明模式**：ReAct 模式，展示完整的 Thought → Action → Observation 循环

**实现要点**：
1. 前端增加模式切换
2. 后端根据模式选择 `CVAgent` 或 `ReActAgent`
3. ReAct 模式下展示每一步推理

---

### 10.2 工具系统优化

#### 方案 A：统一工具基类

**现状**：
- 工具继承 LangChain `BaseTool`
- 工具注册在 `ToolRegistry` V2
- 工具执行通过 `ToolExecutor`

**优化方向**：
1. **抽象 BaseTool 接口**：统一 `execute()` 方法签名
2. **工具钩子机制**：`pre_execute_hook` 和 `post_execute_hook`
3. **工具元数据完善**：版本、状态、分类

**示例架构**：
```python
class BaseTool(ABC):
    @abstractmethod
    def execute(self, **params) -> ToolResult:
        """工具执行逻辑"""
        pass

    def execute_with_hooks(self, **params) -> ToolResult:
        """带钩子的执行"""
        self.pre_execute_hook(params)
        result = self.execute(**params)
        self.post_execute_hook(result)
        return result
```

#### 方案 B：工具性能监控

在 `ToolRegistry` 中增加：
- 调用次数统计
- 平均执行时间
- 成功率监控
- 错误日志记录

**用途**：
1. 识别慢工具，优化性能
2. 发现高频工具，重点维护
3. 监控错误率，及时修复

---

### 10.3 Capability 系统增强

**现状**：
- 已有 `ToolPolicy`（白名单、启用/禁用）
- 已有 `CapabilityRegistry`
- 已支持 Capability 合并

**优化方向**：

#### 方案 A：动态 Capability 切换

**场景**：用户在对话中可以切换模式
```
用户：切换到高级优化模式
AI：好的，已切换到高级模式（使用 STAR 法则）
```

**实现**：
```python
# 在 CVAgent 中
def set_capability(self, capability: Union[str, Capability]):
    self.capability = self._resolve_capability(capability)
    # 重新构建 System Prompt
    self.system_prompt = self._build_system_prompt()
```

#### 方案 B：Capability A/B 测试

**目的**：自动测试不同 Capability 的效果

**实现要点**：
1. 为每个请求记录 capability 和结果
2. 统计用户满意度（如"继续修改"的比例）
3. 自动选择最优 Capability

---

### 10.4 消息协议优化

**现状**：
- 已有 `MessageBuilder` 和 `MessageType` 枚举
- 已支持 ReAct 相关消息类型
- 已有工具调用和结果消息

**优化方向**：参考 SophiaPro CLTP 协议

#### 方案 A：Span 和 Content 分离

**概念**：
- **Span 消息**：标记时间范围（开始/结束）
- **Content 消息**：流式内容

**示例**：
```json
// Span: 工具调用开始
{
  "type": "span",
  "status": "start",
  "name": "tool_calling",
  "id": "call_123",
  "metadata": {
    "tool_name": "CVEditor",
    "params": {...}
  }
}

// Content: 工具执行中
{
  "type": "content",
  "channel": "tool_calling",
  "payload": {
    "progress": 50,
    "message": "正在更新简历数据..."
  }
}

// Span: 工具调用结束
{
  "type": "span",
  "status": "end",
  "name": "tool_calling",
  "id": "call_123",
  "metadata": {
    "success": true,
    "duration_ms": 45
  }
}
```

#### 方案 B：统一消息 ID 和父 ID

**目的**：建立消息层次结构

**示例**：
```json
{
  "type": "content",
  "id": "msg_456",
  "parent_id": "call_123",  // 属于哪个 tool_calling
  "content": "正在更新...",
  "timestamp": 1234567890
}
```

**用途**：
1. 前端可以按层次展示消息
2. 可以折叠/展开某个 Span 的所有消息
3. 追踪消息来源

---

### 10.5 多 Agent 协作（高级）

**场景**：复杂任务需要多个 Agent 协作

**示例**：
```
用户：帮我优化整份简历

┌─────────────────────────────────────────┐
│ 📋 PlanningAgent                        │
│  分析简历，制定优化计划                 │
└─────────────────┬───────────────────────┘
                  │
       ┌──────────┼──────────┐
       │          │          │
       ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ContentAgent│ │FormatAgent│ │ Structure│
│ 内容优化  │ │ 格式优化  │ │Agent     │
└──────────┘ └──────────┘ └──────────┘
       │          │          │
       └──────────┼──────────┘
                  │
                  ▼
          ┌──────────────┐
          │ReviewAgent   │
          │ 汇总结果     │
          └──────────────┘
```

**实现要点**：
1. 每个 Agent 专注于一个领域
2. 通过 Capability 配置每个 Agent 的工具
3. 使用"主 Agent + 子 Agent"模式

---

## 十一、混合架构实现总结（新增）

### 11.1 概述

混合架构是本项目的核心创新，结合了 Function Calling 和 ReAct 两种 Agent 模式的优势：

| 模式 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| **Function Calling** | 速度快、Token 少 | 推理能力有限 | 简单 CRUD 操作 |
| **ReAct** | 推理能力强、透明度高 | 速度慢、Token 多 | 复杂分析/优化 |
| **混合架构** | 自动选择最优路径 | 架构复杂度增加 | **所有场景** |

### 11.2 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户请求                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HybridAgent                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 TaskClassifier                               ││
│  │  分析用户输入，判断任务复杂度：                                ││
│  │  - 长度、关键词、模式匹配                                      ││
│  │  - 返回: ExecutionMode (FUNCTION_CALLING | REACT)            ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│         ┌────────────────────┴────────────────────┐              │
│         │                                         │              │
│         ▼                                         ▼              │
│  ┌─────────────────┐                     ┌─────────────────┐    │
│  │ Function Calling│                     │     ReAct       │    │
│  │     Agent       │                     │     Agent       │    │
│  │                 │                     │                 │    │
│  │ - 1次 LLM 调用   │                     │ - 多轮循环      │    │
│  │ - 快速返回       │                     │ - 思考可见      │    │
│  │ - 适合简单操作   │                     │ - 适合复杂任务  │    │
│  └─────────────────┘                     └─────────────────┘    │
│         │                                         │              │
│         └────────────────────┬────────────────────┘              │
│                              │                                   │
│                              ▼                                   │
│                   ┌─────────────────────┐                       │
│                   │   ToolRegistry V2   │                       │
│                   │  - CVReader         │                       │
│                   │  - CVEditor         │                       │
│                   │  - CVBatchEditor    │                       │
│                   └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### 11.3 文件结构

```
backend/agents/
├── task_classifier.py          # 任务复杂度分类器
│   ├── ExecutionMode           # 执行模式枚举
│   ├── TaskComplexity          # 复杂度枚举
│   ├── ClassificationResult    # 分类结果
│   └── TaskClassifier          # 分类器实现
│
├── hybrid_agent.py             # 混合模式 Agent
│   ├── HybridAgentConfig       # 配置类
│   ├── ExecutionContext        # 执行上下文
│   └── HybridAgent             # 混合 Agent 实现
│
├── react_agent.py              # ReAct Agent（已有）
│   ├── ReActAgent
│   ├── ReActPromptBuilder
│   └── ReActOutputParser
│
└── tool_registry_v2.py         # 工具注册表 V2（已有）
    ├── ToolRegistry
    ├── ToolMetadata
    └── ToolStatus
```

### 11.4 任务分类规则

```python
# 简单任务（Function Calling）
SIMPLE_TASK_KEYWORDS = [
    "查看", "读取", "显示", "看看",  # 查询操作
    "名字", "姓名", "电话", "邮箱",   # 基本字段
    "改", "修改", "更新", "换成",     # 修改操作
    "删除", "移除",                   # 删除操作
]

# 复杂任务（ReAct）
COMPLEX_TASK_KEYWORDS = [
    "优化", "改进", "完善", "提升",   # 优化类
    "分析", "评估", "检查", "诊断",   # 分析类
    "建议", "推荐", "指导",           # 建议类
    "批量", "全部", "所有", "整份",   # 批量类
]

# 模式匹配
SIMPLE_PATTERNS = [
    r"^把(.+?)改成(.+)$",             # "把X改成Y"
    r"^修改(.+?)为(.+)$",             # "修改X为Y"
    r"^删除(.+)$",                    # "删除X"
    r"^查看(.+)$",                    # "查看X"
]
```

### 11.5 使用示例

#### 创建混合 Agent

```python
from agents import create_hybrid_agent, ExecutionMode

# 方式1：自动模式（推荐）
agent = create_hybrid_agent(
    resume_data=resume_data,
    capability="advanced",
    llm_call_fn=my_llm_call,
    mode=ExecutionMode.AUTO,  # 自动选择
)

# 方式2：强制 Function Calling
agent = create_hybrid_agent(
    resume_data=resume_data,
    capability="base",
    llm_call_fn=my_llm_call,
    mode=ExecutionMode.FUNCTION_CALLING,  # 强制快速模式
)

# 方式3：强制 ReAct
agent = create_hybrid_agent(
    resume_data=resume_data,
    capability="optimizer",
    llm_call_fn=my_llm_call,
    mode=ExecutionMode.REACT,  # 强制推理模式
)
```

#### 处理用户消息

```python
# 非流式
response = agent.process_message("把名字改成张三")
print(response.message.content)

# 流式
for event in agent.process_message_stream("优化我的简历"):
    if event["type"] == "mode_selected":
        print(f"✅ 选择模式: {event['mode']}")
    elif event["type"] == "thinking":
        print(f"🤔 思考: {event['content']}")
    elif event["type"] == "tool_call":
        print(f"🔧 调用工具: {event['tool_name']}")
    elif event["type"] == "content":
        print(f"💬 回复: {event['content']}")
```

### 11.6 流式事件类型

```python
# 模式选择事件
{
    "type": "mode_selected",
    "mode": "function_calling" | "react",
    "complexity": "simple" | "medium" | "complex",
    "confidence": 0.9,
    "reason": "包含简单操作关键词",
}

# Function Calling 路径事件
{
    "type": "thinking",
    "content": "📥 接收: 把名字改成张三\n🔧 使用 Function Calling 模式",
}

# ReAct 路径事件
{
    "type": "thinking",
    "content": "📥 接收: 优化我的简历\n🧠 使用 ReAct 推理模式",
}
```

### 11.7 统计信息

```python
# 获取统计信息
stats = agent.get_stats()
print(stats)
# {
#     "total_requests": 100,
#     "function_calling_count": 75,
#     "react_count": 25,
#     "function_calling_ratio": 0.75,
#     "react_ratio": 0.25,
# }
```

### 11.8 与 CVAgent 的关系

```
┌─────────────────────────────────────────────────────────┐
│                    CVAgent (当前主 Agent)                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  直接使用 LLM Function Calling                      │ │
│  │  - _call_llm_agent_stream()                         │ │
│  │  - _execute_llm_tool()                              │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  未来可选：迁移到 HybridAgent                             │
│  - 简单任务：保持现有 Function Calling                   │
│  - 复杂任务：切换到 ReAct 模式                            │
└─────────────────────────────────────────────────────────┘
```

### 11.9 调试与监控

```python
# 分类解释
from agents import TaskClassifier

explanation = TaskClassifier.explain_classification("优化我的简历")
print(explanation)
# 任务: 优化我的简历...
# 模式: react
# 复杂度: complex
# 置信度: 0.85
# 原因: 包含复杂任务关键词: 优化
```

---

## 十三、基于最新代码的进一步优化建议

### 13.1 HybridAgent 完善建议

**现状分析**：
- ✅ 已实现 TaskClassifier（任务分类器）
- ✅ 已实现 HybridAgent（混合模式 Agent）
- ✅ 已支持 Function Calling 和 ReAct 两种路径
- 🔄 工具执行逻辑需要完善（标记为"待实现"）

**优化方向**：

#### 方案 A：完善工具执行逻辑

**当前状态**：`_handle_tool_calls` 和 `_handle_tool_calls_stream` 标记为"待实现"

**实现要点**：
```python
def _handle_tool_calls_stream(self, tool_calls, messages, user_message):
    """流式处理工具调用"""
    for tool_call in tool_calls:
        func = tool_call["function"]
        tool_name = func["name"]
        tool_params = json.loads(func.get("arguments", "{}"))

        # 发送工具开始
        yield {
            "type": "tool_start",
            "tool_name": tool_name,
            "params": tool_params
        }

        # 执行工具（使用现有的 ToolExecutor）
        result = self.executor.execute_tool(tool_name, tool_params)

        # 发送工具结果
        yield {
            "type": "tool_result",
            "tool_name": tool_name,
            "result": result
        }
```

#### 方案 B：增强 TaskClassifier 精度

**当前分类规则**：基于关键词和正则匹配

**改进方向**：
1. **增加语义分析**：使用 LLM 对模糊输入进行二次分类
2. **学习用户习惯**：记录分类结果和用户反馈，动态调整
3. **上下文感知**：根据对话历史调整分类（如连续多轮操作）

**示例**：
```python
class AdvancedTaskClassifier(TaskClassifier):
    """增强型任务分类器"""

    @classmethod
    def classify_with_llm(
        cls,
        user_message: str,
        llm_call_fn: Callable
    ) -> ClassificationResult:
        """使用 LLM 进行辅助分类"""
        # 当置信度 < 0.7 时，调用 LLM 进行二次判断
        initial_result = cls.classify(user_message)

        if initial_result.confidence < 0.7:
            # LLM 判断
            prompt = f"""
            判断以下任务应该使用哪种模式：
            任务：{user_message}

            模式：
            - function_calling: 简单操作（查看、修改、删除）
            - react: 复杂操作（优化、分析、批量）

            返回格式：function_calling 或 react
            """
            # 调用 LLM...

        return initial_result
```

---

### 13.2 与 CVAgent 的集成方案

**现状**：
- CVAgent 是当前主 Agent（已集成 Capability 系统）
- HybridAgent 是新实现的混合架构
- 两者独立存在，需要统一

**方案 A：CVAgent 内嵌 TaskClassifier**

**思路**：在 CVAgent 内部使用 TaskClassifier，复杂任务自动切换 ReAct

**实现要点**：
```python
class CVAgent:
    def process_message_stream(self, user_message: str):
        # 1. 使用 TaskClassifier 分类
        classification = TaskClassifier.classify(user_message)

        # 2. 发送分类信息（前端展示）
        yield {
            "type": "mode_selected",
            "mode": classification.mode.value,
            "complexity": classification.complexity.value
        }

        # 3. 根据分类选择处理方式
        if classification.mode == ExecutionMode.REACT:
            # 切换到 ReAct 模式
            yield from self._process_with_react(user_message)
        else:
            # 使用现有 Function Calling 逻辑
            yield from self._call_llm_agent_stream(user_message)
```

**方案 B：AgentManager 路由**

**思路**：在 AgentManager 层面根据任务类型选择 Agent

**实现要点**：
```python
class AgentManager:
    def get_or_create(self, session_id, capability, mode):
        """获取或创建 Agent"""
        # 检查是否需要 HybridAgent
        if mode == "auto":
            return create_hybrid_agent(...)

        # 否则返回标准 CVAgent
        return CVAgent(capability=capability)
```

---

### 13.3 用户体验优化

#### 方案 A：模式切换可视化

**前端展示**：
```
┌─────────────────────────────────────────┐
│ 📊 任务分析完成                         │
│ ├─ 任务类型：复杂优化                   │
│ ├─ 推荐模式：ReAct 推理模式             │
│ ├─ 预计时间：5-10 秒                     │
│ └─ [切换到快速模式] [继续]              │
└─────────────────────────────────────────┘
```

#### 方案 B：渐进式展示（SophiaPro 风格）

**ReAct 模式下的展示优化**：
```
┌─────────────────────────────────────────┐
│ 📍 步骤 1/3：分析简历结构                │
│                                          │
│ 🤔 思考：                               │
│   我需要先读取完整简历，分析当前状态    │
│                                          │
│ 💬 回复：                               │
│   好的，让我先读取您的简历数据...        │
│                                          │
│ 🔧 执行中：                              │
│   ━━━━━━━━━━━━━━━━━━━━━━━ 100%          │
│   ✅ CVReader 执行完成 (45ms)            │
└─────────────────────────────────────────┘
```

---

### 13.4 性能优化建议

#### 方案 A：智能缓存

**缓存策略**：
```python
class ToolResultCache:
    """工具结果缓存"""

    def __init__(self):
        self._cache = {}
        self._ttl = 60  # 60秒过期

    def get(self, tool_name: str, params: Dict) -> Optional[Any]:
        key = f"{tool_name}:{hash(json.dumps(params, sort_keys=True))}"

        if key in self._cache:
            result, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl:
                return result

        return None

    def set(self, tool_name: str, params: Dict, result: Any):
        key = f"{tool_name}:{hash(json.dumps(params, sort_keys=True))}"
        self._cache[key] = (result, time.time())
```

**使用场景**：
- CVReader 读取同一路径
- 频繁查询的基本信息

#### 方案 B：并行工具调用

**场景**：用户同时请求多个独立操作

```
用户："查看我的姓名、电话和教育经历"

传统方式：
CVReader("basic.name") → CVReader("basic.phone") → CVReader("education")

并行方式：
parallel([
    CVReader("basic.name"),
    CVReader("basic.phone"),
    CVReader("education")
])
```

**实现要点**：
```python
import asyncio

async def _parallel_tool_calls(self, tool_calls: List[Dict]):
    """并行执行工具调用"""
    tasks = []
    for tool_call in tool_calls:
        tasks.append(self._execute_tool_async(tool_call))

    results = await asyncio.gather(*tasks)
    return results
```

---

### 13.5 监控与可观测性

#### 方案 A：结构化日志

**日志格式**：
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "session_id": "abc123",
  "event_type": "tool_call",
  "tool_name": "CVEditor",
  "params": {"path": "basic.name", "action": "update"},
  "result": {"success": true},
  "duration_ms": 45,
  "mode": "function_calling",
  "complexity": "simple"
}
```

#### 方案 B：性能指标 Dashboard

**监控指标**：
- 模式选择分布（Function Calling vs ReAct）
- 平均响应时间（分模式统计）
- 工具调用成功率
- Token 消耗统计

**用途**：
1. 优化 TaskClassifier 规则
2. 识别性能瓶颈
3. 成本优化

---

### 13.6 实施优先级（更新）

| 优先级 | 优化项 | 难度 | 效果 | 依赖 |
|--------|--------|------|------|------|
| **高** | 完善 HybridAgent 工具执行 | 中 | 混合架构可用 | - |
| **高** | TaskClassifier 精度提升 | 中 | 减少误分类 | - |
| **中** | 模式切换可视化 | 低 | 用户体验提升 | 前端 |
| **中** | 智能缓存 | 低 | 性能提升 | - |
| **中** | 结构化日志 | 低 | 可观测性 | - |
| **低** | 并行工具调用 | 中 | 复杂场景性能提升 | - |
| **低** | 性能 Dashboard | 中 | 运维友好 | 前端+后端 |

---

### 13.7 与 SophiaPro 的对比总结

| 特性 | SophiaPro | 本项目（现状） | 本项目（优化后） |
|------|-----------|--------------|----------------|
| **Agent 类型** | 统一 AmpliftAgent | CVAgent + HybridAgent | 统一 HybridAgent |
| **执行模式** | ReAct 为主 | Function Calling 为主 | 自动切换 FC/ReAct |
| **任务分类** | 隐式（Planning） | TaskClassifier | TaskClassifier + LLM |
| **工具钩子** | pre/post hooks | LoggingToolHook | 完整钩子系统 |
| **状态管理** | AgentState | AgentState | AgentState + 缓存 |
| **消息协议** | CLTP (Span/Content) | 简单消息类型 | CLTP 标准化 |
| **可观测性** | 完善 | 基础 | 结构化日志 + Dashboard |

---

## 十四、参考资料

- **SophiaPro**: 内部参考架构项目
- **UP简历**: https://upcv.tech/builder/cmjnzf6a33jnula2cw94ptbdz
- **LangChain**: https://python.langchain.com/
- **ReAct Paper**: "ReAct: Synergizing Reasoning and Acting in Language Models"
- **DeepSeek API**: https://platform.deepseek.com/
