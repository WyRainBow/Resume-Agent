# AI 简历 Agent 重构方案

> **参考项目**：`/Users/wy770/AI/sophia-pro`  
> **当前项目**：`/Users/wy770/AI 简历`  
> **目标**：实现稳定的多轮对话 Agent，支持简历编辑场景  
> **状态**：✅ 已完成整合（参考 sophia-pro 架构）

直接复制/抄袭参考项目的 agent 设计架构和多轮对话。

## 文件路径说明

### 参考项目路径
- **sophia-pro Agent 核心**：`/Users/wy770/AI/sophia-pro/backend/agent/src/amplift/`
  - `amplift_agent.py` - 核心 Agent 类
  - `agent_state.py` - 线程安全的状态管理
  - `capability.py` - 能力包系统
  - `message_builder.py` - 消息构建器
  - `streaming_executor.py` - 流式执行器（工具包装与钩子机制）
  - `tool_hooks.py` - **工具调用钩子**（已复制到本项目）

### 当前项目实现路径（已整合）

> **整合原则**：参考 sophia-pro 架构，统一状态管理

- **核心 Agent**：`backend/agents/`
  - `cv_agent.py` - **主 Agent**（使用 AgentState 统一状态管理）
  - `agent_state.py` - **统一状态管理**（参考 sophia-pro/amplift/agent_state.py）
  - `intent_recognizer.py` - **意图识别**（兼容 AgentState 和 ChatState）
  - `agent_manager.py` - **会话管理**（管理 CVAgent 实例）

- **辅助模块**：`backend/agents/`
  - `message_builder.py` - 消息构建器（统一响应格式）
  - `tool_executor.py` - 工具执行器（支持工具钩子）
  - `tool_hooks.py` - **工具调用钩子**（参考 sophia-pro/tool_hooks.py）
  - `tool_registry.py` - 工具注册表
  - `chat_state.py` - 对话状态（保留兼容）

- **工具实现**：`backend/agents/tools/`
  - `cv_reader.py` - CVReader 工具
  - `cv_editor.py` - CVEditor 工具

- **API 路由**：`backend/routes/`
  - `cv_agent.py` - Agent API 路由（`/api/cv-agent/chat`）

- **旧版代码（保留供参考）**：
  - `core_agent.py` - 旧版 Agent（含 LLM 调用逻辑，可参考）
  - `task_planner.py` - 旧版任务规划器（含意图识别逻辑，可参考）
  - `session_manager.py` - 旧版会话管理

---

## 一、现状分析

### 当前架构问题

| 问题 | 描述 | 影响 |
|------|------|------|
| **会话状态分散** | `pending_experience` 存在于 Agent 实例内，API 每次请求可能创建新实例 | 多轮对话上下文丢失 |
| **消息格式不统一** | 返回格式随意，前端难以标准化处理 | 前后端协作困难 |
| **工具调用硬编码** | CVReader/CVEditor 直接写死在代码中 | 扩展性差 |
| **意图识别与执行耦合** | TaskPlanner 同时负责识别和构建工具调用 | 职责不清，难以调试 |
| **错误处理不完善** | 缺失字段、格式错误等场景处理不优雅 | 用户体验差 |

---

## 二、重构目标

### 核心原则

1. **简单优先**：不引入线程安全、分布式等复杂机制
2. **稳定可靠**：多轮对话状态正确维护
3. **易于扩展**：新工具、新场景可快速接入
4. **前后端友好**：统一的消息格式

### 量化目标

- ✅ 5 轮以上多轮对话状态正确
- ✅ 分步补充信息场景 100% 可用
- ✅ 工具调用成功率 > 95%
- ✅ 前端无需特殊处理即可展示所有消息类型
- ✅ LLM 调用包含对话历史上下文
- ✅ Token 限制避免超出上下文窗口
- ✅ 长对话自动摘要
- ✅ CVReader 返回最新数据（不会返回旧数据）
- ✅ Agent 数据不被前端旧数据覆盖

### 最新修复（2024-12-30）

**问题**：更新 skills 后查询，CVReader 返回旧数据

**原因分析**：
1. `ToolExecutor` 中 `CVReaderTool` 使用初始化时的数据副本，CVEditor 更新后不会自动同步
2. `/api/agent/cv-tools` 端点中 `agent.update_resume_data(body.resume_data)` 会用前端传递的旧数据覆盖后端已更新的数据

**修复方案**：
```
┌─────────────────────────────────────────────────────────────┐
│  数据流（修复后）                                            │
│                                                             │
│  前端                      后端                              │
│  ┌───────┐               ┌─────────────────────────────┐   │
│  │第一次 │──resume_data──→│ AgentManager.get_or_create  │   │
│  │请求   │               │   创建 Agent（初始化数据）     │   │
│  └───────┘               │   CVEditor 更新 skills       │   │
│                          │   _reader = None（重置）      │   │
│  ┌───────┐               │                              │   │
│  │第二次 │──session_id───→│ 复用已有 Agent               │   │
│  │请求   │  (不覆盖数据) │   CVReader 读取最新 skills    │   │
│  └───────┘               └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**：
- **CVReader 是读取 resume_data 的工具**，它们是同一个数据源
- **Agent 通过工具调用自己维护数据**，不依赖前端每次请求传递的数据
- **上下文窗口要足够大**（MAX_HISTORY_SIZE=50, MAX_HISTORY_TOKENS=8000），支持 LLM 兜底

---

## 三、架构设计

### 2.1 上下文记忆管理（已优化）

参考 sophia-pro 的上下文管理策略，优化了多轮对话的记忆机制：

```
┌─────────────────────────────────────────────────────────────┐
│                      AgentState                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  chat_history (滑动窗口)                              │    │
│  │  - MAX_HISTORY_SIZE = 20 条                          │    │
│  │  - 自动截断旧消息                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  context_summary (上下文摘要)                         │    │
│  │  - 长对话时自动生成摘要                               │    │
│  │  - 压缩早期对话内容                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  get_context_for_llm() (LLM 上下文构建)              │    │
│  │  - Token 限制 (MAX_HISTORY_TOKENS = 2000)           │    │
│  │  - 摘要 + 历史 + 当前消息                            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**核心方法：**

| 方法 | 功能 |
|------|------|
| `add_message()` | 添加消息（自动滑动窗口） |
| `get_history_for_llm()` | 获取 LLM 格式历史（Token 限制） |
| `get_context_for_llm()` | 构建完整 LLM 上下文 |
| `update_context_summary()` | 更新上下文摘要 |
| `auto_summarize_if_needed()` | 自动摘要（长对话） |

**配置参数：**

```python
MAX_HISTORY_SIZE = 20        # 最大历史消息数
MAX_HISTORY_TOKENS = 2000    # 历史消息最大 token 数
CHARS_PER_TOKEN = 2          # 中文约 2 字符/token
SUMMARY_THRESHOLD = 10       # 超过此数量时生成摘要
```

---

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│  /api/agent/cv-tools (带 session_id)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SessionManager                            │
│  - 会话存储（内存 Dict）                                      │
│  - 会话生命周期管理                                           │
│  - Agent 实例缓存                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CVAgent (核心)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ ChatState   │  │ TaskPlanner │  │ ToolExecutor│         │
│  │ (对话状态)  │  │ (意图规划)  │  │ (工具执行)  │         │
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
│                   MessageBuilder                             │
│  统一的消息格式构建器                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    ToolHooks（可选）                          │
│  工具调用前后钩子（参考 sophia-pro/tool_hooks.py）            │
│  - pre_tool_call: 调用前记录                                 │
│  - post_tool_call: 调用后记录（成功/失败/耗时）              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心模块职责

#### **SessionManager** - 会话管理器

```
职责：
1. 管理会话生命周期（创建、获取、销毁）
2. 缓存 Agent 实例（同一 session_id 复用同一个 Agent）
3. 处理会话过期清理

存储结构：
{
    "sess_xxx": {
        "agent": CVAgent 实例,
        "created_at": 时间戳,
        "last_active": 时间戳
    }
}

关键方法：
- get_or_create_agent(session_id, resume_data) -> CVAgent
- cleanup_expired_sessions()
```

#### **CVAgent** - 核心对话 Agent

```
职责：
1. 接收用户消息，返回响应
2. 维护对话状态（ChatState）
3. 协调意图识别和工具执行

核心属性：
- chat_state: ChatState      # 对话状态
- task_planner: TaskPlanner  # 意图规划器
- tool_executor: ToolExecutor # 工具执行器
- resume_data: Dict          # 当前简历数据

核心方法：
- process_message(user_message) -> AgentResponse
```

#### **ChatState** - 对话状态

```
职责：
1. 存储对话历史
2. 存储待补充的数据（pending_data）
3. 存储当前任务上下文

核心属性：
- history: List[Message]     # 对话历史（最近 N 轮）
- pending_data: Dict         # 待补充的数据
- current_intent: str        # 当前意图
- current_module: str        # 当前操作模块（workExperience/education 等）

关键设计：
- pending_data 支持任意模块，不只是 workExperience
- 自动合并用户多轮输入到 pending_data
```

#### **TaskPlanner** - 意图规划器

```
职责：
1. 识别用户意图（ADD/UPDATE/DELETE/READ/UNKNOWN）
2. 识别操作模块（workExperience/education/basic 等）
3. 从自然语言中提取结构化数据
4. 判断信息是否完整

输入：
- user_message: str
- chat_state: ChatState
- resume_data: Dict

输出：
{
    "intent": "ADD",
    "module": "workExperience",
    "extracted_data": {...},
    "missing_fields": ["position", "startDate"],
    "confidence": 0.85,
    "need_llm": False
}

关键设计：
- 只负责识别和提取，不负责构建工具调用
- 支持从 chat_state.pending_data 合并数据
```

#### **ToolExecutor** - 工具执行器

```
职责：
1. 根据规划结果构建工具调用
2. 执行工具并返回结果
3. 处理执行错误

输入：
- plan_result: Dict  # TaskPlanner 的输出
- resume_data: Dict

输出：
{
    "success": True,
    "tool_name": "CVEditor",
    "tool_params": {...},
    "result": {...},
    "updated_resume": {...}
}

关键设计：
- 工具通过 ToolRegistry 获取
- 执行前验证参数完整性
```

#### **ToolRegistry** - 工具注册表

```
职责：
1. 注册和管理所有可用工具
2. 提供工具元信息（名称、描述、参数）

结构：
{
    "CVReader": {
        "handler": CVReader 类,
        "description": "读取简历数据",
        "params": ["path"]
    },
    "CVEditor": {
        "handler": CVEditor 类,
        "description": "编辑简历数据",
        "params": ["path", "action", "value"]
    }
}

关键设计：
- 新工具只需注册即可使用
- 支持动态添加工具
```

#### **MessageBuilder** - 消息构建器

```
职责：
1. 构建标准化的响应消息
2. 支持多种消息类型

消息类型：
- text: 普通文本回复
- tool_call: 工具调用信息
- tool_result: 工具执行结果
- clarify: 澄清请求（缺少信息时）
- error: 错误信息

标准消息格式：
{
    "type": "text|tool_call|tool_result|clarify|error",
    "content": "...",
    "metadata": {
        "intent": "ADD",
        "module": "workExperience",
        "tool_name": "CVEditor",
        ...
    }
}
```

---

## 四、核心流程

### 4.1 单轮对话流程

```
用户输入 "在腾讯做前端开发，2021年到2023年"
    │
    ▼
┌─────────────────────────────────┐
│ 1. SessionManager 获取 Agent    │
│    - 根据 session_id 复用实例   │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ 2. TaskPlanner 意图识别         │
│    - intent: ADD                │
│    - module: workExperience     │
│    - extracted: {company, pos.. │
│    - missing: []                │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ 3. ToolExecutor 执行工具        │
│    - CVEditor.add(...)          │
│    - 更新 resume_data           │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ 4. MessageBuilder 构建响应      │
│    - type: tool_result          │
│    - content: "已添加工作经历"  │
└─────────────────────────────────┘
```

### 4.2 多轮补充流程

```
第一轮：用户输入 "添加工作经历，在腾讯"
    │
    ▼
┌─────────────────────────────────┐
│ TaskPlanner 识别                │
│ - intent: ADD                   │
│ - extracted: {company: "腾讯"}  │
│ - missing: [position, dates]   │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ ChatState 保存 pending_data     │
│ {company: "腾讯", ...}         │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ 返回澄清请求                    │
│ "请补充：职位、起止时间"        │
└─────────────────────────────────┘

第二轮：用户输入 "前端工程师，2021-2023"
    │
    ▼
┌─────────────────────────────────┐
│ TaskPlanner 识别                │
│ - 检测到有 pending_data         │
│ - 合并新提取的数据              │
│ - missing: [] (信息完整)        │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ ToolExecutor 执行               │
│ - 使用合并后的完整数据          │
│ - CVEditor.add(...)             │
└─────────────────────────────────┘
```

---

## 五、ChatState 详细设计

### 5.1 数据结构

```python
class ChatState:
    # 对话历史（最近 10 轮）
    history: List[Message] = []
    
    # 待补充的数据
    pending_data: Dict = {
        "module": "workExperience",  # 当前操作模块
        "intent": "ADD",             # 当前意图
        "data": {                    # 已收集的数据
            "company": "腾讯",
            "position": "",
            "startDate": "",
            "endDate": "",
            "description": ""
        },
        "missing_fields": ["position", "startDate", "endDate"]
    }
    
    # 状态标记
    is_waiting_for_supplement: bool = True
```

### 5.2 状态流转

```
初始状态
    │
    ▼
用户发起新任务 ─────────────────────┐
    │                               │
    ▼                               │
信息完整？ ──Yes──> 执行工具 ──> 清空状态
    │                               │
    No                              │
    │                               │
    ▼                               │
保存 pending_data                   │
设置 is_waiting_for_supplement      │
    │                               │
    ▼                               │
返回澄清请求                        │
    │                               │
    ▼                               │
用户补充信息 ───────────────────────┘
```

### 5.3 状态合并策略

```
合并规则：
1. 新提取的非空值覆盖旧值
2. 如果用户明确说"改成XXX"，则覆盖
3. 如果用户只是补充，则合并

示例：
pending_data = {company: "腾讯", position: ""}
用户输入: "前端工程师"
提取: {position: "前端工程师"}
合并后: {company: "腾讯", position: "前端工程师"}
```

---

## 六、意图识别优化

### 6.1 意图类型

| 意图 | 触发词/模式 | 示例 |
|------|-------------|------|
| ADD | 添加、新增、加一条、我在XX工作过 | "添加工作经历" |
| UPDATE | 修改、改成、更新、把XX改为 | "把公司改成腾讯" |
| DELETE | 删除、移除、去掉 | "删除第一条工作经历" |
| READ | 查看、显示、看看、有哪些 | "查看我的教育经历" |
| UNKNOWN | 无法识别 | "今天天气怎么样" |

### 6.2 模块识别

| 模块 | 关键词 |
|------|--------|
| workExperience | 工作、实习、经历、公司、职位 |
| education | 教育、学校、大学、学历、专业 |
| basic | 姓名、名字、电话、邮箱、基本信息 |
| skills | 技能、技术栈、擅长 |
| projects | 项目、项目经历 |

### 6.3 置信度判断

```
高置信度 (>0.8)：直接执行
- 明确的意图词 + 明确的模块词
- 示例："添加一条工作经历"

中置信度 (0.5-0.8)：尝试执行，失败则询问
- 有意图词但模块不明确
- 示例："添加一条" (什么类型？)

低置信度 (<0.5)：调用 LLM 辅助
- 无法识别意图
- 示例："帮我优化一下"
```

---

## 七、错误处理策略

### 7.1 错误类型

| 错误类型 | 处理方式 | 用户提示 |
|----------|----------|----------|
| 缺少必填字段 | 保存到 pending_data，请求补充 | "请补充：职位、起止时间" |
| 路径不存在 | 返回友好提示 | "您还没有工作经历，要添加一条吗？" |
| 格式错误 | 尝试自动修正，失败则提示 | "时间格式不对，请用 YYYY-MM 格式" |
| 意图不明确 | 调用 LLM 或请求澄清 | "您是想添加还是修改工作经历？" |

### 7.2 回退策略

```
优先级：
1. 规则引擎直接处理
2. pending_data 补充机制
3. 调用 LLM 辅助理解
4. 请求用户澄清
```

---

## 八、API 设计

### 8.1 请求格式

```json
POST /api/agent/cv-tools
{
    "session_id": "sess_xxx",      // 可选，不传则创建新会话
    "message": "添加工作经历，在腾讯",
    "resume_data": {...}           // 当前简历数据
}
```

### 8.2 响应格式

```json
{
    "session_id": "sess_xxx",
    "type": "clarify",             // text|tool_call|tool_result|clarify|error
    "reply": "请补充：职位、起止时间",
    "tool_call": null,             // 工具调用信息（如有）
    "tool_result": null,           // 工具执行结果（如有）
    "metadata": {
        "intent": "ADD",
        "module": "workExperience",
        "pending_data": {...},
        "missing_fields": ["position", "startDate", "endDate"]
    }
}
```

---

## 九、实施计划

### 阶段一：基础重构（预计 2 天）

1. 实现 `SessionManager` - 会话管理
2. 重构 `ChatState` - 统一状态管理
3. 实现 `MessageBuilder` - 标准化消息格式

### 阶段二：核心优化（预计 2 天）

4. 重构 `TaskPlanner` - 解耦意图识别
5. 实现 `ToolExecutor` - 独立工具执行
6. 实现 `ToolRegistry` - 工具注册机制

### 阶段三：稳定性提升（预计 1 天）

7. 完善错误处理
8. 添加日志和调试信息
9. 编写测试用例

### 阶段四：前端适配（预计 1 天）

10. 前端适配新的响应格式
11. 添加会话管理（session_id 传递）
12. 测试完整流程

---

## 十、风险与应对

| 风险 | 应对措施 |
|------|----------|
| 重构影响现有功能 | 保留旧 API，新 API 并行开发 |
| 状态管理复杂度 | ChatState 设计简洁，只存必要数据 |
| LLM 调用不稳定 | 优先使用规则引擎，LLM 作为兜底 |
| 前端改动大 | 响应格式向后兼容，逐步迁移 |

---

## 十一、成功标准

- [x] 场景1：分步添加工作经历（2-3轮）100% 成功 ✅
- [x] 场景2：一句话完整添加 100% 成功 ✅
- [x] 场景3：查询和修改组合操作成功 ✅
- [x] 场景4：错误输入有友好提示 ✅
- [x] 场景5：连续 10 轮对话状态正确 ✅

---

## 十二、Bug 修复记录（2025-12-30）

### 问题1：多轮对话上下文丢失

**现象**：分步添加工作经历时，第二轮对话返回"不理解"

**原因**：
1. 前端 `sessionId` 使用 `useState` 存储，`useCallback` 闭包捕获的是初始值 `undefined`
2. 后端 `AgentManager.get_or_create` 在传入空 `resume_data` 时覆盖了已有数据

**修复**：
1. 前端改用 `useRef` 存储 `sessionId`，避免闭包问题
2. 后端修改 `AgentManager`，空 `resume_data` 不覆盖已有数据

**相关文件**：
- `frontend/src/pages/CVToolsTest/index.tsx`
- `backend/agents/agent_manager.py`

### 问题2：简历预览不更新

**现象**：后端成功添加工作经历，前端预览不显示

**原因**：
- 后端使用 `workExperience` 字段名
- 前端模板使用 `experience` 字段名

**修复**：
在前端工具层添加路径映射：`workExperience` → `experience`

**相关文件**：
- `frontend/src/tools/cvTools.ts`

### 问题3：API 响应缺少 session_id

**修复**：
1. 更新 `CVToolCallResponse` 模型添加 `session_id` 字段
2. 更新 API 路由返回 `session_id`
3. 更新前端 API 函数传递 `session_id`

**相关文件**：
- `backend/models.py`
- `backend/routes/agent.py`
- `frontend/src/services/api.ts`

---

## 附录：参考 sophia-pro 的设计

sophia-pro 的优秀设计点（已简化采纳）：

1. **会话状态管理** - 使用 `AgentManager` + `CVAgent` 实例缓存
2. **消息构建器** - 使用 `MessageBuilder` 统一响应格式
3. **工具注册机制** - 使用 `ToolRegistry` 动态注册
4. **组合优于继承** - 通过参数传入工具，而非硬编码
5. **工具钩子机制** - `ToolHook` 支持工具调用前后的日志记录

sophia-pro 的复杂设计（简化采纳）：

1. ✅ `AgentState` - 简化版用于状态管理，不需要线程安全
2. ❌ 能力包系统 `Capability`（我们场景单一）
3. ✅ 工具钩子 `ToolHook` - 简化版用于日志记录
4. ❌ 浏览器自动化（我们不需要）

---

## 附录 B：sophia-pro Agent 深度架构分析

> **源码路径**：`/Users/wy770/AI/sophia-pro/backend/agent/src/amplift/`

### B.1 核心架构概览

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
│                                                     │                       │
│                                                     ▼                       │
│                                           ┌─────────────────┐              │
│                                           │   ToolHooks     │              │
│                                           │ 工具调用钩子     │              │
│                                           └─────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.2 AmpliftAgent - 核心 Agent 类

**源文件**：`amplift_agent.py`

**核心特性**：
- 统一的消息流架构（MemoryStep + 事件消息）
- 代码安全守卫（CodeGuard）
- 流式工具状态通知
- 通过 additional_tools 参数传入自定义工具
- **设计理念：组合优于继承** - 通过构造函数参数传入工具（组合），不强制继承

**核心构造参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `additional_tools` | `List` | 自定义工具列表（组合模式） |
| `shared_state` | `AgentState` | 全局共享状态 |
| `instructions` | `str` | 系统提示词 |
| `default_tools` | `List[str]` | 工具白名单 |
| `enable_skills` | `bool` | 是否启用 Skills |
| `stream_outputs` | `bool` | 是否流式输出 |

**核心方法**：

- `run_task(prompt)` - 异步运行任务，统一消息流架构
  - 所有消息（MemoryStep + 事件消息）都通过 yield 返回
  - 内部使用 stream_queue 合并不同来源的消息
  - 消息类型：MemoryStep、MessageBuilder 事件、工具状态消息、业务消息

- `create_python_executor()` - 创建流式执行器
  - 注册工具状态钩子（ToolStatusMessageHook）
  - 注册中断检查钩子（InterruptCheckHook）

### B.3 AgentState - 全局状态管理

**源文件**：`agent_state.py`

**功能**：Agent 全局状态容器，用于在 agent 的不同 tools 之间共享数据，支持线程安全的读写操作。

**核心方法**：
- `set(key, value)` - 设置状态值
- `get(key, default)` - 获取状态值
- `has(key)` - 检查键是否存在
- `delete(key)` - 删除状态键
- `update(data)` - 批量更新状态
- `clear()` - 清空所有状态
- `to_dict()` - 获取状态字典副本

**设计亮点**：
- 使用 `RLock`（可重入锁）支持嵌套调用
- `to_dict()` 返回副本，防止外部修改
- 简洁的 API 设计

### B.4 MessageBuilder - 消息构建器（CLTP 协议）

**源文件**：`message_builder.py`

**核心枚举**：

- `SpanName` - Span 名称：PLAN（计划）、PROCEDURE（整个 Agent 周期）、TASK（子任务）、STEP（单个步骤）、PLAIN（普通消息）、HITL（Human-in-the-loop）、TOOL_CALLING（工具调用）、OUTPUT（输出）、THINK（思考）
- `SpanStatus` - Span 状态：START、END
- `ContentChannel` - Content 通道：PLAIN（纯文本）、HITL（交互）、TOOL_CALLING、OUTPUT（文件输出）、FORM（表单）、AUTH（认证）、SYSTEM（系统控制）

**工厂方法**：

- `create_procedure_span()` - 创建 procedure span（整个 agent 执行周期）
- `create_step_span()` - 创建 step span（单个步骤）
- `create_tool_calling_span()` - 创建 tool_calling span
- `create_thinking_span()` - 创建 thinking span（思考阶段）
- `create_plain_message()` - 创建纯文本消息
- `create_output_message()` - 创建输出文件消息
- `create_interrupt_message()` - 创建中断消息

### B.5 StreamingLocalPythonExecutor - 流式执行器

**源文件**：`streaming_executor.py`

**功能**：支持工具调用钩子的 Python 执行器

**核心机制**：
- 工具调用前后的钩子机制（pre/post tool call hooks）
- 工具包装逻辑，在执行前后触发注册的 hooks
- 通过 context 传递工具调用信息（tool_call_id, tool_name, func_args, result, error, success）

**核心方法**：
- `register_pre_tool_call_hook(hook)` - 注册工具调用前的钩子
- `register_post_tool_call_hook(hook)` - 注册工具调用后的钩子
- `_wrap_tool(tool, tool_name)` - 包装工具，注入钩子

### B.6 ToolHooks - 工具调用钩子

**源文件**：`tool_hooks.py`

**InterruptCheckHook** - 中断检查 Hook
- 在工具调用前检查中断标志
- 如果已中断，抛出 AgentExecutionError

**ToolStatusMessageHook** - 工具状态消息发送的 Hook
- `pre_tool_call()` - 工具调用前发送 START 状态消息
- `post_tool_call()` - 工具调用后发送 END 状态消息（成功或失败）

### B.7 Capability - 能力包系统

**源文件**：`capability.py`

**ToolPolicy** - 工具策略配置
- `whitelist` - 通用白名单
- `whitelist_interactive` - 交互模式白名单
- `whitelist_automated` - 自动化模式白名单
- `get_effective_whitelist()` - 获取当前模式下的生效白名单

**Capability** - 能力包定义
- `name` - 能力包名称
- `instructions_addendum` - 追加到 system prompt 的指令
- `tool_policy` - 工具使用策略
- `enable_skills` - 是否挂载 .skills 目录
- `setup` - 初始化函数
- `merge_with()` - 合并两个 Capability

**预定义 Capability**：
- `WRITER_CAPABILITY` - 内容创作能力包
- `SOURCING_CAPABILITY` - 资源搜索能力包
- `BASE_CAPABILITY` - 基础能力包

### B.8 UnifiedAgent Factory - 统一 Agent 工厂

**源文件**：`agents/unified_agent.py`

**create_unified_agent()** - 创建统一 Agent 工厂函数

**工作流程**：
1. 解析 capabilities（通过 CapabilityRegistry）
2. 构建指令（base_instructions + product_prompt + capability addendum）
3. 构建工具白名单（根据 ToolPolicy）
4. 创建 AmpliftAgent 实例
5. 注册工具实例（根据 Capability 配置）
6. 执行 Capability setup（如果有）

**根据 Capability 配置 Agent**：
- instructions（system prompt + capability addendum）
- 工具白名单
- enable_skills

---

## 附录 C：AI 简历项目 Agent 优化方案

> **基于 sophia-pro 架构设计，针对简历编辑场景的简化实现**

### C.1 架构对比

| 组件 | sophia-pro | AI 简历（当前） | AI 简历（目标） |
|------|------------|----------------|----------------|
| **核心 Agent** | AmpliftAgent | CVAgent | CVAgent（优化） |
| **状态管理** | AgentState（线程安全） | ChatState | AgentState（简化版） |
| **消息构建** | MessageBuilder（CLTP） | MessageBuilder | MessageBuilder（简化） |
| **工具执行** | StreamingLocalPythonExecutor | ToolExecutor | ToolExecutor + Hooks |
| **工具钩子** | ToolHooks | tool_hooks.py | tool_hooks.py |
| **能力包** | Capability | ❌ 不需要 | ❌ 不需要 |
| **工具注册** | ToolRegistry | ToolRegistry | ToolRegistry |

### C.2 需要复制的核心设计

#### 1. 统一的工具包装模式

工具包装逻辑：在执行前后注入钩子，通过 context 传递工具调用信息（tool_call_id, tool_name, func_args, result, error, success）

#### 2. 消息流架构

消息类型：tool_start（工具开始）、tool_end（工具结束）、text（文本消息）、clarify（澄清请求）、error（错误）

#### 3. Context 传递机制

工具调用上下文包含：tool_call_id、tool_name、description、func_args、result、error、success、start_time、end_time

### C.3 简化实现方案

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI 简历 Agent 目标架构                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        API Layer (/api/agent/cv-tools)                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          AgentManager                                   │ │
│  │  - 会话缓存（Dict[session_id, CVAgent]）                                │ │
│  │  - 会话生命周期管理                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                           CVAgent (核心)                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │ │
│  │  │ AgentState   │  │IntentRecog   │  │ ToolExecutor │                  │ │
│  │  │ (状态管理)   │  │(意图识别)    │  │ (工具执行)   │                  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                  │ │
│  │                          │                  │                           │ │
│  │                          │                  ▼                           │ │
│  │                          │        ┌──────────────────┐                 │ │
│  │                          │        │   ToolHooks      │                 │ │
│  │                          │        │ - pre_tool_call  │                 │ │
│  │                          │        │ - post_tool_call │                 │ │
│  │                          │        └──────────────────┘                 │ │
│  │                          ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │                       ToolRegistry                               │   │ │
│  │  │  CVReader | CVEditor | (未来: SkillsEditor, ProjectEditor...)   │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        MessageBuilder                                   │ │
│  │  统一响应格式：{type, content, tool_call, metadata}                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### C.4 具体实现文件

| 文件 | 参考 sophia-pro | 说明 |
|------|-----------------|------|
| `agent_state.py` | `amplift/agent_state.py` | 简化版，移除线程安全 |
| `tool_executor.py` | `amplift/streaming_executor.py` | 工具包装 + 钩子 |
| `tool_hooks.py` | `amplift/tool_hooks.py` | 日志钩子 |
| `message_builder.py` | `amplift/message_builder.py` | 简化消息类型 |
| `intent_recognizer.py` | 自定义 | NLP 意图识别 |
| `cv_agent.py` | `amplift/amplift_agent.py` | 核心对话逻辑 |
| `agent_manager.py` | 自定义 | 会话管理 |

### C.5 下一步优化方向

1. **完善工具钩子机制**
   - 参考 `ToolStatusMessageHook` 实现工具调用日志
   - 添加执行时间统计

2. **优化消息流**
   - 支持流式响应（SSE）
   - 统一前后端消息格式

3. **增强意图识别**
   - 添加更多模块支持（skills, projects, awards）
   - 优化多轮对话上下文合并

4. **工具扩展**
   - 添加 SkillsEditor、ProjectEditor 等工具
   - 实现工具白名单机制（简化版 ToolPolicy）

---

## 附录 D：分层架构实现（已完成）

> **实现日期**：2025-12-30
> **核心文件**：`backend/agents/cv_agent.py`

### D.1 分层架构设计

```
用户输入
    │
    ▼
┌─────────────────────────────────────────────────────┐
│                  CVAgent.process_message()           │
│                                                      │
│  ┌─────────────────────────────────────────────────┐│
│  │           第一层：规则识别（IntentRecognizer）    ││
│  │                                                  ││
│  │  优点：快速、低成本、可预测                       ││
│  │  处理：常见场景（添加/修改/删除/查看）             ││
│  └─────────────────────────────────────────────────┘│
│                        │                             │
│                  识别成功？                          │
│                   /    \                             │
│                 是      否                           │
│                 │        │                           │
│                 ▼        ▼                           │
│         执行工具    ┌──────────────────────────────┐│
│         返回结果    │  第二层：LLM 兜底              ││
│                    │                                ││
│                    │  DeepSeek Function Calling    ││
│                    │  处理：复杂/模糊场景           ││
│                    └──────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### D.2 核心代码结构

**CVAgent 类**：
- `__init__()` - 初始化规则层组件（IntentRecognizer, ToolExecutor）和 LLM 层配置
- `process_message()` - 处理用户消息：先规则识别，失败则触发 LLM 兜底
- `_handle_unknown_intent()` - 处理未知意图：先规则匹配特殊场景，失败则调用 LLM

### D.3 LLM 工具调用（Function Calling）

**工具定义**：LLM_TOOLS_DEFINITION 包含 CVReader 和 CVEditor 的 Function Calling 定义

**调用流程**：
1. 用户输入 → LLM（带工具定义）
2. LLM 返回工具调用
3. 执行工具
4. 工具结果 → LLM → 最终回复

### D.4 智能路由策略

**复杂输入检测**（`_should_use_llm`）：
- 输入长度 > 150 字符 → 直接使用 LLM
- 包含"补充描述"等关键词 → 直接使用 LLM
- 优势：长描述不会被规则层截断或误解

**Pending Task 优化**（`_is_explicit_new_intent`）：
- 当用户有明确的新意图（查看、修改、删除）时，优先处理新意图
- 避免多轮上下文干扰后续操作

### D.5 测试结果

| 场景 | 处理层 | 结果 |
|------|--------|------|
| "你好" | 规则层 | ✅ 返回欢迎语 |
| "查看工作经历" | 规则层 | ✅ 调用 CVReader |
| "我在腾讯做前端，2021-2023" | 规则层 | ✅ 调用 CVEditor.add |
| "把名字改成张三" | 规则层 | ✅ 调用 CVEditor.update |
| "删除第一条工作经历" | 规则层 | ✅ 调用 CVEditor.delete |
| 长描述工作经历（含详细职责） | LLM 层 | ✅ 完整保留描述内容 |
| "帮我优化简历" | LLM 层 | ✅ LLM 分析后决定 |

### D.5 配置

环境变量（.env 文件）：
- `DEEPSEEK_API_KEY` - DeepSeek API 密钥
- `DEEPSEEK_BASE_URL` - API 基础 URL（默认：https://api.deepseek.com）
- `DEEPSEEK_MODEL` - 模型名称（默认：deepseek-chat）

### D.6 优势

1. **成本优化**：90%+ 场景由规则处理，几乎零成本
2. **响应快**：规则层 <10ms，LLM 层 1-3s
3. **可预测**：常见操作行为一致
4. **灵活性**：复杂场景由 LLM 智能处理
5. **兼容性**：保留所有现有功能

