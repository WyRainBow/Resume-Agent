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

interface ExperienceItem {
  id: string; company: string; position: string
  date: string; details: string; companyLogo?: string
}
interface ProjectItem {
  id: string; name: string; role: string
  date: string; description: string; link?: string
}
interface OpenSourceItem {
  id: string; name: string; repo: string
  role: string; date: string; description: string
}
interface AwardItem {
  id: string; title: string; issuer: string
  date: string; description: string
}
interface EducationItem {
  id: string; school: string; major: string
  degree: string; startDate: string; endDate: string; description: string
}
```

### `toResumeData()` 转换函数

旧 `Resume` 类型与 `ResumeData` 结构差异较大，需要明确映射：

| 旧字段（Resume） | 新字段（ResumeData） | 说明 |
|-----------------|---------------------|------|
| `contact.email` | `basic.email` | 平移 |
| `contact.phone` | `basic.phone` | 平移 |
| `contact.role` | `basic.title` | 重命名 |
| `internships[]` | `experience[]` | 重命名，字段对齐 |
| `skills` (array) | `skillContent` | 序列化为 HTML string |
| `name` (顶层) | `basic.name` | 移入 basic |

```typescript
function toResumeData(resume: Resume): ResumeData {
  return {
    id: resume.id ?? '',
    basic: {
      name: resume.name,
      title: resume.contact?.role ?? '',
      email: resume.contact?.email ?? '',
      phone: resume.contact?.phone ?? '',
      location: resume.contact?.location ?? '',
    },
    education: (resume.education ?? []).map(e => ({
      id: crypto.randomUUID(),
      school: e.title, major: e.subtitle ?? '',
      degree: e.degree ?? '', startDate: '', endDate: e.date,
      description: (e.details ?? []).join('\n'),
    })),
    experience: (resume.internships ?? []).map(e => ({
      id: crypto.randomUUID(),
      company: e.subtitle ?? '', position: e.title,
      date: e.date, details: (e.highlights ?? []).join('\n'),
    })),
    projects: (resume.projects ?? []).map(p => ({
      id: crypto.randomUUID(),
      name: p.title, role: p.subtitle ?? '',
      date: p.date ?? '', description: '',
      link: '',
    })),
    openSource: (resume.openSource ?? []).map(o => ({
      id: crypto.randomUUID(),
      name: o.name, repo: o.url ?? '',
      role: o.role ?? '', date: o.date ?? '', description: o.description ?? '',
    })),
    awards: (resume.awards ?? []).map(a => ({
      id: crypto.randomUUID(),
      title: typeof a === 'string' ? a : a,
      issuer: '', date: '', description: '',
    })),
    skillContent: Array.isArray(resume.skills)
      ? resume.skills.map(s => typeof s === 'string' ? s : `${s.category}: ${s.details}`).join('<br/>')
      : '',
  }
}
```

### 迁移策略

- 旧 `Resume` 类型保留用于 API 响应兼容，通过 `toResumeData()` 转换
- `agentStream.ts` 的 `resume_data` 参数类型改为 `ResumeData`
- `SophiaChat.tsx` 的 `loadedResumes` 统一为 `ResumeData[]`
- Backend `CVEditorAgentTool` JSON path 已对齐此格式（`basic.name`、`experience[0].details`），无需改动

---

## Section 2：SSE 事件协议

### 废弃

- `resume_edit_diff` 事件类型（数据嵌在 markdown `<resume_diff>` 标签中）
- `frontend/src/utils/resumeEditDiff.ts` 整个文件（regex 解析器）
  - **注意**：`SophiaChat.tsx` 中对该文件的 import 和所有使用必须在删除文件前先清除，否则 build 报错

### 与现有 `ResumeUpdatedEvent` 的关系

`events.py` 中已存在 `ResumeUpdatedEvent`（dataclass，携带完整 resume payload）。本方案将其演进为：

- `ResumeUpdatedEvent` → **废弃**，替换为 `ResumePatchEvent`（字段级 diff）
- 新增 `ResumeGeneratedEvent`（全量生成）

### 新增三种结构化 SSE 事件（TypeScript，前端消费）

```typescript
// 事件 1：字段级修改（自然语言编辑）
interface ResumePatchEvent {
  type: "resume_patch"
  data: {
    patch_id: string                // 唯一 ID，用于 apply/reject
    paths:    string[]              // 修改路径，如 ["experience[0].details"]
    before:   Partial<ResumeData>   // 修改前（只含改动字段）
    after:    Partial<ResumeData>   // 修改后（只含改动字段）
    summary:  string                // 人类可读描述
  }
}

// 事件 2：全量生成（从零生成）
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

### Backend 实现（`events.py`，沿用 @dataclass 模式）

```python
@dataclass
class ResumePatchEvent(StreamEvent):
    """Agent 修改简历字段，携带 before/after diff"""
    patch_id: str = ""
    paths: list = field(default_factory=list)
    before: dict = field(default_factory=dict)
    after: dict = field(default_factory=dict)
    summary: str = ""

    def to_dict(self):
        base = super().to_dict()
        base["data"] = {
            "patch_id": self.patch_id,
            "paths": self.paths,
            "before": self.before,
            "after": self.after,
            "summary": self.summary,
        }
        return base

@dataclass
class ResumeGeneratedEvent(StreamEvent):
    """Agent 全量生成简历"""
    resume: dict = field(default_factory=dict)
    summary: str = ""

    def to_dict(self):
        base = super().to_dict()
        base["data"] = {
            "resume": self.resume,
            "summary": self.summary,
        }
        return base
```

`CVEditorAgentTool` 修改：将当前 markdown 输出替换为发送 `ResumePatchEvent`。

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

  setResume:   (r: ResumeData) => void
  applyPatch:  (patch_id: string) => void
  rejectPatch: (patch_id: string) => void
  pushPatch:   (patch: PendingPatch) => void
}
```

### applyPatch 实现逻辑（path-based 写入，非 deepMerge）

`patch.after` 是 `Partial<ResumeData>`，若用 deepMerge 合并数组会按 index 覆盖，导致多个 patch 互相干扰。正确做法是按 `paths[]` 做 set-by-path 写入：

```typescript
applyPatch(patch_id) {
  const patch = pendingPatches.find(p => p.patch_id === patch_id)
  // 用 paths[] 逐路径写入，而非整体 deepMerge
  let updated = structuredClone(resume)
  for (const path of patch.paths) {
    const value = getByPath(patch.after, path)
    updated = setByPath(updated, path, value)
  }
  setResumeState(updated)
  setPendingPatches(prev => prev.map(p =>
    p.patch_id === patch_id ? { ...p, status: "applied" } : p
  ))
  api.patch(`/resumes/${resume.id}`, updated)  // 后台静默保存
}
```

### setResume（生成场景 + 覆盖逻辑）

```typescript
setResume(newResume) {
  setResumeState(newResume)
  if (resume !== null) {
    // 当前已有简历 → PATCH 覆盖
    api.patch(`/resumes/${resume.id}`, newResume)
  } else {
    // 没有简历 → POST 新建
    api.post('/resumes', newResume).then(created => {
      setResumeState(r => ({ ...r, id: created.id }))
    })
  }
}
```

### 事件路由：在 SophiaChat 而非 useCLTP 中处理

`useCLTP` 是通用传输 hook，不应耦合 domain 逻辑。路由方式：

```typescript
// SophiaChat.tsx 的 onSSEEvent 回调中
onSSEEvent: (event: AgentStreamEvent) => {
  if (event.type === "resume_patch") {
    context.pushPatch(event.data)
  } else if (event.type === "resume_generated") {
    context.setResume(event.data.resume)  // 触发确认卡
  }
  // 其余事件走原有处理逻辑
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
    → SSE: ResumePatchEvent { patch_id, paths, before, after, summary }
    ↓
agentStream.ts 解析 → SophiaChat.onSSEEvent
    → context.pushPatch(patch)
    ↓
Chat 侧：ResumeDiffCard 展示 before/after
    [✓ 应用]  [✗ 拒绝]
    ↓ 用户点 [应用]
context.applyPatch(patch_id)
    → set-by-path 写入 resume
    → 编辑器立刻重渲染
    → 后台 PATCH /api/resumes/{id} 静默保存
```

### 流程 B：从零生成简历

```
用户输入 "帮我生成面向高级后端工程师的简历，我有5年Go经验"
    ↓
Manus → GenerateResumeTool
    → LLM 生成完整 ResumeData JSON
    → SSE: ResumeGeneratedEvent { resume, summary }
    ↓
SophiaChat.onSSEEvent → context.setResume(resume)  [先存 context]
Chat 侧：ResumeGeneratedCard 展示
    "已生成面向高级后端工程师的简历"
    [导入到编辑器]  [放弃]
    ↓ 用户点 [导入]  → 编辑器读 context.resume 即可（已在 context 中）
       用户点 [放弃] → context.setResume(null) 或 revert
```

> **注意**：`setResume` 在收到 SSE 时立即写入 context；"导入"按钮只是让编辑器 visible，不再重复写入。

### 流程 C：针对 JD 优化现有简历

```
用户粘贴 JD 文本 → "帮我针对这份 JD 优化简历"
    ↓
Manus → 逐段分析 JD vs 当前简历
    → 多次调用 CVEditorAgentTool
    → 每处修改发一个 ResumePatchEvent
    ↓
Chat 侧：多个 ResumeDiffCard 按顺序展示
    Patch 1: skills 调整
    Patch 2: experience[0].details 量化
    Patch 3: basic.title 改名
    ↓ 用户逐条 [应用] / [拒绝]
    → 每次 applyPatch 用 set-by-path，互不干扰
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

| 文件 | 原因 | 前提 |
|------|------|------|
| `frontend/src/utils/resumeEditDiff.ts` | regex 解析器，被结构化事件替代 | 先清除 SophiaChat.tsx 中所有 import 和调用 |

### 修改文件

| 文件 | 改动摘要 |
|------|---------|
| `frontend/src/services/agentStream.ts` | 删 `resume_edit_diff` 分支，加 `resume_patch`/`resume_generated` 解析 |
| `frontend/src/hooks/useCLTP.ts` | 保持通用，不加 domain 逻辑 |
| `frontend/src/pages/AgentChat/SophiaChat.tsx` | `onSSEEvent` 路由 resume 事件到 context；删除 resume 本地状态；预计瘦身 ~1000 行 |
| Workspace Editor | 改读 `useResumeContext().resume` |
| `backend/agent/web/streaming/events.py` | 加 `ResumePatchEvent` / `ResumeGeneratedEvent`（@dataclass 模式）；废弃 `ResumeUpdatedEvent` |
| `backend/agent/tool/cv_editor_agent_tool.py` | 输出改为发送 `ResumePatchEvent`，不再嵌 markdown |
| `backend/agent/agent/manus.py` | 注册 `GenerateResumeTool` |

### 不改动

- 所有 Workspace section 组件（EducationSection、ExperienceSection 等）
- 认证、PDF 生成、报告路由
- 数据库 models / migrations

---

## Section 6：GenerateResumeTool 规范

新建工具 `backend/agent/tool/generate_resume_tool.py`：

**参数：**
```python
job_description: str   # 目标岗位 JD 或岗位名称
user_background: str   # 用户自述经历（可选）
```

**实现方式：** 直接调用 LLM，不复用 CVEditor（CVEditor 用于字段级修改，生成是全量创建）。

**输出合约：** 调用完毕后发送 `ResumeGeneratedEvent`，携带完整 `ResumeData` dict。

**Prompt 要点：**
- 要求 LLM 严格输出 `ResumeData` JSON schema
- 包含 `basic`、`experience`、`education`、`projects`、`skills` 等标准字段
- 根据 JD 关键词调整 `basic.title` 和 `skillContent`

---

## 实现顺序

顺序调整为：后端先行，方便每步独立测试。

1. **Backend events** — `events.py` 加 `ResumePatchEvent` / `ResumeGeneratedEvent`
2. **CVEditorAgentTool** — 输出改为 `ResumePatchEvent`
3. **GenerateResumeTool** — 新建，注册到 manus.py
4. **agentStream.ts** — 前端解析新事件（可 curl 验证后端先）
5. **ResumeContext.tsx** — 共享状态
6. **ResumeDiffCard + ResumeGeneratedCard** — 新 UI 组件
7. **SophiaChat.tsx** — onSSEEvent 路由 + 删本地 resume 状态
8. **Workspace Editor** — 接 context
9. **删除 resumeEditDiff.ts**（Step 7 完成后）
10. 测试三个完整流程
