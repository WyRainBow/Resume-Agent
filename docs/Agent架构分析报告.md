# Agent 架构分析报告

> **更新日期**：2025-12-30
> **分析范围**：`backend/agents/` 目录

---

## 一、模块概览

### 1.1 核心模块

| 文件 | 职责 | 状态 |
|------|------|------|
| `cv_agent.py` | 主对话 Agent，实现分层架构（规则层 + LLM 层） | ✅ 活跃 |
| `core_agent.py` | 核心 Agent 基类，提供流式对话 | ⚠️ 使用中 |
| `conversation_agent.py` | 对话 Agent，支持多轮对话 | ⚠️ 使用中 |
| `agent_manager.py` | Agent 管理器 | ✅ 活跃 |

### 1.2 状态管理模块

| 文件 | 职责 | 重复度 |
|------|------|--------|
| `agent_state.py` | Agent 状态容器 | 中 |
| `chat_state.py` | 对话状态管理 | 中 |

**重复内容**：
- `PendingTask` (agent_state) vs `PendingData` (chat_state)
- 待补充任务管理逻辑重复

### 1.3 意图识别模块

| 文件 | 职责 | 状态 |
|------|------|------|
| `intent_recognizer.py` | 新版意图识别器 | ✅ 推荐 |
| `task_planner.py` | 旧版意图识别 + 任务规划 | ⚠️ 遗留 |

**重复内容**：
- `IntentType` 枚举在两个文件中定义
- `IntentRecognizer` 类在两个文件中有不同实现
- `RecognitionResult` vs `IntentResult` 数据类

### 1.4 工具执行模块

| 文件 | 职责 | 状态 |
|------|------|------|
| `tool_executor.py` | 工具执行器 | ✅ 活跃 |
| `tool_hooks.py` | 工具调用钩子 | ✅ 活跃 |
| `tool_registry.py` | 工具注册表 | ✅ 活跃 |
| `tools/cv_reader.py` | 简历读取工具 | ✅ 活跃 |
| `tools/cv_editor.py` | 简历编辑工具 | ✅ 活跃 |
| `tools/cv_batch_editor.py` | 批量编辑工具 | ✅ 新增 |

### 1.5 消息处理模块

| 文件 | 职责 | 状态 |
|------|------|------|
| `message_builder.py` | 消息构建器 | ✅ 活跃 |

### 1.6 会话管理模块

| 文件 | 职责 | 状态 |
|------|------|------|
| `session_manager.py` | 会话生命周期管理 | ✅ 活跃 |

---

## 二、依赖关系图

```
cv_agent.py (主入口)
├── agent_state.py (状态管理)
├── chat_state.py (意图类型兼容)
├── message_builder.py (响应构建)
├── intent_recognizer.py (意图识别)
├── tool_executor.py (工具执行)
├── tool_hooks.py (工具钩子)
└── tools/* (具体工具)

core_agent.py
├── task_planner.py (遗留)
└── tools/*

agent_manager.py
└── cv_agent.py
```

---

## 三、重复代码分析

### 3.1 IntentType 重复

**位置**：
- `task_planner.py:15-22`
- `chat_state.py:15-21`

**问题**：两个文件定义了相同的枚举

**建议**：统一使用 `chat_state.py` 中的定义，删除 `task_planner.py` 中的定义

### 3.2 PendingTask / PendingData 重复

**位置**：
- `agent_state.py:20-27` (PendingTask)
- `chat_state.py:42-85` (PendingData)

**问题**：功能相似，接口略有不同

**对比**：
| 特性 | PendingTask | PendingData |
|------|-------------|-------------|
| 模块字段 | module | module |
| 意图字段 | intent (str) | intent (IntentType) |
| 数据字段 | collected_data | data |
| 缺失字段 | missing_fields | missing_fields |
| 合并方法 | 无 | merge() |
| 更新缺失字段 | 无 | update_missing_fields() |

**建议**：保留 `PendingData`，迁移 `is_empty()`, `has_missing_fields()` 方法到 `agent_state.py`

### 3.3 IntentRecognizer 重复

**位置**：
- `task_planner.py:104-291` (旧版)
- `intent_recognizer.py:52-730` (新版)

**差异**：
| 特性 | task_planner | intent_recognizer |
|------|--------------|-------------------|
| 意图优先级 | 无 | READ > DELETE > UPDATE > ADD |
| 补充识别 | 无 | 支持 (_recognize_supplement) |
| 明确新意图检测 | 无 | 支持 (_is_explicit_new_intent) |
| 数据提取 | 基础 | 更完整 |

**建议**：完全迁移到 `intent_recognizer.py`，标记 `task_planner.py` 为 deprecated

---

## 四、优化建议

### 4.1 短期优化（低风险）

1. **统一 IntentType**
   - 从 `chat_state.py` 导入，删除 `task_planner.py` 中的定义
   - 更新 `task_planner.py` 的导入语句

2. **标记遗留代码**
   - 在 `task_planner.py` 顶部添加 `@deprecated` 注释
   - 说明推荐使用 `intent_recognizer.py`

### 4.2 中期优化（中等风险）

1. **合并状态管理**
   - 将 `PendingData` 的优势方法迁移到 `agent_state.py`
   - 统一 `PendingTask` 接口
   - 考虑长期合并 `AgentState` 和 `ChatState`

2. **统一意图识别**
   - 确保所有模块使用 `intent_recognizer.py`
   - 更新 `cv_agent.py` 的导入

### 4.3 长期优化（高风险）

1. **创建抽象基类**
   ```python
   class BaseAgent(ABC):
       @abstractmethod
       async def process(self, message: str) -> AgentResponse:
           pass
   ```

2. **配置化关键词映射**
   - 将关键词映射移到 YAML/JSON 配置文件
   - 支持热更新

3. **统一工具注册**
   - 自动发现 `tools/` 目录下的工具
   - 自动生成 LLM 函数定义

---

## 五、消息流转图

```
用户输入
    ↓
cv_agent.process()
    ↓
┌─────────────────────────────────────┐
│ 规则层 (IntentRecognizer)            │
│ - 意图识别                            │
│ - 模块识别                            │
│ - 数据提取                            │
│ - 置信度计算                          │
└─────────────────────────────────────┘
    ↓ 高置信度?
    │
    ├─ 是 → ToolExecutor.execute()
    │         ↓
    │      MessageBuilder.success_*()
    │
    └─ 否 → LLM 层 (with tools)
              ↓
           LLM 选择工具
              ↓
           ToolExecutor.execute()
              ↓
           MessageBuilder.tool_result()
```

---

## 六、性能考虑

### 6.1 当前优化

1. **滑动窗口**：限制历史消息数量（MAX_HISTORY_SIZE = 50）
2. **Token 估算**：避免超出 LLM 上下文窗口
3. **懒加载**：工具实例按需创建

### 6.2 可优化点

1. **意图识别缓存**：相同输入直接返回缓存结果
2. **工具调用结果缓存**：相同参数的读操作可缓存
3. **并发工具调用**：批量操作可并发执行

---

## 七、测试建议

### 7.1 单元测试

- [ ] `IntentRecognizer.recognize()` - 各种意图识别
- [ ] `ToolExecutor` - 各工具执行
- [ ] `MessageBuilder` - 各类型消息构建
- [ ] `AgentState` - 状态管理

### 7.2 集成测试

- [ ] 多轮对话场景
- [ ] 信息补充场景
- [ ] 批量编辑场景

---

## 八、总结

### 当前架构优势

1. **分层设计**：规则层 + LLM 层，性能与智能兼顾
2. **模块化**：各职责清晰分离
3. **可扩展**：新工具易于添加

### 主要问题

1. **代码重复**：IntentType、PendingTask、IntentRecognizer
2. **状态管理分散**：AgentState 和 ChatState 功能重叠
3. **遗留代码**：task_planner.py 需要清理

### 优先级

| 优先级 | 任务 | 风险 | 预计收益 |
|-------|------|------|---------|
| P1 | 统一 IntentType | 低 | 消除重复 |
| P2 | 标记 task_planner deprecated | 低 | 代码清晰 |
| P3 | 统一状态管理接口 | 中 | 减少维护成本 |
| P4 | 完全移除 task_planner | 中 | 减少代码量 |
