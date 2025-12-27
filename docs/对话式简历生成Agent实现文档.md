# 对话式简历生成 Agent 实现文档

## 概述

本文档记录了对话式简历生成功能的完整实现过程。该功能允许用户通过与 AI 对话的方式，逐步收集信息并自动生成专业简历。

## 功能架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层                                │
├─────────────────────────────────────────────────────────────────┤
│  LandingPage (首页)                                              │
│       │                                                          │
│       ├──► /create-new ──► CreateNew (选择创建方式)              │
│       │                              │                          │
│       │                              ├──► "创建新简历"            │
│       │                              │       │                  │
│       │                              │       └──► /conversation  │
│       │                              │                          │
│       │                              └──► "导入已有简历"         │
│       │                                      │                  │
│       │                                      └──► /workspace     │
│       │                                                          │
│       └──► /dashboard ──► ResumeDashboard (简历管理)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ConversationWorkspace                         │
│  ┌─────────────────────┬─────────────────────────────────────┐ │
│  │   对话面板 (左侧)    │      预览面板 (右侧)                 │ │
│  │  ┌───────────────┐  │  ┌─────────────────────────────────┐│ │
│  │  │ 消息历史       │  │  │ 实时简历预览                     ││ │
│  │  │ - 用户消息    │  │  │ - 基本信息                       ││ │
│  │  │ - AI 回复     │  │  │ - 教育经历                       ││ │
│  │  │ - 系统提示    │  │  │ - 工作经历                       ││ │
│  │  └───────────────┘  │  │ - 项目经历                       ││ │
│  │  ┌───────────────┐  │  │ - 技能证书                       ││ │
│  │  │ 输入框 + 发送  │  │  └─────────────────────────────────┘│ │
│  │  └───────────────┘  │                                      │ │
│  └─────────────────────┴─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        后端 API 层                               │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/agent/conversation                                    │
│       │                                                          │
│       ├── 请求参数:                                              │
│       │   - message: 用户输入消息                                │
│       │   - step: 当前对话步骤                                   │
│       │   - collected_info: 已收集的信息                         │
│       │   - resume_data: 当前简历数据                            │
│       │                                                          │
│       └── 返回结果:                                              │
│           - reply: AI 回复内容                                   │
│           - next_step: 下一步骤                                  │
│           - updated_info: 更新后的收集信息                       │
│           - is_complete: 是否完成                                │
│           - resume_data: 完整简历数据                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Conversation Agent                           │
│                 (backend/agents/conversation_agent.py)           │
├─────────────────────────────────────────────────────────────────┤
│  对话步骤管理                                                     │
│  ├─ greeting      → 欢迎消息                                     │
│  ├─ identity      → 身份确认（学生/职场）                        │
│  ├─ education     → 教育背景收集                                 │
│  ├─ experience    → 工作/实习经历收集                            │
│  ├─ projects      → 项目经历收集                                 │
│  ├─ activities    → 社团活动/荣誉收集                            │
│  ├─ skills        → 技能证书收集                                 │
│  └─ confirm       → 确认完成                                     │
└─────────────────────────────────────────────────────────────────┘
```

## 前端实现

### 1. 路由配置 (App.tsx)

```typescript
// 新增两个路由
<Route path="/create-new" element={<CreateNew />} />
<Route path="/conversation" element={<ConversationWorkspace />} />
```

### 2. CreateNew 页面

**文件位置**: `frontend/src/pages/CreateNew/index.tsx`

**功能**:
- 提供两个创建方式选项
- "创建新简历"（推荐）：引导用户进入 AI 对话流程
- "导入已有简历"：直接跳转到工作区编辑器

**设计特点**:
- 居中布局，两个大卡片选项
- 推荐选项带有 "推荐" 徽章和渐变色彩
- 平滑的悬停动画效果
- 特性列表展示（带图标）

```typescript
// 核心交互
const handleCreateNew = () => {
  navigate('/conversation')  // 进入对话创建流程
}

const handleImportExisting = () => {
  navigate('/workspace')     // 进入编辑器
}
```

### 3. ConversationWorkspace 页面

**文件位置**: `frontend/src/pages/ConversationWorkspace/index.tsx`

**布局结构**: 左右分栏设计

#### 左侧：对话面板

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
```

**功能组件**:
- 消息列表显示（用户/AI 消息气泡）
- 输入框 + 发送按钮
- 加载动画（三个跳动的圆点）
- 自动滚动到底部

#### 右侧：预览面板

**显示内容**:
- 基本信息（姓名、邮箱、电话）
- 教育经历列表
- 工作经历列表
- 项目经历列表
- 专业技能（HTML 格式渲染）

#### API 集成

```typescript
const handleSend = async () => {
  const response = await fetch('http://localhost:8000/api/agent/conversation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage.content,
      step: step,
      collected_info: collectedInfo,
      resume_data: resumeData
    })
  })

  const data = await response.json()
  // 更新 UI 状态
  setMessages(prev => [...prev, assistantMessage])
  setStep(data.next_step)
  setCollectedInfo(data.updated_info)
  if (data.resume_data) {
    setResumeData(data.resume_data)
  }
}
```

## 后端实现

### 1. API 路由 (backend/routes/agent.py)

```python
@router.post("/agent/conversation", response_model=ConversationResponse)
async def agent_conversation(body: ConversationRequest):
    """
    对话式简历生成 Agent

    工作流程：
    1. 接收用户输入
    2. 根据当前对话步骤处理输入
    3. 提取/更新简历信息
    4. 返回 AI 回复和下一步骤
    """
    result = await conversation_handler(
        message=body.message,
        step=body.step,
        collected_info=body.collected_info,
        resume_data=body.resume_data
    )
    return result
```

### 2. 数据模型 (backend/models.py)

```python
class ConversationRequest(BaseModel):
    message: str                          # 用户输入
    step: str                             # 当前对话步骤
    collected_info: Dict[str, Any]        # 已收集的信息
    resume_data: Dict[str, Any]           # 当前简历数据

class ConversationResponse(BaseModel):
    reply: str                            # AI 回复
    next_step: str                        # 下一步骤
    updated_info: Dict[str, Any]          # 更新后的信息
    is_complete: bool                     # 是否完成
    resume_data: Optional[Dict[str, Any]] # 完整简历数据
```

### 3. Conversation Agent (backend/agents/conversation_agent.py)

#### 对话流程状态机

```python
CONVERSATION_STEPS = [
    'greeting',      # 欢迎
    'identity',      # 身份确认
    'education',     # 教育背景
    'experience',    # 实习经历
    'projects',      # 项目经历
    'activities',    # 社团活动
    'skills',        # 技能证书
    'confirm'        # 确认完成
]

STEP_ORDER = {
    'greeting': 'identity',
    'identity': 'education',
    'education': 'experience',
    'experience': 'projects',
    'projects': 'activities',
    'activities': 'skills',
    'skills': 'confirm',
    'confirm': 'confirm'
}
```

#### Prompt 构建示例

```python
def build_conversation_prompt(step, user_input, collected_info):
    if step == 'identity':
        return f'''用户说："{user_input}"

请提取用户的名字。

JSON 响应示例：
{{
    "reply": "你好，{{name}}！现在让我们开始构建你的简历。\\n\\n请分享你的教育背景...",
    "extracted_info": {{"name": "{{提取的名字}}"}},
    "next_step": "education",
    "is_complete": false
}}'''

    elif step == 'education':
        # 构建教育背景收集 prompt...
```

#### 简历数据构建

```python
def build_resume_from_conversation(collected_info, current_resume):
    """从对话收集的信息构建完整简历数据"""
    return {
        'basic': basic,
        'education': education,
        'experience': experience,
        'projects': projects,
        'openSource': openSource,
        'awards': awards,
        'skillContent': skill_content,
        'menuSections': menuSections,
        'globalSettings': globalSettings
    }
```

## 对话流程详解

```
┌─────────────────────────────────────────────────────────────────┐
│                        对话流程图                                │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │  开始    │
    └────┬─────┘
         │
         ▼
    ┌──────────────────┐
    │   欢迎消息        │  "你好！我是你的简历助手..."
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │   身份确认        │  "请告诉我你的名字"
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │   教育背景        │  学校、专业、学历、时间
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │   实习经历        │  公司、职位、时间、详情（可跳过）
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │   项目经历        │  项目名、角色、时间、描述（可跳过）
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │   社团活动        │  奖项、荣誉、活动（可跳过）
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │   技能证书        │  编程语言、工具、证书
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │   完成确认        │  "简历生成完成！你可以..."
    └──────────────────┘
```

## UI 设计规范

### 颜色方案

```css
/* 主色调 */
--primary-indigo: #6366f1;   /* 靛蓝 */
--primary-blue: #3b82f6;     /* 蓝色 */

/* 中性色 */
--bg-color: #F8F9FA;         /* 背景色 */
--text-primary: #1E293B;     /* 主文本 */
--text-secondary: #64748B;   /* 次文本 */

/* 功能色 */
--success: #10b981;          /* 成功 */
--warning: #f59e0b;          /* 警告 */
```

### 动画效果

```typescript
// 消息进入动画
initial = {{ opacity: 0, y: 10 }}
animate = {{ opacity: 1, y: 0 }}
transition = {{ duration: 0.2 }}

// 按钮交互动画
whileHover = {{ scale: 1.02 }}
whileTap = {{ scale: 0.98 }}
```

## 技术栈

### 前端
- React 18 + TypeScript
- React Router v6
- Framer Motion (动画)
- Tailwind CSS (样式)
- Lucide React (图标)

### 后端
- FastAPI
- Pydantic (数据验证)
- DeepSeek API (LLM)

## 后续优化方向

1. **数据持久化**: 将对话状态保存到 localStorage
2. **进度保存**: 支持中途退出后继续对话
3. **更多模板**: 对话完成后支持选择不同简历模板
4. **智能建议**: 根据收集的信息提供优化建议
5. **语音输入**: 集成语音识别，提升交互体验
