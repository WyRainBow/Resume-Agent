# Natural Language Resume Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**状态：** ✅ 全部完成（2026-03-24）— 复盘见 `knowledge-base/reviews/2026-03-24-nl-resume-refactor-review.md`

**Goal:** 重构自然语言简历修改与生成的完整数据流：结构化 SSE 事件 + 共享 ResumeContext + Chat/Editor 并排实时同步。

**Architecture:** Backend 发送结构化 `ResumePatchEvent`/`ResumeGeneratedEvent`（@dataclass，替代 markdown 嵌入 diff）；前端 `ResumeContext` 作为 Chat 和 Editor 的共享状态层；`SophiaChat.onSSEEvent` 路由 resume 事件到 context，用户点 Apply 后 Editor 立刻重渲染。

**Tech Stack:** Python FastAPI + dataclasses（后端事件）；React 18 + TypeScript + Context API（前端状态）；axios（API calls）；set-by-path 精确路径写入（替代 deepMerge）

**Spec:** `knowledge-base/specs/2026-03-23-nl-resume-refactor-design.md`

---

## 关键代码约定（实现前必读）

### Backend ToolResult
`ToolResult` 有四个字段：`output`, `error`, `base64_image`, `system`。
结构化数据通过 `system=json.dumps(data)` 传递，**没有** `structured_data` 参数。

### Backend dataclass 模式
`events.py` 的所有事件类用 `__init__` 调 `super().__init__(event_type=..., data={...})`，
**不用** dataclass 字段继承。参考 `ResumeUpdatedEvent` 的写法。

### toolcall.py 白名单
`toolcall.py` 只处理特定 tool name 的 structured data，新工具必须加入白名单。

### agent_stream.py 事件发送
`agent_stream.py` 在 tool result 处理处根据 `type` 字段发送 SSE 事件，新事件类型需加分支。

### Frontend API client
`frontend/src/services/api.ts` 用 axios，没有 `api` 对象。直接用 `axios.patch/post`。

### Frontend ResumeData 类型冲突
`frontend/src/pages/Workspace/v2/types/index.ts` 已有完整的 `ResumeData`（含 `basic`, `experience` 等）。
新增的类型应与此对齐，**不要**在 `types/resume.ts` 重复定义，而是从 v2/types 导入或扩展。

---

## File Map

### 新增文件
| 文件 | 职责 |
|------|------|
| `backend/agent/tool/generate_resume_tool.py` | GenerateResumeTool：全量生成简历 |
| `backend/tests/test_resume_events.py` | 后端事件单元测试 |
| `frontend/src/contexts/ResumeContext.tsx` | 共享简历状态（resume + pendingPatches） |
| `frontend/src/utils/resumePatch.ts` | set-by-path / get-by-path 工具函数 |
| `frontend/src/components/agent-chat/ResumeDiffCard.tsx` | 替换旧 ResumeEditDiffCard |
| `frontend/src/components/agent-chat/ResumeGeneratedCard.tsx` | 生成场景确认卡 |

### 修改文件
| 文件 | 改动 |
|------|------|
| `backend/agent/web/streaming/events.py` | 加 `ResumePatchEvent`、`ResumeGeneratedEvent` |
| `backend/agent/agent/toolcall.py` | 更新 type 白名单，接受 `resume_patch` |
| `backend/agent/web/streaming/agent_stream.py` | 加 `generate_resume` 工具白名单 + `ResumeGeneratedEvent` 发送分支 |
| `backend/agent/tool/cv_editor_agent_tool.py` | structured data type 改为 `resume_patch` |
| `backend/agent/agent/manus.py` | 注册 `GenerateResumeTool` |
| `frontend/src/services/agentStream.ts` | 加 `resume_patch`/`resume_generated` 解析分支 |
| `frontend/src/pages/AgentChat/SophiaChat.tsx` | onSSEEvent 路由 resume 事件；删本地 resume 状态 |
| `frontend/src/pages/Workspace/` (Editor) | 改读 `useResumeContext().resume` |

### 删除文件（最后）
| 文件 | 时机 |
|------|------|
| `frontend/src/utils/resumeEditDiff.ts` | Task 9 完成后 |

---

## Task 1：后端 — 新增 ResumePatchEvent 和 ResumeGeneratedEvent

**Files:**
- Modify: `backend/agent/web/streaming/events.py`
- Create: `backend/tests/test_resume_events.py`

- [x] **Step 1: 写失败测试**

```python
# backend/tests/test_resume_events.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.agent.web.streaming.events import ResumePatchEvent, ResumeGeneratedEvent

def test_resume_patch_event_to_dict():
    evt = ResumePatchEvent(
        patch_id="p1",
        paths=["experience[0].details"],
        before={"experience": [{"details": "负责后端开发"}]},
        after={"experience": [{"details": "主导重构，QPS提升3x"}]},
        summary="量化工作经历",
    )
    d = evt.to_dict()
    assert d["type"] == "resume_patch"
    assert d["data"]["patch_id"] == "p1"
    assert d["data"]["paths"] == ["experience[0].details"]
    assert d["data"]["summary"] == "量化工作经历"

def test_resume_generated_event_to_dict():
    evt = ResumeGeneratedEvent(
        resume={"basic": {"name": "张三"}},
        summary="已生成后端工程师简历",
    )
    d = evt.to_dict()
    assert d["type"] == "resume_generated"
    assert d["data"]["resume"]["basic"]["name"] == "张三"
    assert d["data"]["summary"] == "已生成后端工程师简历"
```

- [x] **Step 2: 运行测试，确认失败**

```bash
cd /Users/wy770/Resume-Agent
source .venv/bin/activate
pytest backend/tests/test_resume_events.py -v
```

期望：`ImportError: cannot import name 'ResumePatchEvent'`

- [x] **Step 3: 在 `events.py` 加两个新事件类**

先在 `EventType` enum 中加两行：
```python
RESUME_PATCH = "resume_patch"
RESUME_GENERATED = "resume_generated"
```

然后在 `ResumeUpdatedEvent` 之后添加（**注意：用 `__init__` 模式，不用 dataclass 字段**）：

```python
@dataclass
class ResumePatchEvent(StreamEvent):
    """Agent 修改简历字段，携带 before/after diff"""
    def __init__(self, patch_id: str, paths: list, before: dict, after: dict,
                 summary: str, session_id: str = None):
        super().__init__(
            event_type=EventType.RESUME_PATCH,
            data={
                "patch_id": patch_id,
                "paths": paths,
                "before": before,
                "after": after,
                "summary": summary,
            },
            session_id=session_id,
        )


@dataclass
class ResumeGeneratedEvent(StreamEvent):
    """Agent 全量生成简历"""
    def __init__(self, resume: dict, summary: str, session_id: str = None):
        super().__init__(
            event_type=EventType.RESUME_GENERATED,
            data={"resume": resume, "summary": summary},
            session_id=session_id,
        )
```

- [x] **Step 4: 运行测试，确认通过**

```bash
source .venv/bin/activate
pytest backend/tests/test_resume_events.py -v
```

期望：2 个 PASS

- [x] **Step 5: Commit**

```bash
git add backend/agent/web/streaming/events.py backend/tests/test_resume_events.py
git commit -m "feat(backend): add ResumePatchEvent and ResumeGeneratedEvent"
```

---

## Task 2：后端 — CVEditorAgentTool 改为发送 resume_patch + 更新 toolcall.py 白名单

**Files:**
- Modify: `backend/agent/tool/cv_editor_agent_tool.py`
- Modify: `backend/agent/agent/toolcall.py`
- Modify: `backend/agent/web/streaming/agent_stream.py`

- [x] **Step 1: 修改 cv_editor_agent_tool.py 的 structured_data type**

找到 `execute()` 方法中构建 structured_data 的部分，将 `"type": "resume_edit_diff"` 改为 `"resume_patch"`，并加入 `patch_id` 和 `paths` 字段：

```python
import uuid

# 在构建 structured_data 处：
patch_id = str(uuid.uuid4())
structured_data = {
    "type": "resume_patch",
    "patch_id": patch_id,
    "paths": [self.path] if hasattr(self, 'path') else [],
    "before": {"_raw": before_text},   # before_text = 修改前内容字符串
    "after":  {"_raw": after_text},    # after_text  = 修改后内容字符串
    "summary": f"修改了 {getattr(self, 'path', '简历字段')}",
}
# system 字段编码（ToolResult 没有 structured_data 参数）
return ToolResult(output=output_text, system=json.dumps(structured_data, ensure_ascii=False))
```

> 注意：`before_text`/`after_text` 是工具内已有变量，保持原有提取逻辑不变，只改 structured_data 的格式。

- [x] **Step 2: 更新 toolcall.py 的 type 白名单**

找到 toolcall.py 中类似这段的代码：

```python
if structured.get("type") != "resume_edit_diff":
    return
```

改为：

```python
if structured.get("type") not in {"resume_edit_diff", "resume_patch"}:
    return
```

- [x] **Step 3: 更新 agent_stream.py 的工具白名单和事件发送**

找到 agent_stream.py 中处理 cv_editor_agent tool result 并发送 `ResumeUpdatedEvent` 的代码段（约 lines 860-900）。

**3a.** 找到工具名白名单（包含 `"cv_editor_agent"` 等），加入 `"generate_resume"`：

```python
STRUCTURED_DATA_TOOLS = {"web_search", "show_resume", "cv_editor_agent", "cv_reader_agent", "generate_resume"}
```

**3b.** 在 cv_editor_agent 发送 `ResumeUpdatedEvent` 的 if 块之后，加 `resume_patch` 分支：

```python
# 新增：cv_editor_agent 发 resume_patch 事件
if tool_name == "cv_editor_agent" and structured.get("type") == "resume_patch":
    from backend.agent.web.streaming.events import ResumePatchEvent
    yield ResumePatchEvent(
        patch_id=structured.get("patch_id", ""),
        paths=structured.get("paths", []),
        before=structured.get("before", {}),
        after=structured.get("after", {}),
        summary=structured.get("summary", ""),
        session_id=self._session_id,
    )

# 新增：generate_resume 发 resume_generated 事件
if tool_name == "generate_resume" and structured.get("type") == "resume_generated":
    from backend.agent.web.streaming.events import ResumeGeneratedEvent
    yield ResumeGeneratedEvent(
        resume=structured.get("resume", {}),
        summary=structured.get("summary", ""),
        session_id=self._session_id,
    )
```

- [x] **Step 4: 验证后端能启动（import 检查）**

```bash
source .venv/bin/activate && python3 -c "
import sys; sys.path.insert(0, '.')
from backend.core.logger import setup_logging
setup_logging(False, 'INFO', 'logs/test')
from backend.agent.web.routes import api_router
print('✓ backend imports OK')
" 2>&1 | tail -5
```

期望：最后一行 `✓ backend imports OK`

- [x] **Step 5: Commit**

```bash
git add backend/agent/tool/cv_editor_agent_tool.py \
        backend/agent/agent/toolcall.py \
        backend/agent/web/streaming/agent_stream.py
git commit -m "feat(backend): CVEditor emits resume_patch; update toolcall and agent_stream whitelists"
```

---

## Task 3：后端 — 新建 GenerateResumeTool 并注册

**Files:**
- Create: `backend/agent/tool/generate_resume_tool.py`
- Modify: `backend/agent/tool/__init__.py`
- Modify: `backend/agent/agent/manus.py`

- [x] **Step 1: 写失败测试**

```python
# backend/tests/test_generate_resume_tool.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

def test_generate_resume_tool_schema():
    from backend.agent.tool.generate_resume_tool import GenerateResumeTool
    tool = GenerateResumeTool()
    assert tool.name == "generate_resume"
    props = tool.parameters["properties"]
    assert "job_description" in props
    assert "user_background" in props
```

- [x] **Step 2: 运行，确认失败**

```bash
source .venv/bin/activate
pytest backend/tests/test_generate_resume_tool.py -v
```

期望：`ImportError`

- [x] **Step 3: 创建 generate_resume_tool.py**

```python
# backend/agent/tool/generate_resume_tool.py
import json
import uuid
from backend.agent.tool.base import BaseTool, ToolResult
from backend.core.logger import get_logger

logger = get_logger(__name__)

GENERATE_RESUME_PROMPT = """你是专业简历写作专家。根据以下信息生成完整简历 JSON。

目标岗位：{job_description}
用户背景：{user_background}

严格按此 JSON schema 输出，不输出其他文字：
{{
  "basic": {{"name": "", "title": "", "email": "", "phone": "", "location": ""}},
  "education": [{{"id": "", "school": "", "major": "", "degree": "", "startDate": "", "endDate": "", "description": ""}}],
  "experience": [{{"id": "", "company": "", "position": "", "date": "", "details": ""}}],
  "projects": [{{"id": "", "name": "", "role": "", "date": "", "description": "", "link": ""}}],
  "openSource": [],
  "awards": [],
  "skillContent": ""
}}"""


class GenerateResumeTool(BaseTool):
    name: str = "generate_resume"
    description: str = (
        "根据岗位描述和用户背景，从零生成完整简历。"
        "适用于：用户没有简历、或想针对新岗位重新生成。"
    )
    parameters: dict = {
        "type": "object",
        "properties": {
            "job_description": {
                "type": "string",
                "description": "目标岗位 JD 或岗位名称",
            },
            "user_background": {
                "type": "string",
                "description": "用户自述经历、技能、教育背景（可选）",
            },
        },
        "required": ["job_description"],
    }

    async def execute(self, job_description: str, user_background: str = "") -> ToolResult:
        from backend.agent.llm import LLM
        from backend.agent.schema import Message, Role

        prompt = GENERATE_RESUME_PROMPT.format(
            job_description=job_description,
            user_background=user_background or "未提供",
        )
        try:
            llm = LLM()
            response = await llm.ask(
                messages=[Message(role=Role.USER, content=prompt)],
            )
            content = response.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            resume_dict = json.loads(content.strip())

            for section in ["education", "experience", "projects", "openSource", "awards"]:
                for item in resume_dict.get(section, []):
                    if not item.get("id"):
                        item["id"] = str(uuid.uuid4())

            summary = f"已生成面向「{job_description[:30]}」的简历"
            structured_data = {
                "type": "resume_generated",
                "resume": resume_dict,
                "summary": summary,
            }
            return ToolResult(
                output=summary,
                system=json.dumps(structured_data, ensure_ascii=False),
            )
        except json.JSONDecodeError as e:
            logger.error(f"[GenerateResumeTool] JSON 解析失败: {e}")
            return ToolResult(output=f"生成失败，LLM 返回格式有误", error=str(e))
        except Exception as e:
            logger.error(f"[GenerateResumeTool] 生成异常: {e}")
            return ToolResult(output=f"生成失败: {e}", error=str(e))
```

- [x] **Step 4: 在 `__init__.py` 加导出**

找到 `backend/agent/tool/__init__.py`，加：

```python
from backend.agent.tool.generate_resume_tool import GenerateResumeTool
```

并在 `__all__` 中加 `"GenerateResumeTool"`。

- [x] **Step 5: 在 manus.py 注册**

找到 `available_tools: ToolCollection` 的初始化位置，加入：

```python
from backend.agent.tool.generate_resume_tool import GenerateResumeTool
# 在 ToolCollection(...) 的工具列表中加：
GenerateResumeTool(),
```

- [x] **Step 6: 运行测试**

```bash
source .venv/bin/activate
pytest backend/tests/test_generate_resume_tool.py -v
```

期望：1 个 PASS

- [x] **Step 7: Commit**

```bash
git add backend/agent/tool/generate_resume_tool.py \
        backend/agent/tool/__init__.py \
        backend/agent/agent/manus.py \
        backend/tests/test_generate_resume_tool.py
git commit -m "feat(backend): add GenerateResumeTool and register in Manus"
```

---

## Task 4：前端 — resumePatch.ts 工具函数（set-by-path）

**Files:**
- Create: `frontend/src/utils/resumePatch.ts`

- [x] **Step 1: 创建 resumePatch.ts**

```typescript
// frontend/src/utils/resumePatch.ts

/**
 * 按路径读取对象值，支持数组索引
 * 例：getByPath(obj, "experience[0].details")
 */
export function getByPath(obj: any, path: string): any {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  return parts.reduce((curr, key) => curr?.[key], obj)
}

/**
 * 按路径写入对象值，返回新对象（不可变）
 * 例：setByPath(resume, "experience[0].details", "新内容")
 */
export function setByPath(obj: any, path: string, value: any): any {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  const result = structuredClone(obj)
  let curr = result
  for (let i = 0; i < parts.length - 1; i++) {
    curr = curr[parts[i]]
  }
  curr[parts[parts.length - 1]] = value
  return result
}

/**
 * 按 paths 数组批量写入 after 中的值到 resume
 */
export function applyPatchPaths(resume: any, paths: string[], after: any): any {
  let result = resume
  for (const path of paths) {
    const value = getByPath(after, path)
    if (value !== undefined) {
      result = setByPath(result, path, value)
    }
  }
  return result
}
```

- [x] **Step 2: 确认编译**

```bash
cd /Users/wy770/Resume-Agent/frontend
npx tsc --noEmit 2>&1 | grep "resumePatch" | head -10
```

期望：无错误

- [x] **Step 3: Commit**

```bash
git add frontend/src/utils/resumePatch.ts
git commit -m "feat(frontend): add resumePatch utils (set-by-path)"
```

---

## Task 5：前端 — 新建 ResumeContext

**Files:**
- Create: `frontend/src/contexts/ResumeContext.tsx`
- Modify: `frontend/src/App.tsx`

> `ResumeData` 从 `@/pages/Workspace/v2/types` 导入（已存在的权威定义）。

- [x] **Step 1: 创建 ResumeContext.tsx**

```typescript
// frontend/src/contexts/ResumeContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import { applyPatchPaths } from '@/utils/resumePatch'
import axios from 'axios'

export interface PendingPatch {
  patch_id:  string
  message_id: string           // 关联到哪条消息，用于渲染时过滤
  paths:     string[]
  before:    Record<string, any>
  after:     Record<string, any>
  summary:   string
  status:    'pending' | 'applied' | 'rejected'
}

interface ResumeContextValue {
  resume:         ResumeData | null
  pendingPatches: PendingPatch[]
  setResume:      (r: ResumeData | null) => void
  pushPatch:      (patch: Omit<PendingPatch, 'status'>) => void
  applyPatch:     (patch_id: string) => void
  rejectPatch:    (patch_id: string) => void
}

const ResumeContext = createContext<ResumeContextValue | null>(null)

export function ResumeProvider({ children }: { children: React.ReactNode }) {
  const [resume, setResumeState] = useState<ResumeData | null>(null)
  const [pendingPatches, setPendingPatches] = useState<PendingPatch[]>([])

  const setResume = useCallback((newResume: ResumeData | null) => {
    if (!newResume) { setResumeState(null); return }
    // 保存到后台（PATCH 覆盖已有，POST 创建新）
    if (resume?.id) {
      axios.patch(`/api/resumes/${resume.id}`, { data: newResume }).catch(console.error)
    } else if (!newResume.id) {
      axios.post('/api/resumes', { name: newResume.basic?.name || '新简历', data: newResume })
        .then((res: any) => setResumeState(r => r ? { ...r, id: res.data.id } : r))
        .catch(console.error)
    }
    setResumeState(newResume)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume?.id])

  const pushPatch = useCallback((patch: Omit<PendingPatch, 'status'>) => {
    setPendingPatches(prev => [...prev, { ...patch, status: 'pending' }])
  }, [])

  const applyPatch = useCallback((patch_id: string) => {
    setPendingPatches(prev => {
      const patch = prev.find(p => p.patch_id === patch_id)
      if (!patch) return prev
      setResumeState(current => {
        if (!current) return current
        const updated = applyPatchPaths(current, patch.paths, patch.after) as ResumeData
        if (updated.id) {
          axios.patch(`/api/resumes/${updated.id}`, { data: updated }).catch(console.error)
        }
        return updated
      })
      return prev.map(p => p.patch_id === patch_id ? { ...p, status: 'applied' } : p)
    })
  }, [])

  const rejectPatch = useCallback((patch_id: string) => {
    setPendingPatches(prev =>
      prev.map(p => p.patch_id === patch_id ? { ...p, status: 'rejected' } : p)
    )
  }, [])

  return (
    <ResumeContext.Provider value={{
      resume, pendingPatches,
      setResume, pushPatch, applyPatch, rejectPatch,
    }}>
      {children}
    </ResumeContext.Provider>
  )
}

export function useResumeContext() {
  const ctx = useContext(ResumeContext)
  if (!ctx) throw new Error('useResumeContext must be used within ResumeProvider')
  return ctx
}
```

- [x] **Step 2: 在 App.tsx 挂载 ResumeProvider**

找到 `App.tsx` 中 `<BrowserRouter>` 的位置，用 `<ResumeProvider>` 包裹：

```tsx
import { ResumeProvider } from './contexts/ResumeContext'

// JSX 中：
<ResumeProvider>
  <BrowserRouter>
    {/* 原有内容 */}
  </BrowserRouter>
</ResumeProvider>
```

- [x] **Step 3: 确认编译**

```bash
cd /Users/wy770/Resume-Agent/frontend
npx tsc --noEmit 2>&1 | grep -E "ResumeContext|resumePatch" | head -20
```

期望：无错误

- [x] **Step 4: Commit**

```bash
git add frontend/src/contexts/ResumeContext.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add ResumeContext with patch/generate support"
```

---

## Task 6：前端 — agentStream.ts 加新事件解析

**Files:**
- Modify: `frontend/src/services/agentStream.ts`

- [x] **Step 1: 在 `AgentStreamHandlers` 加两个新回调**

```typescript
onResumePatch?: (patch: {
  patch_id: string
  paths:    string[]
  before:   Record<string, any>
  after:    Record<string, any>
  summary:  string
}) => void

onResumeGenerated?: (data: {
  resume:  Record<string, any>
  summary: string
}) => void
```

- [x] **Step 2: 在事件分发处加新分支**

在 `streamAgent` 内处理事件的位置（`handlers.onEvent?.(event)` 附近）加：

```typescript
if (event.type === 'resume_patch' && handlers.onResumePatch) {
  handlers.onResumePatch(event.data)
}
if (event.type === 'resume_generated' && handlers.onResumeGenerated) {
  handlers.onResumeGenerated(event.data)
}
```

- [x] **Step 3: 确认编译**

```bash
cd /Users/wy770/Resume-Agent/frontend
npx tsc --noEmit 2>&1 | grep "agentStream" | head -10
```

期望：无错误

- [x] **Step 4: Commit**

```bash
git add frontend/src/services/agentStream.ts
git commit -m "feat(frontend): agentStream handles resume_patch and resume_generated"
```

---

## Task 7：前端 — ResumeDiffCard 和 ResumeGeneratedCard

**Files:**
- Create: `frontend/src/components/agent-chat/ResumeDiffCard.tsx`
- Create: `frontend/src/components/agent-chat/ResumeGeneratedCard.tsx`

- [x] **Step 1: 创建 ResumeDiffCard.tsx**

```tsx
// frontend/src/components/agent-chat/ResumeDiffCard.tsx
import React from 'react'
import { useResumeContext, type PendingPatch } from '../../contexts/ResumeContext'

export function ResumeDiffCard({ patch }: { patch: PendingPatch }) {
  const { applyPatch, rejectPatch } = useResumeContext()

  const beforeText = (patch.before as any)._raw ?? JSON.stringify(patch.before, null, 2)
  const afterText  = (patch.after  as any)._raw ?? JSON.stringify(patch.after,  null, 2)

  if (patch.status === 'applied') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
        ✓ 已应用：{patch.summary}
      </div>
    )
  }
  if (patch.status === 'rejected') {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-400 line-through">
        {patch.summary}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-white shadow-sm overflow-hidden my-2">
      <div className="px-4 py-2 bg-blue-50 text-sm font-medium text-blue-800">
        {patch.summary}
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        <div className="p-3">
          <div className="text-xs text-gray-400 mb-1">修改前</div>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">{beforeText}</pre>
        </div>
        <div className="p-3">
          <div className="text-xs text-gray-400 mb-1">修改后</div>
          <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words font-medium">{afterText}</pre>
        </div>
      </div>
      <div className="flex gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => applyPatch(patch.patch_id)}
          className="flex-1 rounded-md bg-blue-600 text-white text-sm py-1.5 hover:bg-blue-700 transition-colors"
        >
          ✓ 应用
        </button>
        <button
          onClick={() => rejectPatch(patch.patch_id)}
          className="flex-1 rounded-md border border-gray-300 text-gray-600 text-sm py-1.5 hover:bg-gray-100 transition-colors"
        >
          ✗ 拒绝
        </button>
      </div>
    </div>
  )
}
```

- [x] **Step 2: 创建 ResumeGeneratedCard.tsx**

```tsx
// frontend/src/components/agent-chat/ResumeGeneratedCard.tsx
import React from 'react'
import { useResumeContext } from '../../contexts/ResumeContext'
import type { ResumeData } from '@/pages/Workspace/v2/types'

interface Props {
  resume:   ResumeData
  summary:  string
  onDismiss: () => void
}

export function ResumeGeneratedCard({ resume, summary, onDismiss }: Props) {
  const { setResume } = useResumeContext()

  return (
    <div className="rounded-lg border border-purple-200 bg-white shadow-sm overflow-hidden my-2">
      <div className="px-4 py-3 bg-purple-50">
        <div className="text-sm font-medium text-purple-800">{summary}</div>
        <div className="text-xs text-purple-500 mt-0.5">
          {resume.basic?.name} · {resume.experience?.length ?? 0} 段工作经历
        </div>
      </div>
      <div className="flex gap-2 px-4 py-3">
        <button
          onClick={() => { setResume(resume); onDismiss() }}
          className="flex-1 rounded-md bg-purple-600 text-white text-sm py-1.5 hover:bg-purple-700 transition-colors"
        >
          导入到编辑器
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 rounded-md border border-gray-300 text-gray-600 text-sm py-1.5 hover:bg-gray-100 transition-colors"
        >
          放弃
        </button>
      </div>
    </div>
  )
}
```

- [x] **Step 3: 确认编译**

```bash
cd /Users/wy770/Resume-Agent/frontend
npx tsc --noEmit 2>&1 | grep -E "DiffCard|GeneratedCard" | head -10
```

期望：无错误

- [x] **Step 4: Commit**

```bash
git add frontend/src/components/agent-chat/ResumeDiffCard.tsx \
        frontend/src/components/agent-chat/ResumeGeneratedCard.tsx
git commit -m "feat(frontend): add ResumeDiffCard and ResumeGeneratedCard"
```

---

## Task 8：前端 — SophiaChat.tsx 接入 ResumeContext

**Files:**
- Modify: `frontend/src/pages/AgentChat/SophiaChat.tsx`

- [x] **Step 1: 加 import**

```typescript
import { useResumeContext, type PendingPatch } from '../../contexts/ResumeContext'
import { ResumeDiffCard } from '../../components/agent-chat/ResumeDiffCard'
import { ResumeGeneratedCard } from '../../components/agent-chat/ResumeGeneratedCard'
```

- [x] **Step 2: 在组件函数体内获取 context**

```typescript
const { resume, pendingPatches, pushPatch, setResume } = useResumeContext()

// 控制 ResumeGeneratedCard 显示的本地 state
const [generatedResume, setGeneratedResume] = useState<{
  resume: any; summary: string
} | null>(null)
```

- [x] **Step 3: 在 streamAgent handlers 加新回调**

```typescript
onResumePatch: (patch) => {
  pushPatch({ ...patch, message_id: currentMessageId })
},
onResumeGenerated: (data) => {
  setGeneratedResume(data)
},
```

> `currentMessageId` 是当前 assistant 消息的 ID（已有变量）。

- [x] **Step 4: 在消息渲染处加 DiffCard**

在渲染每条 assistant 消息内容之后，渲染该消息关联的 patches：

```tsx
{pendingPatches
  .filter(p => p.message_id === message.id)
  .map(patch => (
    <ResumeDiffCard key={patch.patch_id} patch={patch} />
  ))
}
```

- [x] **Step 5: 渲染 ResumeGeneratedCard**

在消息列表底部（streaming lane 附近）：

```tsx
{generatedResume && (
  <ResumeGeneratedCard
    resume={generatedResume.resume}
    summary={generatedResume.summary}
    onDismiss={() => setGeneratedResume(null)}
  />
)}
```

- [x] **Step 6: 删除旧的本地 resume 状态**

搜索并删除（旧 context 替代）：
- `resumeEditDiffs` state 及相关 setter 和渲染
- 旧 `ResumeEditDiffCard` 的 import 和使用

```bash
grep -n "resumeEditDiff\|ResumeEditDiff" frontend/src/pages/AgentChat/SophiaChat.tsx | head -20
```

逐一清除。

- [x] **Step 7: 确认编译**

```bash
cd /Users/wy770/Resume-Agent/frontend
npx tsc --noEmit 2>&1 | head -30
```

期望：无错误

- [x] **Step 8: Commit**

```bash
git add frontend/src/pages/AgentChat/SophiaChat.tsx
git commit -m "feat(frontend): SophiaChat routes resume_patch/generated events to ResumeContext"
```

---

## Task 9：前端 — Workspace Editor 接入 ResumeContext + 清理

**Files:**
- Modify: Workspace Editor 主文件（先用以下命令定位）
- Delete: `frontend/src/utils/resumeEditDiff.ts`

- [x] **Step 1: 定位 Workspace Editor 的简历数据来源**

```bash
grep -rn "resumeData\|setResumeData\|useResume" \
  /Users/wy770/Resume-Agent/frontend/src/pages/Workspace/ \
  --include="*.tsx" -l
```

- [x] **Step 2: 在 Editor 顶层组件加 context**

```typescript
import { useResumeContext } from '@/contexts/ResumeContext'

const { resume, setResume } = useResumeContext()
```

- [x] **Step 3: 将 Editor 的 resume prop 改为读 context**

原来 `resumeData={localState}` → `resumeData={resume ?? localState}`（渐进迁移，不破坏编辑器现有逻辑）。

编辑器内部用户手动修改字段时，在 onChange 回调加：

```typescript
setResume(updatedResume)  // 同步到 context
```

- [x] **Step 4: 确认 resumeEditDiff.ts 无残留引用**

```bash
grep -r "resumeEditDiff\|extractResumeEditDiff\|ResumeEditDiff" \
  /Users/wy770/Resume-Agent/frontend/src \
  --include="*.ts" --include="*.tsx"
```

期望：无输出

- [x] **Step 5: 删除 resumeEditDiff.ts**

```bash
rm /Users/wy770/Resume-Agent/frontend/src/utils/resumeEditDiff.ts
```

- [x] **Step 6: 最终编译确认**

```bash
cd /Users/wy770/Resume-Agent/frontend
npx tsc --noEmit 2>&1 | head -20
```

期望：无错误

- [x] **Step 7: Commit**

```bash
git add frontend/src/pages/Workspace/
git add -u frontend/src/utils/resumeEditDiff.ts
git commit -m "feat(frontend): Workspace editor reads ResumeContext; delete resumeEditDiff.ts"
```

---

## Task 10：端到端验证

- [x] **Step 1: 启动后端**

```bash
cd /Users/wy770/Resume-Agent
source .venv/bin/activate
uvicorn backend.main:app --port 9000 --reload
```

- [x] **Step 2: 启动前端**

```bash
cd /Users/wy770/Resume-Agent/frontend
npm run dev
```

- [x] **Step 3: 验证流程 A（自然语言修改）**

1. 打开 Chat + Editor 并排界面，加载一份简历
2. 输入："帮我把工作经历第一条更量化"
3. 确认：Chat 侧出现 `ResumeDiffCard`，有 before/after 对比
4. 点击"应用" → Editor 侧对应字段实时更新，DiffCard 变为"✓ 已应用"

- [x] **Step 4: 验证流程 B（从零生成）**

1. 不加载简历，输入："帮我生成一份面向高级后端工程师的简历"
2. 确认：Chat 侧出现 `ResumeGeneratedCard`
3. 点击"导入到编辑器" → Editor 侧显示新生成的简历

- [x] **Step 5: 验证流程 C（多 patch 互不干扰）**

1. 加载简历，粘贴 JD，输入："帮我针对这份 JD 优化简历"
2. 确认：多个 `ResumeDiffCard` 依次出现
3. 逐条应用，确认 Editor 每次正确更新，不同条目之间不互相覆盖

- [x] **Step 6: 最终 commit**

```bash
git add -A
git commit -m "chore: end-to-end verified nl-resume-refactor"
```
