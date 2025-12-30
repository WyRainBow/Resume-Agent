# 双项目 Agent 架构分析与改进方案

> **分析日期**：2025-12-30
> **目标项目**：`/Users/wy770/AI 简历`
> **参考项目**：
> 1. `/Users/wy770/AI/sophia-pro` - 通用 Agent 框架
> 2. `AI对话创建简历-参考分析.md` - 简历 AI 产品分析

---

## 目录

1. [核心问题诊断](#1-核心问题诊断)
2. [参考项目 A：sophia-pro 架构分析](#2-参考项目-asophia-pro-架构分析)
3. [参考项目 B：AI 简历产品架构分析](#3-参考项目-bai-简历产品架构分析)
4. [当前项目架构分析](#4-当前项目架构分析)
5. [三维对比分析](#5-三维对比分析)
6. [改进方案建议](#6-改进方案建议)
7. [实施路线图](#7-实施路线图)

---

## 1. 核心问题诊断

### 1.1 用户反馈的问题

> "但是我现在的简历项目没有办法做到真正的 Agent 输出调用"

**问题本质**：
1. **工具调用不彻底** - LLM 返回工具调用后，执行流不完整
2. **多轮对话不稳定** - 上下文状态管理有缺陷
3. **Agent 行为不一致** - 相同输入可能产生不同输出

### 1.2 根本原因分析

| 问题类别 | 具体表现 | 根本原因 |
|---------|---------|---------|
| **架构层面** | 垂直 Agent 类扩展性差 | 没有统一的 Agent 工厂和能力包系统 |
| **状态管理** | 多轮对话上下文丢失 | 缺少像 sophia-pro 的 AgentState 统一管理 |
| **工具调用** | 工具调用链不完整 | 缺少完整的消息流架构（MemoryStep + 事件） |
| **配置灵活性** | 不同场景需要硬编码 | 缺少 Capability 驱动的配置系统 |

---

## 2. 参考项目 A：sophia-pro 架构分析

### 2.1 核心架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           sophia-pro Agent 架构                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     UnifiedAgent Factory                             │   │
│  │  - create_unified_agent(entry_mode, capabilities, **kwargs)          │   │
│  │  - 通过 Capability 配置 Agent 行为                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      AmpliftAgent (核心)                             │   │
│  │  继承: BrowserAgent                                                  │   │
│  │  特性:                                                               │   │
│  │    - 统一消息流架构（MemoryStep + 事件消息）                          │   │
│  │    - 代码安全守卫（CodeGuard）                                        │   │
│  │    - 流式工具状态通知                                                 │   │
│  │    - **设计理念：组合优于继承**                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │              │              │              │                      │
│         ▼              ▼              ▼              ▼                      │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │AgentState │  │Capability │  │MessageBld │  │StreamExec │               │
│  │全局状态    │  │能力包配置  │  │消息构建器  │  │流式执行器  │               │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘               │
│                                             │                               │
│                                             ▼                               │
│                                    ┌─────────────────┐                     │
│                                    │   ToolHooks     │                     │
│                                    │ 工具调用钩子系统  │                     │
│                                    └─────────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件详解

#### 2.2.1 Capability - 能力包系统

**源文件**：`amplift/capability.py`

**核心概念**：Capability 是一组可组合的系统配置，用于替代垂直 Agent。

```python
@dataclass
class Capability:
    """能力包定义"""
    name: str                           # 能力包名称，如 "writer", "sourcing"
    instructions_addendum: str = ""     # 追加到 system prompt 的指令
    tool_policy: ToolPolicy             # 工具使用策略
    enable_skills: bool = True          # 是否挂载 .skills 目录
    setup: Optional[Callable] = None    # 可选的初始化函数
```

**ToolPolicy - 动态工具白名单**：

```python
@dataclass
class ToolPolicy:
    whitelist: Optional[List[str]] = None           # 通用白名单
    whitelist_interactive: Optional[List[str]] = None  # 交互模式白名单
    whitelist_automated: Optional[List[str]] = None    # 自动化模式白名单

    def get_effective_whitelist(self, run_automated: bool) -> Optional[List[str]]:
        """根据当前模式返回生效的白名单"""
        if run_automated and self.whitelist_automated is not None:
            return self.whitelist_automated
        if not run_automated and self.whitelist_interactive is not None:
            return self.whitelist_interactive
        return self.whitelist
```

**预定义 Capability**：

| Capability | 用途 | 工具策略 |
|-----------|------|---------|
| `BASE_CAPABILITY` | 基础能力 | 默认工具集 |
| `WRITER_CAPABILITY` | 内容创作 | craft_content, file_export 等 |
| `SOURCING_CAPABILITY` | 资源搜索 | sourcing_find_influencers 等 |

**Capability 可组合性**：

```python
# 支持多个 Capability 合并
merged = WRITER_CAPABILITY.merge_with(SOURCING_CAPABILITY)
# 结果：name="writer+sourcing"，指令合并，工具策略取并集
```

#### 2.2.2 CapabilityRegistry - 能力包注册中心

**源文件**：`amplift/capability_registry.py`

**核心功能**：

1. **注册 Capability**：`register(capability)`
2. **Mode 映射**：将 "report" → ["writer"]，"sourcing" → ["sourcing"]
3. **解析合并**：`resolve_capabilities()` 返回合并后的 Capability

```python
class CapabilityRegistry:
    @classmethod
    def resolve_capabilities(
        cls,
        mode: Optional[str] = None,
        explicit_capabilities: Optional[List[str]] = None,
    ) -> Capability:
        """解析并合并 capabilities，返回最终配置"""
        # 优先级：显式 > mode 映射 > BASE_CAPABILITY
```

#### 2.2.3 UnifiedAgent Factory - 统一 Agent 工厂

**源文件**：`amplift/agents/unified_agent.py`

**工作流程**：

```
create_unified_agent(mode="report")
    │
    ▼
1. 解析 capabilities
   → CapabilityRegistry.resolve_capabilities("report")
   → 返回 WRITER_CAPABILITY
    │
    ▼
2. 构建指令
   → base_instructions + product_prompt + capability_addendum
    │
    ▼
3. 构建工具白名单
   → capability.tool_policy.get_effective_whitelist(run_automated)
    │
    ▼
4. 创建 AmpliftAgent
   → AmpliftAgent(instructions=..., default_tools=whitelist, ...)
    │
    ▼
5. 注册工具实例
   → _register_tool_instances(agent, capability, ...)
   → 根据 tool_policy 动态注册工具
    │
    ▼
6. 执行 Capability setup
   → capability.setup(context, shared_state)
```

**关键设计**：

- **只保留一个运行时 Agent 实体**（AmpliftAgent）
- **所有入口都创建同一个 Agent 类**
- **通过 Capability 配置行为差异**

#### 2.2.4 AgentState - 全局状态管理

**源文件**：`amplift/agent_state.py`

**功能**：Agent 全局状态容器，用于在 agent 的不同 tools 之间共享数据。

**核心方法**：

```python
class AgentState:
    def set(self, key: str, value: Any) -> None
    def get(self, key: str, default: Any = None) -> Any
    def has(self, key: str) -> bool
    def delete(self, key: str) -> None
    def update(self, data: Dict[str, Any]) -> None
    def clear(self) -> None
    def to_dict(self) -> Dict[str, Any]
```

**设计亮点**：
- 使用 `RLock` 支持嵌套调用
- `to_dict()` 返回副本，防止外部修改
- 简洁的 API 设计

#### 2.2.5 MessageBuilder - 消息构建器（CLTP 协议）

**源文件**：`amplift/message_builder.py`

**核心枚举**：

```python
# Span 名称：整个 Agent 执行周期的不同阶段
PLAN, PROCEDURE, TASK, STEP, PLAIN, HITL, TOOL_CALLING, OUTPUT, THINK

# Span 状态：START, END

# Content 通道：PLAIN, HITL, TOOL_CALLING, OUTPUT, FORM, AUTH, SYSTEM
```

**工厂方法**：

| 方法 | 用途 |
|------|------|
| `create_procedure_span()` | 创建 procedure span（整个 agent 周期） |
| `create_step_span()` | 创建 step span（单个步骤） |
| `create_tool_calling_span()` | 创建 tool_calling span |
| `create_thinking_span()` | 创建 thinking span（思考阶段） |
| `create_plain_message()` | 创建纯文本消息 |
| `create_output_message()` | 创建输出文件消息 |
| `create_interrupt_message()` | 创建中断消息 |

#### 2.2.6 StreamingLocalPythonExecutor - 流式执行器

**源文件**：`amplift/streaming_executor.py`

**核心机制**：工具调用前后的钩子机制

```python
class StreamingLocalPythonExecutor:
    def register_pre_tool_call_hook(self, hook: Callable) -> None
    def register_post_tool_call_hook(self, hook: Callable) -> None

    def _wrap_tool(self, tool, tool_name: str):
        """包装工具，注入钩子"""
        async def wrapped(*args, **kwargs):
            # pre_tool_call hook
            # 执行工具
            # post_tool_call hook
```

**钩子类型**：
- `InterruptCheckHook` - 中断检查
- `ToolStatusMessageHook` - 工具状态消息发送

---

## 3. 参考项目 B：AI 简历产品架构分析

**源文件**：`docs/AI对话创建简历-参考分析.md`

### 3.1 四层架构

```
┌─────────────────────────────────────────┐
│      用户交互层 (User Interaction)      │
│  - NLP: 意图识别、信息提取              │
│  - 上下文管理: 对话历史、状态维护        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      核心智能体 (Core Agent / LLM)       │
│  - 意图识别与任务规划                    │
│  - 知识库与策略引擎                      │
│  - 内容生成                              │
│  - 推理与决策                            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      工具层 (Tool Layer)                 │
│  - CVReader: 读取简历数据                │
│  - CVEditor: 修改简历字段                │
│  - CVTemplateList: 获取模板列表           │
│  - TemplateSwitcher: 切换模板            │
│  - SmartFitToOnePage: 智能排版            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      数据管理层 (Data Management)        │
│  - 简历数据存储 (JSON)                   │
│  - 版本控制                              │
└─────────────────────────────────────────┘
```

### 3.2 关键设计模式

#### 3.2.1 Agent + Tools 模式

```json
// CVEditor 工具调用示例
{
  "name": "CVEditor",
  "path": "sections.experience.items[0].position",
  "action": "update",
  "value": "高级后端开发实习生"
}
```

**路径规则**：
- 使用点号（`.`）分隔层级
- 数组使用方括号索引（`items[0]`）
- 从 `sections` 开始，指向具体模块

#### 3.2.2 动态任务图（非严格状态机）

**核心任务节点**：
- 每个简历模块是一个任务节点
- 每个节点有目标状态和前置条件
- 支持非线性跳转

**意图切换处理**：

| 情况 | 处理方式 |
|------|---------|
| 完全不同任务 | 暂停当前，切换焦点，保存状态 |
| 子任务/相关优化 | 保持焦点，调整子任务优先级 |
| 元问题 | 暂停所有任务，回答后引导回主线 |
| 冲突且未完成 | 提示用户确认切换 |

#### 3.2.3 上下文管理（多层次存储）

| 存储类型 | 内容 | 存储方式 |
|---------|------|---------|
| **短期内存** | 对话历史、当前任务状态 | 内存/KV 存储 |
| **长期记忆** | 简历数据、用户偏好、知识库 | 向量数据库/结构化数据库 |

**上下文窗口限制应对策略**：

1. **滑动窗口 / 截断**：只保留最近 N 轮对话
2. **摘要/压缩**：用 LLM 压缩较早内容
3. **RAG**：按需检索而非全量加载
4. **结构化信息提取**：立即提取并存储，减少对对话历史的依赖

#### 3.2.4 RAG 知识库架构

```
用户查询（行业/岗位）
    ↓
嵌入模型 → 查询向量
    ↓
向量数据库（相似度搜索）
    ↓
检索相关文本块
    ├─ 优化指南
    ├─ STAR 示例
    └─ 技能关键词
    ↓
构建增强提示
    ├─ 角色定义
    ├─ 检索到的知识
    ├─ 用户简历片段
    └─ 用户问题
    ↓
LLM 生成回复
```

**知识库构建**：
- **结构化数据**：模板元数据、行业关键词、FAQ
- **非结构化文本**：优化指南、STAR 法则示例、行业报告
- **向量嵌入**：通过嵌入模型转换为向量，存储在向量数据库

### 3.3 工具执行流程

```
LLM 生成工具调用 JSON
    ↓
转换为 JSON 格式
    ↓
验证工具调用参数
    ↓
执行工具（CVEditor/CVReader 等）
    ↓
返回执行结果
    │
    ├─ 成功：{"status": "success", "message": "已更新..."}
    └─ 失败：{"status": "error", "message": "路径不存在..."}
    ↓
更新上下文状态
```

---

## 4. 当前项目架构分析

### 4.1 当前架构

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│  /api/cv-agent/chat (带 session_id)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AgentManager                              │
│  - 会话存储（内存 Dict）                                      │
│  - 会话生命周期管理                                           │
│  - Agent 实例缓存                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CVAgent (核心)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ AgentState   │  │IntentRecog   │  │ ToolExecutor│         │
│  │ (状态管理)   │  │(意图识别)    │  │ (工具执行)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    ToolRegistry                      │   │
│  │  CVReader | CVEditor | (未来可扩展更多工具)          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   MessageBuilder                              │
│  统一的消息格式构建器                                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 分层架构（规则层 + LLM 层）

```
用户输入
    │
    ▼
┌─────────────────────────────────────────────────────┐
│                  CVAgent.process_message()           │
│                                                      │
│  ┌─────────────────────────────────────────────────┐│
│  │           第一层：规则识别（IntentRecognizer）    ││
│  │  - 快速、低成本、可预测                           ││
│  │  - 处理常见场景（添加/修改/删除/查看）             ││
│  └─────────────────────────────────────────────────┘│
│                        │                             │
│                  识别成功？                          │
│                   /    \                             │
│                 是      否                           │
│                 │        │                           │
│                 ▼        ▼                           │
│         执行工具    ┌──────────────────────────────┐│
│         返回结果    │  第二层：LLM 兜底              ││
│                    │  - DeepSeek Function Calling  ││
│                    │  - 处理复杂/模糊场景           ││
│                    └──────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### 4.3 已实现的核心组件

| 组件 | 文件 | 功能 | 状态 |
|------|------|------|------|
| **AgentState** | `agent_state.py` | 统一状态管理 | ✅ 已实现 |
| **AgentManager** | `agent_manager.py` | 会话管理 | ✅ 已实现 |
| **CVAgent** | `cv_agent.py` | 核心对话 Agent | ✅ 已实现 |
| **IntentRecognizer** | `intent_recognizer.py` | 意图识别 | ✅ 已实现 |
| **ToolExecutor** | `tool_executor.py` | 工具执行器 | ✅ 已实现 |
| **ToolHooks** | `tool_hooks.py` | 工具调用钩子 | ✅ 已实现 |
| **MessageBuilder** | `message_builder.py` | 消息构建器 | ✅ 已实现 |
| **ToolRegistry** | `tool_registry.py` | 工具注册表 | ✅ 已实现 |

### 4.4 当前限制

1. **无 Capability 系统**
   - 无法通过配置动态调整 Agent 行为
   - 新场景需要修改代码

2. **工具调用流不完整**
   - 缺少像 sophia-pro 的完整消息流架构
   - 工具调用状态通知不够细致

3. **RAG 未实现**
   - 没有知识库
   - STAR 法则等优化策略硬编码在 prompt 中

4. **Skill 系统缺失**
   - 方法论无法外挂
   - Prompt 修改需要重新部署

---

## 5. 三维对比分析

### 5.1 架构对比

| 维度 | sophia-pro | AI 简历产品 | 当前项目 |
|------|-----------|-------------|---------|
| **核心模式** | UnifiedAgent + Capability | 4 层架构 | 分层架构 |
| **状态管理** | AgentState (线程安全) | 多层次存储 | AgentState (简化) |
| **工具调用** | 动态白名单 | 固定工具集 | 静态注册 |
| **消息流** | MemoryStep + 事件 | 简单请求-响应 | MessageBuilder |
| **知识库** | .skills 目录 + RAG | 向量数据库 + RAG | ❌ 无 |
| **扩展性** | Capability 组合 | 工具层扩展 | 代码修改 |

### 5.2 工具调用机制对比

| 特性 | sophia-pro | AI 简历产品 | 当前项目 | 差距 |
|------|-----------|-------------|---------|------|
| **工具定义** | 动态注册 | CVReader/CVEditor | LLM_TOOLS_DEFINITION | 硬编码 |
| **工具白名单** | ToolPolicy | 固定 | ❌ 无 | 需要 |
| **工具钩子** | pre/post hooks | ❌ | ✅ 有 | 已实现 |
| **工具状态流** | 工具调用 SSE 通知 | status 字段 | ❌ 无 | 需要 |
| **错误处理** | LLM 自我纠正 | status:error | 基础 | 需增强 |

### 5.3 上下文管理对比

| 特性 | sophia-pro | AI 简历产品 | 当前项目 | 差距 |
|------|-----------|-------------|---------|------|
| **短期内存** | 对话历史 | 对话历史 | chat_history | 基本一致 |
| **长期记忆** | AgentState | 向量数据库 | AgentState | 缺 RAG |
| **滑动窗口** | ✅ | ✅ | ✅ | 已实现 |
| **摘要压缩** | ✅ | ✅ | ✅ | 已实现 |
| **RAG 检索** | .skills | 向量 DB | ❌ | 需要 |

### 5.4 消息流对比

| 消息类型 | sophia-pro | AI 简历产品 | 当前项目 |
|---------|-----------|-------------|---------|
| **思考过程** | thinking span | ❌ | ✅ thinking |
| **工具调用** | tool_calling span | 工具调用 | ✅ tool_call |
| **工具结果** | tool_end | status | ✅ tool_result |
| **普通文本** | plain | 内容回复 | ✅ content |
| **进度通知** | plan/send_plan | ❌ | ❌ 缺失 |
| **文件输出** | output | ❌ | ❌ 不需要 |

---

## 6. 改进方案建议

### 6.1 优先级矩阵

```
┌─────────────────────────────────────────────────────────────────────────┐
│  高价值  ┌──────────────────────────────────────────────────────────┐   │
│   ↑      │  1. 完整的工具调用消息流  │  2. 简化版 Capability 系统   │   │
│          │  (tool_start + tool_end)  │  (动态配置 Agent 行为)      │   │
│          ├──────────────────────────┼──────────────────────────────┤   │
│          │  3. RAG 知识库基础版     │  4. 工具状态流式通知         │   │
│          │  (STAR 法则外挂)         │  (SSE 实时通知)             │   │
│   ↓      └──────────────────────────┴──────────────────────────────┘   │
│          ┌──────────────────────────────────────────────────────────┐   │
│  低价值   │  5. Skill 目录挂载        │  6. 多 Capability 组合       │   │
│          │  (.skills 目录)           │  (writer+sourcing 混合)     │   │
│          └──────────────────────────┴──────────────────────────────┘   │
│          └─────────────────────────────────────────────────────────────→
│          低难度                                                    高难度
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 阶段一：完整工具调用消息流（高价值 + 中难度）

**目标**：实现类似 sophia-pro 的完整工具调用状态通知

**实现方案**：

```python
# 扩展 MessageBuilder，增加工具状态消息

class MessageType(Enum):
    TEXT = "text"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    TOOL_START = "tool_start"      # 新增：工具开始执行
    TOOL_END = "tool_end"          # 新增：工具执行结束
    THINKING = "thinking"
    ERROR = "error"
    CLARIFY = "clarify"

# 在 ToolExecutor 中添加钩子
class ToolStatusNotifier:
    """工具状态通知器"""

    def pre_tool_call(self, context: ToolCallContext):
        """工具调用前：发送 TOOL_START 消息"""
        return AgentMessage(
            type=MessageType.TOOL_START,
            content=f"正在调用 {context.tool_name}...",
            metadata={
                "tool_name": context.tool_name,
                "params": context.params
            }
        )

    def post_tool_call(self, context: ToolCallContext):
        """工具调用后：发送 TOOL_END 消息"""
        status = "成功" if context.success else "失败"
        return AgentMessage(
            type=MessageType.TOOL_END,
            content=f"{context.tool_name} {status}",
            metadata={
                "tool_name": context.tool_name,
                "success": context.success,
                "duration_ms": context.duration_ms
            }
        )
```

**前端处理**：

```typescript
// 处理不同的消息类型
switch (event.type) {
  case "tool_start":
    showToolLoading(event.metadata.tool_name);
    break;
  case "tool_end":
    hideToolLoading(event.metadata.tool_name);
    showStatus(event.metadata.success ? "✓" : "✗");
    break;
  case "content":
    appendMessage(event.content);
    break;
}
```

### 6.3 阶段二：简化版 Capability 系统（高价值 + 中高难度）

**目标**：实现动态配置 Agent 行为，无需修改代码

**简化设计**（不需要完整的 sophia-pro Capability）：

```python
# backend/agents/capability.py

@dataclass
class SimpleCapability:
    """简化的能力包"""
    name: str
    system_prompt_addendum: str = ""     # 追加到 system prompt
    enabled_tools: List[str] = None      # 启用的工具列表
    disabled_tools: List[str] = None     # 禁用的工具列表

    def to_agent_config(self) -> Dict:
        """转换为 Agent 配置"""
        return {
            "system_prompt": self.system_prompt_addendum,
            "enabled_tools": self.enabled_tools or [],
            "disabled_tools": self.disabled_tools or [],
        }

# 预定义能力包
BASIC_CAPABILITY = SimpleCapability(
    name="basic",
    system_prompt_addendum="你是基础简历编辑助手..."
)

ADVANCED_CAPABILITY = SimpleCapability(
    name="advanced",
    system_prompt_addendum="你是高级简历优化专家，精通 STAR 法则...",
    enabled_tools=["CVReader", "CVEditor", "SkillsOptimizer"]
)

# Capability 注册表
class CapabilityRegistry:
    _capabilities = {
        "basic": BASIC_CAPABILITY,
        "advanced": ADVANCED_CAPABILITY,
    }

    @classmethod
    def get(cls, name: str) -> SimpleCapability:
        return cls._capabilities.get(name, BASIC_CAPABILITY)

# 使用
capability = CapabilityRegistry.get("advanced")
config = capability.to_agent_config()
agent = CVAgent(
    system_prompt_addendum=config["system_prompt"],
    enabled_tools=config["enabled_tools"]
)
```

### 6.4 阶段三：RAG 知识库基础版（高价值 + 高难度）

**目标**：将 STAR 法则等优化知识外挂到知识库

**简化设计**（先用文件系统，不需要向量数据库）：

```python
# backend/agents/knowledge_base.py

class SimpleKnowledgeBase:
    """简化的知识库（基于文件系统）"""

    def __init__(self, knowledge_dir: str):
        self.knowledge_dir = Path(knowledge_dir)
        self.index = self._build_index()

    def _build_index(self) -> Dict[str, List[str]]:
        """构建关键词到文件的索引"""
        index = {}
        for file in self.knowledge_dir.rglob("*.md"):
            content = file.read_text()
            # 简单的关键词提取
            keywords = self._extract_keywords(content)
            for kw in keywords:
                if kw not in index:
                    index[kw] = []
                index[kw].append(str(file))
        return index

    def search(self, query: str, top_k: int = 3) -> List[str]:
        """搜索相关知识"""
        # 关键词匹配
        results = []
        for kw in self._extract_keywords(query):
            if kw in self.index:
                results.extend(self.index[kw])
        return results[:top_k]

    def get_context(self, query: str) -> str:
        """获取查询的相关上下文"""
        files = self.search(query)
        context_parts = []
        for file in files[:2]:
            content = Path(file).read_text()
            context_parts.append(f"# {Path(file).name}\n{content[:500]}...")
        return "\n\n".join(context_parts)

# 使用
knowledge_base = SimpleKnowledgeBase("backend/agents/knowledge")
related_knowledge = knowledge_base.get_context("工作经历 优化")

# 注入到 LLM 上下文
system_prompt = f"""
{BASE_SYSTEM_PROMPT}

## 参考知识
{related_knowledge}
"""
```

**知识库目录结构**：

```
backend/agents/knowledge/
├── star_method/
│   ├── work_experience.md      # STAR 法则在工作经历中的应用
│   ├── project_experience.md   # STAR 法则在项目经历中的应用
│   └── examples.md             # 具体示例
├── optimization_tips/
│   ├── quantification.md       # 量化数据引导
│   ├── keywords.md             # 行业关键词
│   └── structure.md            # 简历结构建议
└── industry_specific/
    ├── backend_engineer.md     # 后端工程师专用
    ├── frontend_engineer.md    # 前端工程师专用
    └── ai_engineer.md          # AI 工程师专用
```

### 6.5 阶段四：工具状态流式通知（中高价值 + 中难度）

**目标**：通过 SSE 实时推送工具状态

**实现方案**：

```python
# backend/routes/cv_agent.py

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def event_generator():
        session_id, agent = agent_manager.get_or_create(...)

        # 流式处理消息
        async for event in agent.process_message_stream(request.message):
            # 确保事件包含 type 和 content
            if "type" not in event:
                event["type"] = "message"

            yield {
                "event": event["type"],
                "data": json.dumps(event, ensure_ascii=False)
            }

    return EventSourceResponse(event_generator())
```

**前端 SSE 处理**：

```typescript
const eventSource = new EventSource('/api/cv-agent/chat/stream');

eventSource.addEventListener('tool_start', (e) => {
  const data = JSON.parse(e.data);
  showToolStatus(data.tool_name, 'running');
});

eventSource.addEventListener('tool_end', (e) => {
  const data = JSON.parse(e.data);
  showToolStatus(data.tool_name, data.success ? 'success' : 'error');
});

eventSource.addEventListener('content', (e) => {
  const data = JSON.parse(e.data);
  appendContent(data.content);
});
```

---

## 7. 实施路线图

### 阶段一：完整工具调用消息流（1-2 天）

**任务清单**：

- [ ] 扩展 `MessageType` 枚举，增加 `TOOL_START` 和 `TOOL_END`
- [ ] 实现 `ToolStatusNotifier` 钩子
- [ ] 在 `ToolExecutor` 中集成工具状态通知
- [ ] 前端适配新的消息类型

**验收标准**：

- 用户能实时看到工具调用的开始和结束状态
- 工具调用失败时有明确的错误提示
- 前端 UI 有工具调用的加载动画

### 阶段二：简化版 Capability 系统（2-3 天）

**任务清单**：

- [ ] 实现 `SimpleCapability` 数据类
- [ ] 实现 `CapabilityRegistry`
- [ ] 定义预定义能力包（basic, advanced）
- [ ] 修改 `CVAgent` 支持 capability 配置
- [ ] API 支持 capability 参数

**验收标准**：

- 通过 API 参数可以切换不同的 Agent 行为模式
- 新增能力包不需要修改 CVAgent 代码
- 前端可以选择不同的能力模式

### 阶段三：RAG 知识库基础版（3-5 天）

**任务清单**：

- [ ] 实现 `SimpleKnowledgeBase`
- [ ] 创建知识库目录结构
- [ ] 编写 STAR 法则知识文档
- [ ] 修改 LLM 调用，注入知识库上下文
- [ ] 前端显示知识库引用

**验收标准**：

- LLM 生成的建议基于知识库内容
- 知识库文档修改后生效（不需要改代码）
- 用户可以看到参考的知识来源

### 阶段四：工具状态流式通知（1-2 天）

**任务清单**：

- [ ] 实现 `/chat/stream` SSE 端点
- [ ] 前端实现 SSE 事件监听
- [ ] 实现工具状态 UI 组件
- [ ] 错误处理和重连机制

**验收标准**：

- 用户能实时看到工具执行状态
- 网络中断后能自动重连
- 工具执行时间超过阈值时有提示

---

## 8. 总结

### 8.1 核心差距

| 差距类型 | 描述 | 优先级 |
|---------|------|-------|
| **工具调用流** | 缺少完整的工具状态通知 | 高 |
| **配置灵活性** | 缺少动态配置系统 | 高 |
| **知识管理** | 知识硬编码在 prompt 中 | 中高 |
| **流式通知** | 缺少实时状态推送 | 中 |

### 8.2 设计原则借鉴

从 sophia-pro 借鉴：

1. **Capability 系统思想**：简化实现即可，不需要完整版本
2. **工具钩子机制**：已有，需增强
3. **消息流架构**：需要完整的工具状态通知
4. **统一 Agent 工厂**：当前单 Agent 场景暂不需要

从 AI 简历产品借鉴：

1. **4 层架构**：基本符合，工具层可增强
2. **RAG 知识库**：可以大幅提升专业性
3. **动态任务图**：当前规则层已覆盖
4. **多层次存储**：当前简化版本已够用

### 8.3 当前优势

1. **分层架构合理**：规则层 + LLM 层效率高
2. **核心组件完整**：AgentState, MessageBuilder, ToolHooks 已实现
3. **会话管理成熟**：AgentManager 稳定运行
4. **前端友好**：统一的消息格式

### 8.4 建议优先级

```
1. 工具调用消息流（TOOL_START + TOOL_END）  →  立即实施
2. 简化版 Capability 系统                    →  近期实施
3. RAG 知识库基础版                          →  中期实施
4. 工具状态流式通知                          →  按需实施
```

---

**文档版本**：v1.0
**最后更新**：2025-12-30
