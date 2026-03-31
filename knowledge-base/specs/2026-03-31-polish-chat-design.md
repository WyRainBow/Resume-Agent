# AI 润色对话式重构 — 实现方案

> 日期：2026-03-31
> 分支：feature/03-31/01
> 状态：已实现

## 概述

将 AI 润色从单向输出（AIPolishDialog）重构为 ChatGPT 风格的对话式交互（PolishChatDialog）。

## 设计决策

- **对话式 UI**：ChatGPT 风格， 每轮润色结果独立可操作（应用/对比）
- **多轮上下文**：后端 stateless， 前端维护 history 数组， 每次请求透传
- **字段感知**：根据 path 自动注入不同润色策略（项目经历/工作经历/技能等）
- **快捷标签**：根据字段类型动态显示常用指令

## 改动文件

### 后端

| 文件 | 改动 |
|------|------|
| `backend/models.py` | RewriteRequest 新增 `history: list[dict]` 字段 |
| `backend/prompts.py` | `build_rewrite_prompt` 支持 history 多轮上下文 + 字段类型感知上下文注入 |
| `backend/routes/resume.py` | 流式/非流式端点透传 `body.history` |

### 前端

| 文件 | 改动 |
|------|------|
| `frontend/.../shared/PolishChatDialog.tsx` | **新建** — 对话式润色组件 |
| `frontend/.../shared/AIPolishDialog.tsx` | 保留不删， 不再被引用 |
| `frontend/.../shared/RichEditor/index.tsx` | import 改为 PolishChatDialog |
| `frontend/src/services/api.ts` | `rewriteResumeStream` 增加 `history` 参数 |

## 组件结构 (PolishChatDialog)

```
┌──────────────────────────────────────┐
│  ✨ AI 润色助手 — {字段标签}  [✕]  │  header
├──────────────────────────────────────┤
│                                      │
│  📄 原始内容 (引用卡片，只读)               │
│                                      │
│  🤖 润色结果 (流式 HTML + 打字机)              │
│     [查看对比] [✓ 应用此版本]                   │
│                                      │
│  👤 {用户追加指令文本}                     │  ← 右对齐
│                                      │
│  🤖 已根据你的要求修改：                   │  ← 左对齐
│     [查看对比] [✓ 应用此版本]                   │
│                                      │
├──────────────────────────────────────┤
│  [再精简] [加数据量化] [动词开头]  ...     │  ← 快捷标签
│  💬 输入指令...                    [发送]  │  ← 输入框
├──────────────────────────────────────┤
```

### 核心交互流程

1. 打开弹窗 → 自动发送第一轮润色（instruction 为空，使用默认润色指令）
2. AI 流式返回润色结果（打字机效果）
3. 用户可通过快捷标签或输入框追加指令
4. 每轮结果可独立"应用此版本"写回编辑器， 或"查看对比"弹 diff 浮层
5. 多轮 history 透传后端， AI 基于完整上下文继续修改

### 字段类型感知 Prompt

| path 匹配 | 注入上下文 |
|-----------|---------|
| `projects[n]` | 项目经历， 綊出技术深度、量化成果, STAR 法则 |
| `experience[n]` | 工作经历」 癊出业务影响和成长轨迹 |
| `skillContent` | 专业技能」 分类清晰, 体现广度和深度 |
| `openSource[n]` | 开源贡献」 把出社区影响和技术能力 |

### 快捷标签

| 字段类型 | 标签 |
|---------|------|
| 项目经历 | 再精简一些、加数据量化/用动词开头/突出技术难点/翻译成英文 |
| 工作经历 | 再精简一些/加数据量化/用动词开头/突出业务影响/翻译成英文 |
| 技能 | 分类整理/补充流行技术/更专业/翻译成英文 |
| 其他 | 再精简一些/更专业/更具体/翻译成英文 |

## 已知问题 & 修复

| 问题 | 修复 | 提交 |
|------|------|------|
| 硬编码 `zhipu` provider，zhipu 余额不足导致润色失败 | 改为 `deepseek`（与后端 `DEFAULT_AI_PROVIDER` 一致） | 263bf49 |
| `useTypewriter` initialDelay 在后续 chunk 重新触发 | 增加 `hasStartedRef` 追踪首 chunk，后续 chunk 不再 delay | 263bf49 |
| `rewriteResumeStream` onComplete 被调用两次（`[DONE]` + fallback） | 增加 `streamCompleted` guard flag | 263bf49 |

## AI Provider 配置

| Provider | 环境变量 | Base URL | 默认模型 | 当前状态 |
|----------|---------|----------|---------|---------|
| deepseek (via DashScope) | `DASHSCOPE_API_KEY` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `deepseek-v3.2` | 正常 |
| zhipu | `ZHIPU_API_KEY` | ZhipuAI SDK | `glm-4.5v` | 余额不足 |
| doubao | `DOUBAO_API_KEY` | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seed-1-6-lite-251015` | 未配置 Key |

- 默认 provider: `deepseek`（定义在 `backend/llm.py:DEFAULT_AI_PROVIDER`）
- DashScope 不支持 Gemini 模型（仅支持千问、DeepSeek 等）
- 前端 PolishChatDialog 使用 `deepseek` provider 调用润色接口

## 复用的组件

- `useTypewriter` hook — 打字机流式效果
- `DiffOverlay` — 内联对比浮层
- `cn()` — 条件样式合并
