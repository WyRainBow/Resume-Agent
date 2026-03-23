# 自然语言简历修改与生成 — 重构设计文档

**日期：** 2026-03-23
**状态：** 已审批，待实现
**分支：** feature/03-23

---

## 背景

Resume-Agent 曾将 agent 逻辑拆分为独立服务 `resume-agent-core`（port 9100），通过代理层与主后端通信。本次重构同步完成以下工作：

1. **已完成**：将 agent-core 合并回 `backend/agent/`，删除代理层，单服务运行。
2. **本文档范围**：在合并基础上，重构自然语言修改和生成简历的完整数据流。

---

## 目标

- 用户可以用自然语言修改简历（"把工作经历量化"）
- 用户可以用自然语言从零生成简历（"帮我生成一份后端工程师简历"）
- 用户可以针对 JD 优化现有简历（多条 diff 逐条审批）
- 修改以 **Diff 审批模式** 呈现：before/after 对比，用户确认后编辑器更新
- Chat 和简历编辑器并排显示，Apply 后编辑器实时反映变化

---

## Section 1：统一简历数据格式

### 权威格式：`ResumeData`

废弃旧 `Resume` 类型（`contact.email`、`internships[]` 等字段），全系统统一使用 `ResumeData`：

```typescript
interface ResumeData {
  id: string
  basic: {
    name: string
    title: string
    email: string
    phone: string
    location: string
  }
  education:   EducationItem[]
  experience:  ExperienceItem[]
  projects:    ProjectItem[]
  openSource:  OpenSourceItem[]
  awards:      AwardItem[]
  skillContent: string  // HTML string
}
```

### 迁移策略

- 旧 `Resume` 类型保留用于 API 响应兼容，加 `toResumeData(resume: Resume): ResumeData` 转换函数
- `agentStream.ts` 的 `resume_data` 参数类型改为 `ResumeData`
- `SophiaChat.tsx` 的 `loadedResumes` 统一为 `ResumeData[]`
- Backend `CVEditorAgentTool` JSON path 已对齐此格式，无需改动

---

## Section 2：SSE 事件协议

### 废弃

- `resume_edit_diff` 事件类型（数据嵌在 markdown `<resume_diff>` 标签中）
- `frontend/src/utils/resumeEditDiff.ts` 整个文件（regex 解析器）

### 新增三种结构化事件

```typescript
// 事件 1：字段级修改（自然语言编辑）
interface ResumePatchEvent {
  type: "resume_patch"
  data: {
    patch_id: string                  // 唯一 ID，用于 apply/reject
    paths:    string[]                // 修改路径，如 ["experience[0].details"]
    before:   Partial<ResumeData>     // 修改前（只含改动字段）
    after:    Partial<ResumeData>     // 修改后（只含改动字段）
    summary:  string                  // 人类可读描述
  }
}

// 事件 2：全量生成（从零生成或整体替换）
interface ResumeGeneratedEvent {
  type: "resume_generated"
  data: {
    resume:  ResumeData
    summary: string
  }
}

// 事件 3：加载简历到会话（已有，保持不变）
interface ResumeLoadedEvent {
  type: "resume_loaded"
  data: {
    resume_id: string
    resume:    ResumeData
  }
}
```

### Backend 实现

在 `backend/agent/web/streaming/events.py` 中添加对应 Pydantic 模型：

```python
class ResumePatchData(BaseModel):
    patch_id: str
    paths: list[str]
    before: dict
    after: dict
    summary: str

class ResumePatchEvent(BaseStreamEvent):
    type: Literal["resume_patch"] = "resume_patch"
    data: ResumePatchData

class ResumeGeneratedData(BaseModel):
    resume: dict
    summary: str

class ResumeGeneratedEvent(BaseStreamEvent):
    type: Literal["resume_generated"] = "resume_generated"
    data: ResumeGeneratedData
```

`CVEditorAgentTool` 修改：将当前 markdown 输出格式替换为发送 `ResumePatchEvent`。

---

## Section 3：前端状态 — ResumeContext

### 新文件：`frontend/src/contexts/ResumeContext.tsx`

```typescript
interface PendingPatch {
  patch_id: string
  paths:    string[]
  before:   Partial<ResumeData>
  after:    Partial<ResumeData>
  summary:  string
  status:   "pending" | "applied" | "rejected"
}

interface ResumeContextValue {
  resume:         ResumeData | null
  pendingPatches: PendingPatch[]

  setResume:  (r: ResumeData) => void
  applyPatch: (patch_id: string) => void   // merge after → resume，触发编辑器重渲染
  rejectPatch:(patch_id: string) => void
  pushPatch:  (patch: PendingPatch) => void // useCLTP 收到 SSE 时调用
}
```

### applyPatch 实现逻辑

```typescript
applyPatch(patch_id) {
  const patch = pendingPatches.find(p => p.patch_id === patch_id)
  const updated = deepMerge(resume, patch.after)   // structuredClone + merge
  setResume(updated)
  setPendingPatches(prev => prev.map(p =>
    p.patch_id === patch_id ? {...p, status: "applied"} : p
  ))
  // 后台静默保存
  api.patch(`/resumes/${resume.id}`, updated)
}
```

### setResume（生成场景）

```typescript
setResume(newResume) {
  setResumeState(newResume)
  // 如果是新生成的，POST 创建新记录
  if (!newResume.id) {
    api.post('/resumes', newResume).then(created => {
      setResumeState(r => ({...r, id: created.id}))
    })
  }
}
```

---

## Section 4：完整数据流

### 流程 A：自然语言修改

```
用户输入 "把工作经历第一条更量化"
    ↓
SophiaChat.sendMessage()
    → POST /api/agent/stream
      { message, conversation_id, resume_data: context.resume }
    ↓
Manus agent
    → intent 识别 → cv_editor_agent 工具
    → CVEditorAgentTool(path="experience[0].details", action="update")
    → LLM 生成新内容，对比 before/after
    → SSE: { type:"resume_patch", data:{patch_id, paths, before, after, summary} }
    ↓
agentStream.ts 解析 → useCLTP handler
    → context.pushPatch(patch)
    ↓
Chat 侧：ResumeDiffCard 展示 before/after
    [✓ 应用]  [✗ 拒绝]
    ↓ 用户点 [应用]
context.applyPatch(patch_id)
    → resume = merge(resume, after)
    → 编辑器立刻重渲染
    → 后台 PATCH /api/resumes/{id} 静默保存
```

### 流程 B：从零生成简历

```
用户输入 "帮我生成面向高级后端工程师的简历，我有5年Go经验"
    ↓
Manus → GenerateResumeTool
    → LLM 生成完整 ResumeData JSON
    → SSE: { type:"resume_generated", data:{resume, summary} }
    ↓
Chat 侧：ResumeGeneratedCard 展示
    "已生成面向高级后端工程师的简历"
    [导入到编辑器]  [放弃]
    ↓ 用户点 [导入]
context.setResume(generated_resume)
    → 编辑器显示新简历
    → POST /api/resumes 创建新记录
```

### 流程 C：针对 JD 优化现有简历

```
用户粘贴 JD 文本 → "帮我针对这份 JD 优化简历"
    ↓
Manus → 逐段分析 JD vs 当前简历
    → 多次调用 CVEditorAgentTool
    → 每处修改发一个 resume_patch 事件
    ↓
Chat 侧：多个 ResumeDiffCard 按顺序展示
    Patch 1: skills 调整
    Patch 2: experience[0].details 量化
    Patch 3: basic.title 改名
    ↓ 用户逐条 [应用] / [拒绝]
```

---

## Section 5：改动清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `frontend/src/contexts/ResumeContext.tsx` | 共享简历状态 |
| `frontend/src/components/agent-chat/ResumeDiffCard.tsx` | 替换旧 ResumeEditDiffCard |
| `frontend/src/components/agent-chat/ResumeGeneratedCard.tsx` | 生成场景确认卡 |

### 删除文件

| 文件 | 原因 |
|------|------|
| `frontend/src/utils/resumeEditDiff.ts` | regex 解析器，被结构化事件替代 |

### 修改文件

| 文件 | 改动摘要 |
|------|---------|
| `frontend/src/services/agentStream.ts` | 删 `resume_edit_diff` 分支，加 `resume_patch`/`resume_generated` 解析 |
| `frontend/src/hooks/useCLTP.ts` | handler 改为调 `context.pushPatch()` / `context.setResume()` |
| `frontend/src/pages/AgentChat/SophiaChat.tsx` | 删除 resume 本地状态，改读 context；预计瘦身 ~1000 行 |
| Workspace Editor | 改读 `useResumeContext().resume` |
| `backend/agent/web/streaming/events.py` | 加 `ResumePatchEvent` / `ResumeGeneratedEvent` |
| `backend/agent/tool/cv_editor_agent_tool.py` | 输出改为结构化 JSON，不再嵌 markdown |
| `backend/agent/agent/manus.py` | 注册 `GenerateResumeTool` |

### 不改动

- 所有 Workspace section 组件（EducationSection、ExperienceSection 等）
- 认证、PDF 生成、报告路由
- 数据库 models / migrations

---

## 实现顺序建议

1. `ResumeContext.tsx` — 建立共享状态基础
2. Backend events (`events.py` + `cv_editor_agent_tool.py`) — 结构化事件输出
3. `agentStream.ts` + `useCLTP.ts` — 前端解析新事件
4. `ResumeDiffCard.tsx` + `ResumeGeneratedCard.tsx` — 新 UI 组件
5. `SophiaChat.tsx` 瘦身 — 删本地状态，接 context
6. Workspace Editor 接 context
7. 删除 `resumeEditDiff.ts`
8. 测试三个完整流程
