# AI 润色功能 — 整体架构

> 最后更新：2026-03-31

## 功能概述

AI 润色是 Resume-Agent 中对简历字段内容进行智能改写的核心功能。用户在编辑简历时，可通过工具栏按钮触发 AI 对当前字段进行润色，支持多轮对话式交互。

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│  前端 (React + TipTap)                                   │
│                                                          │
│  RichEditor (富文本编辑器)                                │
│    ├─ 工具栏 [AI 润色] 按钮                               │
│    └─ PolishChatDialog (对话式润色弹窗)                    │
│         ├─ useTypewriter (打字机效果 hook)                 │
│         ├─ DiffOverlay (对比浮层)                          │
│         └─ api.ts → rewriteResumeStream() (SSE 流式调用)  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  后端 (FastAPI)                                          │
│                                                          │
│  POST /api/resume/rewrite/stream                         │
│    ├─ RewriteRequest { provider, resume, path,           │
│    │                    instruction, locale, history }    │
│    ├─ build_rewrite_prompt() → 字段感知 + 多轮历史拼装     │
│    ├─ call_llm_stream() → LLM 流式调用                    │
│    └─ SSE 流式返回 { content } / [DONE]                   │
│                                                          │
│  POST /api/resume/rewrite (非流式，备用)                   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  LLM 层                                                  │
│                                                          │
│  backend/llm.py → backend/simple.py                      │
│    ├─ deepseek (via DashScope) ← 默认 provider           │
│    ├─ zhipu (ZhipuAI SDK)                                │
│    └─ doubao (火山引擎)                                   │
└──────────────────────────────────────────────────────────┘
```

## 数据流

```
1. 用户点击 [AI 润色]
   → RichEditor 设置 showPolishDialog = true
   → PolishChatDialog 打开，自动发送第一轮润色（instruction 为空）

2. PolishChatDialog 调用 rewriteResumeStream()
   → POST /api/resume/rewrite/stream
   → body: { provider: "deepseek", resume, path, instruction, history: [] }

3. 后端处理
   → parse_path(path) 定位字段值
   → build_rewrite_prompt() 构造 prompt
     - 根据 path 注入字段类型上下文（项目/经历/技能等）
     - 拼入多轮 history（用户指令 + AI 之前的润色结果）
   → call_llm_stream("deepseek", prompt) 流式调用 LLM

4. SSE 流式返回
   → data: {"content": "三年"}  ← 每个 chunk
   → data: {"content": "后端"}
   → data: [DONE]

5. 前端渲染
   → onChunk 回调 → appendContent → useTypewriter 打字机效果
   → onComplete → 更新 message 状态，显示 [查看对比] [应用此版本]
   → 用户点 [应用此版本] → onApply(content) → onChange 更新编辑器
```

## 核心模块

### 后端

| 文件 | 职责 |
|------|------|
| `backend/models.py` | `RewriteRequest` — 请求体定义（provider, resume, path, instruction, locale, history） |
| `backend/prompts.py` | `build_rewrite_prompt()` — 根据 path 注入字段感知上下文，拼装多轮 history |
| `backend/routes/resume.py` | `/resume/rewrite` 和 `/resume/rewrite/stream` — 改写端点 |
| `backend/llm.py` | `call_llm()` / `call_llm_stream()` — 统一 LLM 调用入口 |
| `backend/simple.py` | 各 provider 的具体 API 调用实现 |

### 前端

| 文件 | 职责 |
|------|------|
| `frontend/.../RichEditor/index.tsx` | 富文本编辑器，工具栏包含 [AI 润色] 按钮，触发 PolishChatDialog |
| `frontend/.../PolishChatDialog.tsx` | 对话式润色弹窗 — 消息列表、快捷标签、输入框、对比浮层 |
| `frontend/.../AIPolishDialog.tsx` | 旧版单轮润色弹窗（保留未删，不再引用） |
| `frontend/src/services/api.ts` | `rewriteResumeStream()` — SSE 流式请求 + onComplete 去重 |
| `frontend/src/hooks/useTypewriter.ts` | 打字机效果 hook — 流式文本逐字显示 |

## API 接口

### POST /api/resume/rewrite/stream

流式改写，SSE 格式返回。

**请求体：**
```json
{
  "provider": "deepseek",
  "resume": { "name": "张三", "summary": "..." },
  "path": "summary",
  "instruction": "更专业一些",
  "locale": "zh",
  "history": [
    { "role": "user", "content": "再精简一些" },
    { "role": "assistant", "content": "之前的润色结果..." }
  ]
}
```

**响应（SSE）：**
```
data: {"content": "三年"}
data: {"content": "后端"}
data: {"content": "开发"}
data: [DONE]
```

### POST /api/resume/rewrite

非流式改写，一次性返回结果。

## 多轮对话机制

- 后端 **无状态**，不存储对话上下文
- 前端维护 `history: [{role, content}]` 数组
- 每轮请求把完整 history 透传给后端
- 后端在 prompt 中拼接历史轮次，让 LLM 基于完整上下文继续改写

## 字段类型感知

`build_rewrite_prompt()` 根据 `path` 自动注入不同润色策略：

| path 匹配 | 注入上下文 |
|-----------|---------|
| `projects[n]` | 项目经历，突出技术深度、量化成果，STAR 法则 |
| `experience[n]` / `internship[n]` | 工作经历，突出业务影响和成长轨迹 |
| `skill` / `skillContent` | 专业技能，分类清晰，体现广度和深度 |
| `openSource[n]` | 开源贡献，突出社区影响和技术能力 |

## 快捷标签

PolishChatDialog 根据字段类型动态显示快捷标签，用户点击即发送该指令：

| 字段类型 | 标签 |
|---------|------|
| 项目经历 | 再精简一些 / 加数据量化 / 用动词开头 / 突出技术难点 / 翻译成英文 |
| 工作经历 | 再精简一些 / 加数据量化 / 用动词开头 / 突出业务影响 / 翻译成英文 |
| 技能 | 分类整理 / 补充流行技术 / 更专业 / 翻译成英文 |
| 其他 | 再精简一些 / 更专业 / 更具体 / 翻译成英文 |

## AI Provider 配置

| Provider | 环境变量 | Base URL | 默认模型 | 状态 |
|----------|---------|----------|---------|------|
| deepseek (via DashScope) | `DASHSCOPE_API_KEY` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `deepseek-v3.2` | 正常 |
| zhipu | `ZHIPU_API_KEY` | ZhipuAI SDK | `glm-4.5v` | 余额不足 |
| doubao | `DOUBAO_API_KEY` | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seed-1-6-lite-251015` | 未配置 |

- 默认 provider: `deepseek`（`backend/llm.py:DEFAULT_AI_PROVIDER`）
- 前端 PolishChatDialog 使用 `deepseek`

## 已知问题 & 修复

| 问题 | 修复 | 提交 |
|------|------|------|
| 硬编码 `zhipu` provider，余额不足导致失败 | 改为 `deepseek` | 263bf49 |
| `useTypewriter` initialDelay 后续 chunk 重复触发 | `hasStartedRef` 追踪首 chunk | 263bf49 |
| `rewriteResumeStream` onComplete 双次调用 | `streamCompleted` guard flag | 263bf49 |

## 触发方式

当前仅支持 **整字段润色**（通过工具栏按钮）。用户选中编辑器内容后无法对局部进行改写。

> 划词修改（Selection Polish）设计见 `2026-03-31-selection-polish-design.md`
