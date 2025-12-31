分析两个项目的 Agent 架构，重点是多 Agent 集成与管理方式。先查看两个项目的代码结构。


[4 tools called]


查看 sophia-pro-reference 的 Agent 架构细节：


[5 tools called]


查看 sophia-pro-reference 的 Agent 注册和管理机制：


[5 tools called]


查看 unified_agent 的实现，了解如何将多个 agent 作为工具：


[3 tools called]


## 架构对比分析

### 1. **sophia-pro-reference 的架构**

**核心设计模式：**
- **AgentRegistry**：注册中心模式，管理不同类型的 agent
- **Unified Agent**：单一运行时实体，通过 `Capability` 配置不同行为
- **工具即 Agent**：可以将其他 agent 包装成工具，通过 `additional_tools` 注册

**关键组件：**
```python
# AgentRegistry - 注册中心
AgentRegistry.register("default", factory=_create_default_agent)
AgentRegistry.register("report", factory=_create_report_agent)
AgentRegistry.register("sourcing", factory=_create_sourcing_agent)

# Unified Agent - 通过 Capability 配置
agent = create_unified_agent(
    entry_mode="report",  # 或 "sourcing"
    capabilities=["writer"],
    additional_tools=[...]  # 可以包含其他 agent 包装的工具
)
```

### 2. **当前项目的架构**

**核心设计模式：**
- **AgentManager**：会话管理（单例模式）
- **ToolRegistry**：工具注册中心
- **CVAgent**：主 agent，支持 Capability 配置

**当前状态：**
- 已有 `ToolRegistry` 和 `AgentManager`
- 已有 `Capability` 系统基础
- 缺少将 agent 作为工具集成的机制

## 多 Agent 集成方案

### 方案一：Agent 作为工具（推荐）

将每个 agent 包装成工具，注册到主 agent 的工具列表中。

**实现思路：**

1. **创建 AgentTool 包装器**：
```python
class AgentTool(BaseTool):
    """将 Agent 包装成工具"""
    
    def __init__(self, agent_name: str, agent_factory: Callable):
        self.agent_name = agent_name
        self.agent_factory = agent_factory
        self.name = f"call_{agent_name}_agent"
        self.description = f"调用 {agent_name} agent 处理特定任务"
    
    def execute(self, task: str, context: Dict = None) -> str:
        # 创建子 agent 实例
        agent = self.agent_factory(context=context)
        # 执行任务
        result = agent.process(task)
        return result
```

2. **注册到 ToolRegistry**：
```python
# 注册多个 agent 作为工具
ToolRegistry.register_factory(
    "optimization_agent",
    lambda **kwargs: create_optimization_agent(**kwargs)
)

ToolRegistry.register_factory(
    "diagnosis_agent", 
    lambda **kwargs: create_diagnosis_agent(**kwargs)
)

# 在主 agent 中注册这些工具
cv_agent.register_tool("call_optimization_agent", AgentTool("optimization", ...))
cv_agent.register_tool("call_diagnosis_agent", AgentTool("diagnosis", ...))
```

**优点：**
- 符合现有架构（工具系统已完善）
- LLM 可自动选择调用哪个 agent
- 易于扩展和维护

**缺点：**
- 需要为每个 agent 创建包装器
- 子 agent 的执行是同步的（可能需要异步支持）

### 方案二：Agent 注册中心模式（参考 sophia-pro）

类似 `AgentRegistry`，统一管理所有 agent 类型。

**实现思路：**

1. **扩展 AgentManager**：
```python
class AgentManager:
    # 现有功能：会话管理
    _sessions: Dict[str, AgentSession] = {}
    
    # 新增：Agent 类型注册
    _agent_types: Dict[str, Type[CVAgent]] = {}
    _agent_factories: Dict[str, Callable] = {}
    
    @classmethod
    def register_agent_type(cls, name: str, agent_class=None, factory=None):
        """注册 agent 类型"""
        if factory:
            cls._agent_factories[name] = factory
        elif agent_class:
            cls._agent_types[name] = agent_class
    
    def create_agent(self, agent_type: str, **kwargs) -> CVAgent:
        """创建指定类型的 agent"""
        if agent_type in self._agent_factories:
            return self._agent_factories[agent_type](**kwargs)
        elif agent_type in self._agent_types:
            return self._agent_types[agent_type](**kwargs)
        else:
            # 默认使用 CVAgent
            return CVAgent(**kwargs)
```

2. **在主 Agent 中调用子 Agent**：
```python
class CVAgent:
    def process(self, message: str):
        # 判断是否需要调用子 agent
        if self._needs_optimization(message):
            optimizer = agent_manager.create_agent("optimization", ...)
            return optimizer.process(message)
        # ... 其他逻辑
```

**优点：**
- 统一管理所有 agent 类型
- 便于动态创建和切换
- 符合注册中心模式

**缺点：**
- 需要修改现有 `AgentManager`
- 调用逻辑需要在主 agent 中显式处理

### 方案三：混合模式（最佳实践）

结合方案一和方案二：使用注册中心管理 agent 类型，将 agent 包装成工具供主 agent 调用。

**实现架构：**

```
┌─────────────────────────────────────┐
│      AgentManager (注册中心)         │
│  - 管理 agent 类型注册               │
│  - 管理会话生命周期                   │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌─────────┐         ┌──────────────┐
│ CVAgent │         │ AgentTool    │
│ (主)    │────────▶│ (包装器)     │
└─────────┘         └──────┬───────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │Optimize │ │Diagnosis│ │Import   │
        │Agent    │ │Agent    │ │Agent    │
        └─────────┘ └─────────┘ └─────────┘
```

**实现步骤：**

1. **扩展 AgentManager 支持类型注册**：
```python
class AgentManager:
    _agent_factories: Dict[str, Callable] = {}
    
    @classmethod
    def register_agent_factory(cls, name: str, factory: Callable):
        """注册 agent 工厂函数"""
        cls._agent_factories[name] = factory
    
    def create_agent_by_type(self, agent_type: str, **kwargs) -> CVAgent:
        """按类型创建 agent"""
        factory = self._agent_factories.get(agent_type)
        if factory:
            return factory(**kwargs)
        return CVAgent(**kwargs)  # 默认
```

2. **创建 AgentTool 包装器**：
```python
class AgentTool:
    """将 Agent 包装成工具，供 LLM 调用"""
    
    def __init__(self, agent_type: str, agent_manager: AgentManager):
        self.agent_type = agent_type
        self.agent_manager = agent_manager
        self.name = f"call_{agent_type}_agent"
    
    def __call__(self, task: str, context: Dict = None) -> str:
        # 创建子 agent
        agent = self.agent_manager.create_agent_by_type(
            self.agent_type,
            resume_data=context.get("resume_data"),
            session_id=context.get("session_id")
        )
        # 执行任务
        response = agent.process(task)
        return response.text
```

3. **在主 Agent 中注册工具**：
```python
class CVAgent:
    def __init__(self, ...):
        # ... 现有初始化
        
        # 注册子 agent 作为工具
        self._register_agent_tools()
    
    def _register_agent_tools(self):
        """注册子 agent 作为工具"""
        agent_manager = AgentManager()
        
        # 注册优化 agent
        optimization_tool = AgentTool("optimization", agent_manager)
        self.tool_registry.register("call_optimization_agent", optimization_tool)
        
        # 注册诊断 agent
        diagnosis_tool = AgentTool("diagnosis", agent_manager)
        self.tool_registry.register("call_diagnosis_agent", diagnosis_tool)
```

4. **注册 agent 类型**：
```python
# 在应用启动时注册
AgentManager.register_agent_factory(
    "optimization",
    lambda **kwargs: ResumeOptimizationAgent(**kwargs)
)

AgentManager.register_agent_factory(
    "diagnosis",
    lambda **kwargs: DiagnosisAgent(**kwargs)
)
```

## 管理集成建议

### 1. **统一接口**
所有 agent 实现统一接口：
```python
class BaseAgent:
    def process(self, message: str) -> AgentResponse:
        """处理消息的统一接口"""
        pass
    
    def get_capabilities(self) -> List[str]:
        """返回 agent 的能力列表"""
        pass
```

### 2. **上下文共享**
通过 `AgentState` 或 `shared_state` 共享上下文：
```python
# 子 agent 可以访问主 agent 的状态
agent = create_agent(
    agent_type="optimization",
    shared_state=main_agent.state  # 共享状态
)
```

### 3. **工具白名单**
通过 `Capability` 控制哪些 agent 工具可用：
```python
capability = Capability(
    tool_policy=ToolPolicy(
        whitelist=["CVReader", "CVEditor", "call_optimization_agent"]  # 包含 agent 工具
    )
)
```

### 4. **异步支持**
如果子 agent 执行耗时，考虑异步：
```python
class AsyncAgentTool:
    async def __call__(self, task: str) -> str:
        agent = await self.create_agent_async()
        return await agent.process_async(task)
```

## 总结

推荐采用方案三（混合模式）：
1. 使用 `AgentManager` 作为注册中心管理 agent 类型
2. 将子 agent 包装成 `AgentTool` 注册到主 agent
3. LLM 通过 Function Calling 自动选择调用
4. 通过 `Capability` 控制工具白名单
5. 通过 `shared_state` 共享上下文

这样既保持了现有架构的简洁性，又实现了灵活的多 agent 集成。

方案三部分集成了 SophiaPro 的架构，但未完全对齐。对比如下：

## 方案三 vs SophiaPro 架构对比

### 已集成的部分

1. AgentRegistry 模式
   - 方案三：通过扩展 `AgentManager` 支持 agent 类型注册
   - SophiaPro：独立的 `AgentRegistry` 类
   - 结论：功能等价，实现方式不同

2. 工具即 Agent
   - 方案三：通过 `AgentTool` 包装器将 agent 包装成工具
   - SophiaPro：通过 `additional_tools` 参数注册工具（可以是 agent）
   - 结论：思路一致，实现方式不同

3. Capability 系统
   - 方案三：已有 `Capability` 系统，可控制工具白名单
   - SophiaPro：通过 `Capability` 配置 prompt、工具白名单、enable_skills
   - 结论：已集成

### 未集成的部分

1. Unified Agent 模式
   - 方案三：多个独立的 Agent 实例（CVAgent、OptimizationAgent 等）
   - SophiaPro：单一 `Unified Agent` 运行时实体，通过 `Capability` 切换行为
   - 差异：SophiaPro 是“一个 Agent，多种能力”；方案三是“多个 Agent，各自独立”

2. 工具注册方式
   - 方案三：通过 `ToolRegistry` 注册，在主 Agent 初始化时注册
   - SophiaPro：通过 `additional_tools` 参数动态传入，在 Agent 构造时注册
   - 差异：SophiaPro 更灵活，支持运行时动态配置

3. Agent 创建方式
   - 方案三：通过 `AgentManager.create_agent_by_type()` 创建
   - SophiaPro：通过 `AgentRegistry.create()` 创建，支持工厂函数
   - 差异：SophiaPro 支持装饰器注册和工厂函数两种方式

## 架构差异总结

| 维度 | 方案三 | SophiaPro | 是否集成 |
|------|--------|-----------|---------|
| Agent 注册中心 | ✅ AgentManager 扩展 | ✅ AgentRegistry | ✅ 部分集成 |
| 工具即 Agent | ✅ AgentTool 包装器 | ✅ additional_tools | ✅ 部分集成 |
| Capability 系统 | ✅ 已有 | ✅ 完整实现 | ✅ 已集成 |
| Unified Agent | ❌ 多实例模式 | ✅ 单实例模式 | ❌ 未集成 |
| 工具注册方式 | ⚠️ ToolRegistry | ✅ additional_tools | ⚠️ 方式不同 |
| 工厂函数支持 | ⚠️ 简单工厂 | ✅ 装饰器+工厂 | ⚠️ 部分支持 |

## 结论

方案三集成了 SophiaPro 的部分架构思想（注册中心、工具即 Agent、Capability），但未采用 Unified Agent 模式。方案三更接近“多 Agent 协作”模式，而 SophiaPro 是“单 Agent 多能力”模式。

如果需要更接近 SophiaPro 的架构，需要：
1. 实现 Unified Agent：单一运行时实体，通过 Capability 切换行为
2. 统一工具注册：使用 `additional_tools` 参数而非 `ToolRegistry`
3. 增强工厂函数：支持装饰器注册和工厂函数两种方式

当前方案三更适合“多 Agent 协作”场景，而非“单 Agent 多能力”场景。




检查项目中现有的 agent 情况：


[4 tools called]


查看诊断系统和优化 agent 的实现：


[4 tools called]


## 当前项目的 Agent 现状

### 现有的 Agent（按类型分类）

1. 实现模式类（不同执行方式）
   - CVAgent：主对话 Agent（规则层 + LLM 层）
   - CoreAgent：核心 Agent（动态任务图）
   - ReActAgent：ReAct 模式
   - HybridAgent：混合模式（按复杂度选择）
   - DynamicAgent：LangChain 动态任务图

2. 功能增强类
   - ResumeOptimizationAgent：继承自 CVAgent，集成诊断系统
   - ConversationAgent：对话管理

3. 辅助模块（非独立 Agent）
   - ResumeDiagnosis：诊断器
   - GuidanceEngine：引导引擎
   - FollowUpSystem：追问系统

### 现状判断

目前不是真正的“多 Agent 协作系统”，而是：
- 多种实现模式（CVAgent、ReActAgent、HybridAgent 等）
- 功能增强版本（ResumeOptimizationAgent）
- 辅助模块（诊断系统）

这些更像是同一 Agent 的不同实现方式，而非独立的协作 Agent。

## 未来的多 Agent 规划

根据文档，未来可能的方向：

### 1. 多角色协作 Agent 系统（CrewAI 模式）

```
主 Agent (协调器)
├── 内容提取 Agent
├── 内容生成 Agent
├── 润色 Agent
├── JD 匹配 Agent
└── 质量检查 Agent
```

### 2. 功能专用 Agent 系统

- 简历生成 Agent：对话式生成
- 优化 Agent：简历优化（已有 ResumeOptimizationAgent）
- 诊断 Agent：简历诊断（已有诊断系统）
- 导入 Agent：简历导入解析
- JD 匹配 Agent：职位匹配优化

### 3. 当前缺失的集成机制

- Agent 注册中心：统一管理所有 Agent 类型
- Agent 作为工具：将子 Agent 包装成工具供主 Agent 调用
- Agent 协调器：协调多个 Agent 的协作流程
- 上下文共享：Agent 之间的状态共享

## 总结

- 现在：有多个 Agent 实现，但缺少协作机制
- 未来：需要建立多 Agent 协作架构（如方案三）

建议优先实现：
1. Agent 注册中心（扩展 AgentManager）
2. Agent 工具包装器（AgentTool）
3. 主 Agent 协调机制（CVAgent 作为主协调器）



基于方案三（混合模式）实现功能专用 Agent 系统。架构设计如下：

## 功能专用 Agent 系统架构（基于方案三）

### 核心架构设计

```
┌─────────────────────────────────────────┐
│      AgentManager (注册中心)            │
│  - 管理所有 Agent 类型注册               │
│  - 管理会话生命周期                      │
│  - 创建 Agent 实例                      │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌─────────┐         ┌──────────────┐
│ CVAgent │         │ AgentTool    │
│ (主协调)│────────▶│ (包装器)     │
└─────────┘         └──────┬───────┘
                          │
              ┌───────────┼───────────┬───────────┐
              │           │           │           │
              ▼           ▼           ▼           ▼
        ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
        │Generate │ │Optimize │ │Diagnosis│ │Import   │
        │Agent    │ │Agent    │ │Agent    │ │Agent    │
        └─────────┘ └─────────┘ └─────────┘ └─────────┘
              │           │           │           │
              └───────────┴───────────┴───────────┘
                          │
                          ▼
                  ┌──────────────┐
                  │ Shared State │
                  │ (上下文共享)  │
                  └──────────────┘
```

### 功能专用 Agent 列表

1. CVAgent（主协调 Agent）
   - 职责：统一入口，协调子 Agent
   - 功能：意图识别、任务分发、结果汇总

2. ResumeGenerationAgent（简历生成 Agent）
   - 职责：对话式生成简历
   - 功能：多轮对话收集信息、生成简历内容

3. ResumeOptimizationAgent（优化 Agent）
   - 职责：简历优化
   - 功能：诊断、引导、优化建议（已有基础）

4. ResumeDiagnosisAgent（诊断 Agent）
   - 职责：简历诊断
   - 功能：完整性、质量、结构、匹配度检查（已有诊断系统）

5. ResumeImportAgent（导入 Agent）
   - 职责：简历导入解析
   - 功能：PDF/Word 解析、结构化提取

6. JDMatcherAgent（JD 匹配 Agent）
   - 职责：职位匹配优化
   - 功能：JD 分析、匹配度计算、优化建议

### 实现步骤

#### 第一步：扩展 AgentManager（注册中心）

功能：
- 注册 Agent 类型（工厂函数）
- 创建 Agent 实例
- 管理 Agent 生命周期

关键接口：
```python
AgentManager.register_agent_factory(name, factory)
AgentManager.create_agent_by_type(agent_type, **kwargs)
AgentManager.list_agent_types()
```

#### 第二步：创建 AgentTool 包装器

功能：
- 将子 Agent 包装成工具
- 供主 Agent 通过 Function Calling 调用
- 处理 Agent 执行和结果返回

关键特性：
- 统一的工具接口
- 异步执行支持（可选）
- 错误处理和重试

#### 第三步：在主 Agent 中注册工具

功能：
- CVAgent 初始化时注册所有 Agent 工具
- 通过 Capability 控制工具白名单
- LLM 自动选择调用

#### 第四步：实现功能专用 Agent

每个 Agent 需要：
- 统一的接口（process_message）
- 独立的状态管理
- 共享上下文（shared_state）

### 架构优势

1. 模块化：每个 Agent 专注单一功能
2. 可扩展：新增 Agent 只需注册
3. 智能路由：LLM 自动选择调用
4. 统一管理：AgentManager 统一管理
5. 上下文共享：通过 shared_state 共享

### 与现有代码的集成

已有基础：
- ResumeOptimizationAgent（可改造）
- 诊断系统（可包装成 Agent）
- AgentManager（需扩展）
- ToolRegistry（已有）

需要新增：
- AgentTool 包装器
- 其他功能专用 Agent
- Agent 注册机制

### 实现优先级建议

Phase 1：基础架构（1-2 周）
1. 扩展 AgentManager 支持注册
2. 实现 AgentTool 包装器
3. 在 CVAgent 中注册工具

Phase 2：核心 Agent（2-3 周）
1. 改造 ResumeOptimizationAgent
2. 包装诊断系统为 DiagnosisAgent
3. 实现 ResumeGenerationAgent

Phase 3：扩展 Agent（1-2 周）
1. 实现 ResumeImportAgent
2. 实现 JDMatcherAgent

### 关键设计决策

1. 统一接口：所有 Agent 实现 `process_message(message: str) -> AgentResponse`
2. 状态共享：通过 `shared_state` 共享上下文
3. 工具注册：在主 Agent 初始化时自动注册
4. 能力控制：通过 Capability 控制可用工具

这个架构既保持了现有代码的简洁性，又实现了灵活的多 Agent 协作。需要我开始实现吗？



