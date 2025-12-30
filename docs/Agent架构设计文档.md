# Agent 架构设计文档

## 概述

基于 [AI对话创建简历-参考分析.md](./AI对话创建简历-参考分析.md) 中的架构设计，使用 **LangChain** 框架实现的简历 AI 助手。

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    用户交互层 (Frontend)                         │
│  - 自然语言输入                                                   │
│  - 实时预览                                                       │
│  - 对话历史展示                                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API 路由层 (routes/agent.py)                   │
│  - POST /api/agent/cv-tools  (工具调用)                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              核心智能体 (agents/core_agent.py)                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                    CoreAgent                                  ││
│  │  - process_message()      同步处理                            ││
│  │  - process_message_stream()  流式处理                         ││
│  │  - _build_prompt()        构建提示词                          ││
│  │  - _parse_response()      解析 LLM 响应                       ││
│  │  - _execute_tool()        执行工具                            ││
│  └──────────────────────────────────────────────────────────────┘│
│                                │                                  │
│                     ┌─────────────────────┐                      │
│                     │   LLM (DeepSeek)    │                      │
│                     └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    工具层 (agents/tools/)                         │
│                                                                   │
│  ┌───────────────────────┐   ┌───────────────────────┐          │
│  │     CVReaderTool      │   │     CVEditorTool      │          │
│  │  (cv_reader.py)       │   │  (cv_editor.py)       │          │
│  │                       │   │                       │          │
│  │  - path: 读取路径     │   │  - path: 操作路径     │          │
│  │  - 返回字段值/完整简历│   │  - action: 操作类型   │          │
│  └───────────────────────┘   │  - value: 新值        │          │
│                               │  - update/add/delete │          │
│                               └───────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    数据层 (json_path.py)                          │
│                                                                   │
│  - parse_path()      解析 JSON 路径                              │
│  - get_by_path()     读取数据                                    │
│  - set_by_path()     设置数据                                    │
│  - delete_by_path()  删除数据                                    │
│  - 支持 a.b[0].c 格式的路径                                      │
└─────────────────────────────────────────────────────────────────┘
```

## 文件结构

```
backend/agents/
├── __init__.py           # 模块导出
├── core_agent.py         # 核心 Agent (LangChain)
├── session_manager.py    # 会话管理
├── tool_executor.py      # 工具执行器封装
└── tools/
    ├── __init__.py       # 工具导出
    ├── cv_reader.py      # CVReader 工具 (LangChain BaseTool)
    └── cv_editor.py      # CVEditor 工具 (LangChain BaseTool)
```

## 核心模块说明

### 1. CVReader 工具

**文件**: `backend/agents/tools/cv_reader.py`

**功能**: 读取简历数据的指定字段或完整内容

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| path | string | 否 | JSON 路径，不填返回完整简历 |

**示例路径**:
- `basic.name` - 姓名
- `education[0].school` - 第一段教育经历的学校
- `workExperience` - 所有工作经历

**返回格式**:
```json
{
  "success": true,
  "message": "成功读取字段: basic.name",
  "data": "张三",
  "path": "basic.name"
}
```

---

### 2. CVEditor 工具

**文件**: `backend/agents/tools/cv_editor.py`

**功能**: 修改、添加或删除简历数据

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| path | string | 是 | JSON 路径 |
| action | string | 是 | 操作类型: update/add/delete |
| value | any | update/add 时必填 | 新值 |

**操作示例**:

1. **修改姓名**:
```json
{
  "path": "basic.name",
  "action": "update",
  "value": "张三"
}
```

2. **添加教育经历**:
```json
{
  "path": "education",
  "action": "add",
  "value": {
    "school": "北京大学",
    "major": "计算机科学",
    "degree": "本科"
  }
}
```

3. **删除第一段工作经历**:
```json
{
  "path": "workExperience[0]",
  "action": "delete"
}
```

---

### 3. CoreAgent

**文件**: `backend/agents/core_agent.py`

**功能**: 整合 LLM 和工具，处理用户对话

**核心方法**:

| 方法 | 说明 |
|------|------|
| `process_message(msg)` | 同步处理消息 |
| `process_message_stream(msg)` | 流式处理消息 |
| `_build_prompt(msg)` | 构建 LLM 提示词 |
| `_parse_response(resp)` | 解析 LLM JSON 响应 |
| `_execute_tool(call)` | 执行工具调用 |

**使用示例**:

```python
from agents import create_agent

# 创建 Agent
agent = create_agent(resume_data={
    "basic": {"name": "张三"},
    "education": []
})

# 处理消息
response = agent.process_message("把名字改成李四")
print(response.reply)  # "好的，我已将姓名修改为「李四」"
print(response.tool_result)  # {"success": True, ...}

# 流式处理
async for event in agent.process_message_stream("查看教育经历"):
    if event["type"] == "tool_call":
        print("工具调用:", event["content"])
    elif event["type"] == "reply":
        print("回复:", event["content"])
```

---

### 4. JSON Path 工具

**文件**: `backend/json_path.py`

**功能**: 解析和操作 JSON 路径

**支持的路径格式**:
- `basic.name` - 对象属性
- `education[0]` - 数组索引
- `education[0].school` - 组合路径
- `workExperience[-1]` - 负索引（最后一个）

**函数**:

| 函数 | 说明 |
|------|------|
| `parse_path(path)` | 解析路径为片段列表 |
| `get_by_path(obj, path)` | 获取路径值 |
| `set_by_path(obj, path, value)` | 设置路径值 |
| `delete_by_path(obj, path)` | 删除路径 |
| `exists_path(obj, path)` | 检查路径是否存在 |

---

## API 接口

### CV 工具对话

**端点**: `POST /api/agent/cv-tools`

**请求**:
```json
{
  "message": "把名字改成张三",
  "resume_data": { ... }
}
```

**流式响应** (SSE):
```
event: tool_call
data: {"type": "tool_call", "content": {"name": "CVEditor", "params": {...}}}

event: tool_result
data: {"type": "tool_result", "content": {"success": true, ...}}

event: reply
data: {"type": "reply", "content": "好的，已将姓名修改为「张三」"}

event: done
data: {"type": "done", "content": null}
```

---

## 简历数据结构

```json
{
  "basic": {
    "name": "姓名",
    "title": "职位",
    "email": "邮箱",
    "phone": "电话",
    "location": "城市",
    "summary": "个人简介"
  },
  "education": [{
    "id": "唯一ID",
    "school": "学校",
    "major": "专业",
    "degree": "学位",
    "startDate": "开始时间",
    "endDate": "结束时间",
    "description": "描述"
  }],
  "workExperience": [{
    "id": "唯一ID",
    "company": "公司",
    "position": "职位",
    "startDate": "开始时间",
    "endDate": "结束时间",
    "description": "描述"
  }],
  "projects": [{
    "id": "唯一ID",
    "name": "项目名",
    "role": "角色",
    "startDate": "开始时间",
    "endDate": "结束时间",
    "description": "描述"
  }],
  "skillContent": "技能描述"
}
```

---

## 自然语言到工具调用映射

| 用户输入 | 工具调用 |
|---------|---------|
| "把名字改成张三" | CVEditor(path="basic.name", action="update", value="张三") |
| "查看教育经历" | CVReader(path="education") |
| "我叫李四" | CVEditor(path="basic.name", action="update", value="李四") |
| "添加一段工作经历" | CVEditor(path="workExperience", action="add", value={...}) |
| "删除第一段实习" | CVEditor(path="workExperience[0]", action="delete") |
| "显示我的简历" | CVReader() |

---

## 扩展点

### 1. 添加新工具

在 `agents/tools/` 目录创建新工具：

```python
from langchain_core.tools import BaseTool

class MyNewTool(BaseTool):
    name = "MyNewTool"
    description = "工具描述"
    
    def _run(self, **params):
        # 实现逻辑
        return {"success": True, "data": ...}
```

### 2. 支持更多 LLM

在 `llm.py` 中添加新的提供商：

```python
def call_llm(provider: str, prompt: str) -> str:
    if provider == "new_provider":
        return call_new_provider(prompt)
```

### 3. 会话持久化

当前会话存储在内存中，可扩展为数据库：

```python
# session_manager.py
class SessionManager:
    def save_session(self, session: Session):
        # 保存到 Redis/PostgreSQL
        pass
```

---

## 参考文档

- [AI对话创建简历-参考分析.md](./AI对话创建简历-参考分析.md) - 架构参考来源
- [LangChain Tools 文档](https://python.langchain.com/docs/how_to/#tools)
