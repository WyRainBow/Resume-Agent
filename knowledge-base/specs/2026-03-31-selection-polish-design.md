# 划词修改（Selection Polish）— 设计方案

> 日期：2026-03-31
> 状态：设计中

## 背景

当前 AI 润色功能（PolishChatDialog）是 **整字段级别** 的：用户点击工具栏 [AI 润色] 按钮，整个字段内容发给 AI 改写。

实际使用场景中，用户经常只想修改 **其中一句话或一段话**，而非整个字段。需要支持 **划词修改**（选中文本 → AI 改写选中部分 → 替换回选区）。

## 设计目标

- **轻量**：浮出气泡，3 步完成（选中 → 选操作 → AI 改写替换）
- **单次改写**：不需要多轮对话，用户意图清晰，一次搞定
- **与 PolishChatDialog 互补**：整字段大幅调整用大弹窗，局部微调用气泡

## 交互设计

### 触发方式

用户在 RichEditor 中选中一段文字（一句话/一段话）后，在选区附近弹出浮动气泡（Bubble Menu）。

### UI 结构

```
    ┌─ 选中的文字 ────────────────────────────┐
    │  独立开发了用户管理模块，提升了开发效率    │
    └─────────────────────────────────────────┘
         ┌──────────────────────────────────┐
         │ ✨ 改写  精简  更专业  翻译  ▼更多 │  ← 浮出气泡
         └──────────────────────────────────┘
```

**展开"更多"后：**

```
         ┌──────────────────────────────────┐
         │ ✨ 改写  精简  更专业  翻译        │
         │ ┌──────────────────────────────┐ │
         │ │ 💬 输入自定义指令...     [发送] │ │
         │ └──────────────────────────────┘ │
         └──────────────────────────────────┘
```

### 核心流程

```
1. 用户选中文本 → TipTap selection 变化
2. 检测选区非空 → 在选区上方/下方显示气泡
3. 用户点击气泡中的操作（如"精简"）
4. 调用后端 rewrite/stream 接口，只传选中文本
5. AI 流式返回改写结果
6. 气泡内显示加载 → 完成后自动替换选区内容
```

### 交互细节

| 场景 | 行为 |
|------|------|
| 选区为空 | 不显示气泡 |
| 选区变化 | 气泡跟随移动 |
| 点击气泡外 | 关闭气泡 |
| AI 正在改写 | 气泡显示 loading，禁用按钮 |
| 改写完成 | 自动替换选区文本，关闭气泡 |
| 改写失败 | 气泡显示错误提示，保留原文 |
| 按 Esc | 取消请求，关闭气泡 |

## 技术方案

### 前端

#### 1. 使用 TipTap BubbleMenu 扩展

TipTap 内置 `@tiptap/extension-bubble-menu`，可在选区附近自动浮出 UI。

```tsx
// RichEditor 中新增
import BubbleMenu from '@tiptap/extension-bubble-menu'

// 或使用 React 组件形式
import { BubbleMenu } from '@tiptap/react'

<BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
  <SelectionPolishBubble
    editor={editor}
    onPolish={(selectedText, instruction) => { ... }}
  />
</BubbleMenu>
```

#### 2. 新增 SelectionPolishBubble 组件

轻量级气泡组件，职责：
- 显示预设快捷按钮
- 展开自定义输入框
- 调用 AI 改写
- 流式加载状态

#### 3. 复用现有 API

复用 `rewriteResumeStream()`，但只传选中文本作为原始内容：
- `path` 传一个标记如 `selection` 或仍传原 path（用于字段感知上下文）
- `instruction` 传用户选择的操作（"精简"/"更专业"等）
- `history` 为空（单次改写不需要多轮）

### 后端

**无需改动。** 现有 `/resume/rewrite/stream` 接口已支持：
- 传入 `instruction` 作为改写指令
- 原值可以是任意字符串（选中文本）
- 流式返回改写结果

唯一考虑：可以新增一个轻量端点 `/api/resume/rewrite-selection/stream`，不要求传完整 resume，只传选中文本 + 指令。但这不是必须的，复用现有接口即可。

### 数据流

```
用户选中文本 "独立开发了用户管理模块"
  → 点击 [精简]
  → POST /api/resume/rewrite/stream
    {
      provider: "deepseek",
      resume: resumeData,
      path: polishPath,        // 保留，用于字段感知
      instruction: "请精简以下文本",
      history: []
    }
  → 后端 build_rewrite_prompt() 构造 prompt
    （此时 original_value 就是选中的那段文字）
  → SSE 流式返回改写结果
  → 前端收到完整结果 → editor.chain().focus()
      .deleteSelection()
      .insertContent(polishedText)
      .run()
```

## 组件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `SelectionPolishBubble.tsx` | 新建 | 划词修改气泡组件 |
| `RichEditor/index.tsx` | 修改 | 引入 BubbleMenu + SelectionPolishBubble |

### SelectionPolishBubble 接口

```tsx
interface SelectionPolishBubbleProps {
  editor: Editor                // TipTap editor 实例
  resumeData: ResumeData        // 简历数据（用于 API 调用）
  polishPath: string            // 字段路径（用于字段感知上下文）
}
```

### 快捷操作列表

| 按钮 | 实际 instruction |
|------|-----------------|
| 改写 | ""（使用默认润色指令） |
| 精简 | "请精简这段文本，去除冗余表述" |
| 更专业 | "请用更专业的表述改写" |
| 翻译 | "请翻译成英文" |

## 与 PolishChatDialog 的对比

| | PolishChatDialog | SelectionPolishBubble |
|---|---|---|
| 触发 | 工具栏 [AI 润色] 按钮 | 选中文本后自动浮出 |
| 范围 | 整个字段 | 选中的文字 |
| 多轮 | 支持多轮对话 | 单次改写 |
| UI | 全屏弹窗 | 小气泡 |
| 适用场景 | 大幅重写、反复调整 | 局部微调、快速优化 |

## 开放问题

- [ ] 是否需要 Undo 能力？（TipTap 本身支持撤销，应该够用）
- [ ] 改写失败时是否需要显示 diff？（当前设计直接替换，可能不需要）
- [ ] 是否限制最短选区长度？（如至少选 5 个字符才显示气泡）
