# Workbench 复刻方案 v2

> 参考项目：[magic-resume](https://github.com/JOYCEQL/magic-resume)
> 在线体验：https://magicv.art/app/workbench/
> 本地参考代码：`magic-resume-reference/`（已加入 .gitignore）

---

## 当前实现进度 ✅

### 已完成
- [x] v2 目录结构创建 (`frontend/src/pages/Workspace/v2/`)
- [x] 三列布局实现（可拖拽分隔线）
  - 第一列：SidePanel（350px，可拖拽 250-500px）
  - 第二列：EditPanel（550px，可拖拽 400-700px）
  - 第三列：PreviewPanel（剩余空间）
- [x] SidePanel 组件
  - 布局管理（模块列表拖拽排序）
  - 排版设置（行高、字号）
  - 间距设置（页边距、模块间距、段落间距）
  - 隐藏模块时显示淡透明效果（不再显示被划掉的眼睛图标）
- [x] EditPanel 组件
  - 基本信息编辑（BasicPanel）
  - 项目经历编辑（ProjectPanel + ProjectItem）
  - 工作经验编辑（ExperiencePanel）
  - 教育经历编辑（EducationPanel）
  - 专业技能编辑（SkillPanel）
  - 各模块切换显示
- [x] PreviewPanel 组件
  - PDF 预览区域
  - 渲染按钮、下载按钮
  - 缩放控制
- [x] TipTap 富文本编辑器（RichEditor）
  - 加粗、斜体、下划线
  - 对齐方式（左/中/右/两端）
  - 无序列表、有序列表
  - 撤销/重做
  - AI 润色按钮预留
- [x] AI 导入功能（全局导入 + 分模块导入）
- [x] 临时路由 `/workspace-v2`
- [x] 后端 `html_to_latex.py` 转换函数
  - HTML → LaTeX 转换
  - 支持加粗、斜体、下划线、列表
  - LaTeX 特殊字符转义

### 待完成
- [ ] 替换旧版 workspace（将 `/workspace-v2` 改为 `/workspace`）

---

## 数据流程详解

### 完整渲染流程

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           完整数据流程                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 用户输入                                                              │
│     ├─ 方式A: 手动填写表单（文字）                                         │
│     └─ 方式B: AI 全局导入（粘贴纯文本 → AI 解析）                          │
│                    ↓                                                     │
│  2. TipTap 富文本编辑器                                                   │
│     用户可使用工具栏：加粗、斜体、列表等                                    │
│     输出格式：HTML（如 <p><strong>React</strong> 开发</p>）                │
│                    ↓                                                     │
│  3. 前端 JSON 数据结构                                                    │
│     {                                                                    │
│       "contact": { "name": "张三", "phone": "138..." },                  │
│       "projects": [{                                                     │
│         "title": "智能简历系统",                                          │
│         "highlights": ["<p><strong>React</strong> 开发</p>"]  ← HTML格式  │
│       }]                                                                 │
│     }                                                                    │
│                    ↓                                                     │
│  4. 用户点击「渲染 PDF」按钮                                               │
│                    ↓                                                     │
│  5. 后端 API: /api/pdf/render/stream                                     │
│     ├─ json_to_latex(): 将 JSON 转换为 LaTeX 代码                        │
│     │   └─ 内部调用 html_to_latex(): 将 HTML 转换为 LaTeX                │
│     │      <strong>React</strong> → \textbf{React}                       │
│     │      <ul><li>xxx</li></ul> → \begin{itemize}\item xxx\end{itemize} │
│     └─ 生成完整 .tex 文件                                                 │
│                    ↓                                                     │
│  6. xelatex 编译（使用 LATEX-slager 模板）                                │
│     xelatex -interaction=nonstopmode resume.tex                          │
│                    ↓                                                     │
│  7. 输出 PDF 文件 ✅                                                      │
│                    ↓                                                     │
│  8. 前端显示 PDF 预览                                                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 流程总结

| 阶段 | 数据格式 | 说明 |
|------|----------|------|
| 用户输入 | 纯文本 | 手动填写或 AI 导入 |
| 编辑器存储 | JSON + HTML | TipTap 输出 HTML 富文本 |
| 后端转换 | LaTeX (.tex) | html_to_latex() 转换 |
| 编译输出 | PDF | xelatex 真实编译 |

**简化表示：文字 → JSON(含HTML) → LaTeX → PDF**

---

## 一、核心理解

### 1.1 magic-resume 的数据格式

**第二列编辑面板使用的是 HTML 富文本格式（TipTap 编辑器输出）**

```typescript
// magic-resume 的 Project 数据结构
interface Project {
  id: string
  name: string
  role: string
  date: string
  description: string  // ⭐ 这是 HTML 格式，如 "<p>设计实现<strong>多维度</strong>权限管理...</p>"
  visible: boolean
  link?: string
}
```

magic-resume 直接将 HTML 渲染到页面上（前端渲染），**不涉及 LaTeX**。

### 1.2 我们的渲染流程（优化后）

```
┌─────────────────────────────────────────────────────────────────┐
│                        优化后的渲染流程                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   用户编辑（TipTap 富文本）                                       │
│        ↓                                                        │
│   HTML 格式直接存入 JSON                                         │
│   { description: "<p>设计<strong>多维度</strong>...</p>" }       │
│        ↓                                                        │
│   用户点击「渲染」按钮                                            │
│        ↓                                                        │
│   后端 json_to_latex() 内部调用 html_to_latex()                  │
│        ↓                                                        │
│   LaTeX 代码                                                     │
│        ↓                                                        │
│   xelatex 编译 (LATEX-slager 模板)                               │
│        ↓                                                        │
│   PDF 文件 ✅                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**关键点：**
1. **前端直接存 HTML**，不做转换
2. **后端统一处理** HTML → LaTeX 转换
3. **用户手动点击按钮触发渲染**，不自动渲染
4. **⚠️ 硬性约束：最终输出必须是 LaTeX 渲染的 PDF，不可改变！**

### 1.3 两者对比

| 对比项 | magic-resume | 我们的项目 |
|--------|-------------|-----------|
| 第二列数据格式 | HTML（TipTap 输出） | **HTML（TipTap 输出）** |
| 第三列渲染 | 前端 HTML 直接渲染 | **后端 LaTeX → PDF** |
| 富文本支持 | 加粗、斜体、列表等 | 加粗、斜体、列表等（后端转 LaTeX） |
| 最终输出 | HTML 页面 / 前端 PDF 导出 | **真正的 PDF 文件** |

---

## 二、数据流设计（简化版）

### 2.1 编辑器输入 → PDF 输出

```
┌────────────────────────────────────────────────────────────────────┐
│                     简化后的数据流                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  第二列编辑面板（TipTap 富文本）                                      │
│  ┌──────────────────────────────────────┐                          │
│  │  项目名称: [快手黑白名单]              │                          │
│  │  项目角色: [负责内容]                  │                          │
│  │  项目时间: [2023.01 - 2023.06]        │                          │
│  │  项目描述:                            │                          │
│  │  ┌────────────────────────────────┐  │                          │
│  │  │ 工具栏: [B] [I] [U] [•] [1.]   │  │  ← TipTap 富文本编辑器    │
│  │  │                                │  │                          │
│  │  │ 设计实现**多维度**权限管理...   │  │  ← 用户输入（支持格式）    │
│  │  └────────────────────────────────┘  │                          │
│  └──────────────────────────────────────┘                          │
│                    ↓                                               │
│         直接存入 JSON（HTML 格式）                                   │
│  { description: "<p>设计<strong>多维度</strong>权限管理...</p>" }    │
│                    ↓                                               │
│           用户点击「渲染」按钮                                        │
│                    ↓                                               │
│     后端 json_to_latex() 内部转换 HTML → LaTeX                       │
│                    ↓                                               │
│            xelatex 编译                                             │
│                    ↓                                               │
│              PDF 输出 ✅                                            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**核心简化：前端不做转换，HTML 直接存 JSON，后端统一处理转换**

### 2.2 后端 HTML → LaTeX 转换规则

| HTML 格式 | LaTeX 格式 |
|-----------|-----------|
| `<strong>文字</strong>` | `\textbf{文字}` |
| `<em>文字</em>` | `\textit{文字}` |
| `<u>文字</u>` | `\underline{文字}` |
| `<ul><li>项目</li></ul>` | `\begin{itemize}\item 项目\end{itemize}` |
| `<ol><li>项目</li></ol>` | `\begin{enumerate}\item 项目\end{enumerate}` |
| `<p>段落</p>` | `段落\n` |
| `<br>` | `\\` |

---

## 三、整体架构

### 3.1 三列布局

```
┌─────────────┬─────────────────────────┬─────────────────────────┐
│   第一列    │        第二列           │        第三列           │
│   SidePanel │       EditPanel         │      PreviewPanel       │
│   (20%)     │        (32%)            │        (48%)            │
├─────────────┼─────────────────────────┼─────────────────────────┤
│  布局管理   │  可视化编辑区域         │   PDF 预览              │
│  - 模块列表 │  - 根据选中模块动态渲染 │   - LaTeX → PDF 渲染    │
│  - 拖拽排序 │  - TipTap 富文本工具栏  │   - 缩放/导出控制       │
│  - 显示隐藏 │  - AI 导入按钮          │   - 用户点击渲染        │
│             │  - 直接存 HTML 到 JSON  │                         │
│ ❌不要主题色 │                         │   ✅ 必须是 LaTeX PDF   │
└─────────────┴─────────────────────────┴─────────────────────────┘
```

### 3.2 核心交互逻辑

1. **第一列点击模块** → 第二列切换到对应编辑面板
2. **第二列编辑内容** → HTML 格式直接存入 JSON（前端不转换）
3. **用户点击渲染按钮** → JSON 发送后端 → json_to_latex()（内部转换 HTML→LaTeX）→ xelatex → PDF
4. **第三列显示** → 真正的 PDF 文件

---

## 四、第一列：SidePanel（布局管理）

### 4.1 功能清单

| 功能 | 是否实现 | 说明 |
|------|---------|------|
| 布局模块列表 | ✅ 需要 | 基本信息、专业技能、工作经验、项目经历、教育经历 |
| 模块拖拽排序 | ✅ 需要 | 使用 framer-motion 的 Reorder |
| 模块显示/隐藏 | ✅ 需要 | Eye/EyeOff 图标切换 |
| 模块删除 | ✅ 需要 | 自定义模块可删除 |
| 添加自定义模块 | ✅ 需要 | 用户可新增模块 |
| **主题色选择** | ❌ **不需要** | 用户明确要求不需要 |
| 排版设置 | ⚠️ 可选 | 行高、字号等（后期可加） |

### 4.2 直接复用 magic-resume 代码

从 `magic-resume-reference/src/components/editor/` 复制：
- `layout/LayoutSetting.tsx`
- `layout/LayoutItem.tsx`
- `SidePanel.tsx`（删除主题色部分）

---

## 五、第二列：EditPanel（可视化编辑）

### 5.1 核心设计

**直接复用 magic-resume 的编辑面板，前端不做格式转换**

```typescript
// magic-resume 的数据流
用户编辑 → TipTap HTML → 直接渲染到页面

// 我们的数据流（简化）
用户编辑 → TipTap HTML → 直接存 JSON → 用户点击渲染 → 后端转换 → LaTeX → PDF
```

### 5.2 各面板功能

从 `magic-resume-reference/src/components/editor/` 复制：
- `basic/BasicPanel.tsx`
- `project/ProjectPanel.tsx`
- `project/ProjectItem.tsx`
- `experience/ExperiencePanel.tsx`
- `experience/ExperienceItem.tsx`
- `education/EducationPanel.tsx`
- `education/EducationItem.tsx`
- `skills/SkillPanel.tsx`
- `custom/CustomPanel.tsx`
- `custom/CustomItem.tsx`
- `Field.tsx`
- `IconSelector.tsx`

### 5.3 RichEditor 组件

从 `magic-resume-reference/src/components/shared/rich-editor/` 复制：
- `RichEditor.tsx`
- `BetterSpace.ts`

**无需修改**：直接输出 HTML，存入 JSON

---

## 六、AI 导入功能

### 6.1 保持不变

AI 导入功能的核心逻辑不变：
- 用户输入纯文字描述
- AI 解析并结构化
- 填充到对应模块的字段中

### 6.2 集成位置

每个编辑面板（ProjectPanel、ExperiencePanel 等）都有一个 AI 导入按钮：

```typescript
// 在 ProjectPanel 中
<Button onClick={handleAIImport}>
  <Wand2 className="w-4 h-4 mr-2" />
  AI 导入
</Button>
```

### 6.3 AI 导入流程

```
用户点击 AI 导入 → 弹窗输入纯文字 → AI 解析 → 填充到表单字段（填充到字段就行，用户点击按钮去渲染）
                                              
                                      
```

**注意：AI 导入的是纯文字，不涉及格式。格式由用户在编辑器中手动添加。**

---

## 七、数据结构对比

### 7.1 magic-resume 的数据结构

```typescript
interface Project {
  id: string
  name: string
  role: string
  date: string
  description: string  // HTML 格式
  visible: boolean
  link?: string
}
```

### 7.2 我们的数据结构（调整为存 HTML）

```typescript
interface Project {
  title: string
  subtitle?: string    // 角色
  date?: string
  description?: string // ⭐ HTML 格式，后端转换为 LaTeX
  items?: ProjectItem[]
  highlights?: string[]
}
```

### 7.3 字段映射

| magic-resume | 我们的字段 | 说明 |
|--------------|-----------|------|
| name | title | 项目名称 |
| role | subtitle | 角色 |
| date | date | 时间 |
| description | highlights[] | 描述（需转换格式） |
| link | - | 链接（可选添加） |

---

## 八、组件目录结构

```
frontend/src/pages/Workspace/
├── index.tsx                    # 主页面（三列布局）
├── components/
│   ├── SidePanel/              # 第一列（复制 magic-resume）
│   │   ├── index.tsx
│   │   ├── LayoutSetting.tsx
│   │   └── LayoutItem.tsx
│   ├── EditPanel/              # 第二列（复制 magic-resume）
│   │   ├── index.tsx
│   │   ├── BasicPanel.tsx
│   │   ├── ProjectPanel.tsx
│   │   ├── ProjectItem.tsx
│   │   ├── ExperiencePanel.tsx
│   │   ├── ExperienceItem.tsx
│   │   ├── EducationPanel.tsx
│   │   ├── EducationItem.tsx
│   │   ├── SkillPanel.tsx
│   │   ├── CustomPanel.tsx
│   │   ├── Field.tsx
│   │   └── IconSelector.tsx
│   ├── PreviewPanel/           # 第三列（保持现有 PDF 渲染）
│   │   └── index.tsx
│   └── shared/
│       ├── RichEditor/         # 富文本编辑器（复制 magic-resume）
│       │   ├── index.tsx
│       │   └── BetterSpace.ts
│       └── AIImportModal.tsx   # AI 导入弹窗（保持现有）
├── hooks/
│   └── useWorkspaceStore.ts    # 状态管理
└── types/
    └── index.ts

# 后端新增
backend/
└── html_to_latex.py            # ⭐ 新增：HTML → LaTeX 转换（后端处理）
```

---

## 九、实现步骤

### Phase 1：复制 magic-resume 组件（1-2天）

1. [ ] 复制 SidePanel 相关组件，删除主题色部分
2. [ ] 复制 EditPanel 相关组件
3. [ ] 复制 RichEditor 组件
4. [ ] 安装 TipTap 依赖

### Phase 2：适配数据结构 + 后端转换（2-3天）

5. [ ] 后端创建 `html_to_latex.py` 转换函数
6. [ ] 修改 `json_to_latex()` 调用 HTML 转换
7. [ ] 适配字段映射（magic-resume → 我们的 Resume 类型）
8. [ ] 连接到现有的 PDF 渲染逻辑

### Phase 3：集成 AI 导入（1天）

9. [ ] 在各编辑面板添加 AI 导入按钮
10. [ ] 复用现有 AIImportModal 组件

### Phase 4：三列布局（1天）

11. [ ] 搭建三列布局（ResizablePanel）
12. [ ] 连接第一列点击 → 第二列切换
13. [ ] 连接第二列编辑 → 第三列渲染

### Phase 5：优化（1-2天）

14. [ ] 样式调整
15. [ ] 动画效果
16. [ ] 防抖优化

---

## 十、技术依赖

```bash
# TipTap 富文本编辑器
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-text-align @tiptap/extension-underline @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-highlight

# 可调整面板
npm install react-resizable-panels

# 动画（已有）
# framer-motion

# 状态管理（已有）
# zustand
```

---

## 十一、总结

### 核心要点

1. **第一列**：直接复制 magic-resume，删除主题色
2. **第二列**：直接复制 magic-resume 的编辑面板和 RichEditor
3. **第三列**：**保持现有 LaTeX → PDF 渲染，不能改变！**
4. **数据存储**：前端直接存 HTML 到 JSON，**后端统一转换** HTML → LaTeX
5. **AI 导入**：只导入纯文字到表单字段，**不自动渲染**，用户手动点击渲染按钮

### 与 magic-resume 的区别

| 对比项 | magic-resume | 我们 |
|--------|-------------|------|
| 渲染方式 | 前端 HTML | **后端 LaTeX → PDF** |
| 数据存储 | HTML 格式 | **HTML 格式**（后端转 LaTeX） |
| 转换位置 | 无需转换 | **后端统一转换** |
| PDF 质量 | 前端生成（质量一般） | **xelatex 编译（专业排版）** |
| 中文支持 | 依赖浏览器 | **Adobe 字体 + xelatex** |

我们的优势是 **真正的 LaTeX PDF 输出**，这是专业简历的标准！

---

## 十二、现有 Workspace 代码处理方案

### 12.1 现有代码结构分析

```
frontend/src/pages/Workspace/
├── index.tsx                    # 主页面（819行，需要重写）
├── components/
│   ├── AIOutputView.tsx         # ⚠️ 评估是否保留
│   ├── BackgroundDecoration.tsx # ✅ 保留（背景装饰）
│   ├── Divider.tsx              # ✅ 保留（分隔线）
│   ├── LoadingOverlay.tsx       # ✅ 保留（加载遮罩）
│   ├── NavHeader.tsx            # ✅ 保留（导航头部）
│   ├── PreviewToolbar.tsx       # ✅ 保留（PDF 预览工具栏）
│   ├── Toolbar.tsx              # ❌ 删除（工具栏移到 RichEditor 内）
│   ├── ZoomControl.tsx          # ✅ 保留（缩放控制）
│   └── index.ts                 # 需要更新导出
├── hooks/
│   ├── usePanelResize.ts        # ✅ 保留（面板拖拽）
│   ├── usePDFOperations.ts      # ✅ 保留（PDF 操作）
│   ├── useResumeOperations.ts   # ⚠️ 需要适配新数据结构
│   ├── useWorkspaceState.ts     # ⚠️ 需要适配新状态
│   └── index.ts                 # 需要更新导出

frontend/src/components/ResumeEditor/
├── index.tsx                    # ❌ 删除（用 EditPanel 替代）
├── AIImportModal.tsx            # ✅ 保留，移动到 shared/
├── SectionEditor.tsx            # ❌ 删除（用各 Panel 替代）
├── SortableSection.tsx          # ❌ 删除（用 LayoutItem 替代）
├── DateRangePicker.tsx          # ✅ 保留（日期选择器）
├── YearMonthPicker.tsx          # ✅ 保留（年月选择器）
├── constants.ts                 # ⚠️ 评估是否合并
└── types.ts                     # ⚠️ 评估是否合并到全局 types
```

### 12.2 处理策略

#### 策略一：渐进式重构（推荐）

```
步骤 1：保留现有代码，新建并行结构
├── Workspace/
│   ├── index.tsx           # 现有代码（暂时保留）
│   └── v2/                 # 新版本目录
│       ├── index.tsx       # 新的三列布局
│       ├── SidePanel/
│       ├── EditPanel/
│       └── PreviewPanel/

步骤 2：路由切换测试
- /workspace      → 旧版本
- /workspace-v2   → 新版本（测试）

步骤 3：验证完成后替换
- 删除旧 index.tsx
- 将 v2/ 内容移到上级
- 更新路由
```

#### 策略二：直接替换（快速但风险高）

```
步骤 1：备份现有代码
git stash 或 创建备份分支

步骤 2：直接重写 index.tsx
- 删除旧代码
- 写入新的三列布局

步骤 3：逐步迁移组件
- 复制 magic-resume 组件
- 适配数据结构
- 删除不需要的旧组件
```

### 12.3 具体执行计划

**采用策略一（渐进式重构）：**

```bash
# 1. 创建新版本目录 ✅ 已完成
mkdir -p frontend/src/pages/Workspace/v2
mkdir -p frontend/src/pages/Workspace/v2/SidePanel
mkdir -p frontend/src/pages/Workspace/v2/EditPanel
mkdir -p frontend/src/pages/Workspace/v2/PreviewPanel
mkdir -p frontend/src/pages/Workspace/v2/shared

# 2. 复制 magic-resume 组件到新目录 ✅ 已完成
# （从 magic-resume-reference 复制并适配）

# 3. 创建新的入口文件 ✅ 已完成
# frontend/src/pages/Workspace/v2/index.tsx

# 4. 添加临时路由用于测试 ✅ 已完成
# /workspace-v2 → 新版本

# 5. 测试通过后，替换旧版本 ⏳ 待完成
```

**已完成的文件：**

```
frontend/src/pages/Workspace/v2/
├── index.tsx                 # ✅ 三列布局主入口
├── types/
│   └── index.ts              # ✅ 类型定义
├── SidePanel/
│   ├── index.tsx             # ✅ 侧边面板
│   ├── LayoutItem.tsx        # ✅ 布局项组件
│   └── LayoutSetting.tsx     # ✅ 布局设置组件
├── EditPanel/
│   ├── index.tsx             # ✅ 编辑面板主组件
│   ├── Field.tsx             # ✅ 通用字段组件
│   ├── BasicPanel.tsx        # ✅ 基本信息面板
│   ├── SkillPanel.tsx        # ✅ 技能面板
│   ├── ProjectItem.tsx       # ✅ 项目条目组件
│   ├── ProjectPanel.tsx      # ✅ 项目经历面板
│   ├── ExperienceItem.tsx    # ✅ 工作经历条目
│   ├── ExperiencePanel.tsx   # ✅ 工作经历面板
│   └── EducationPanel.tsx    # ✅ 教育经历面板
├── PreviewPanel/
│   └── index.tsx             # ✅ PDF 预览面板
└── shared/
    └── RichEditor/
        ├── index.tsx         # ✅ TipTap 富文本编辑器
        └── BetterSpace.ts    # ✅ 空格处理扩展
```

**临时测试路由：** http://localhost:5173/workspace-v2

### 12.4 保留 & 复用的现有代码

| 文件 | 处理方式 | 说明 |
|------|---------|------|
| `BackgroundDecoration.tsx` | ✅ 直接复用 | 背景装饰效果 |
| `LoadingOverlay.tsx` | ✅ 直接复用 | 加载状态 |
| `NavHeader.tsx` | ✅ 直接复用 | 顶部导航 |
| `PreviewToolbar.tsx` | ✅ 移到 PreviewPanel | PDF 工具栏 |
| `ZoomControl.tsx` | ✅ 移到 PreviewPanel | 缩放控制 |
| `Divider.tsx` | ✅ 直接复用 | 分隔线 |
| `usePanelResize.ts` | ✅ 直接复用 | 面板拖拽 |
| `usePDFOperations.ts` | ✅ 直接复用 | PDF 渲染逻辑 |
| `AIImportModal.tsx` | ✅ 移到 shared/ | AI 导入弹窗 |
| `DateRangePicker.tsx` | ✅ 移到 shared/ | 日期选择 |
| `YearMonthPicker.tsx` | ✅ 移到 shared/ | 年月选择 |

### 12.5 需要删除的代码

| 文件 | 原因 |
|------|------|
| `Toolbar.tsx` | 工具栏功能移到 RichEditor 内嵌 |
| `ResumeEditor/index.tsx` | 用 EditPanel 替代 |
| `ResumeEditor/SectionEditor.tsx` | 用各 Panel 替代 |
| `ResumeEditor/SortableSection.tsx` | 用 LayoutItem 替代 |
| `AIOutputView.tsx` | 评估后决定（可能不需要） |

### 12.6 Hooks 适配

```typescript
// useWorkspaceState.ts 需要新增的状态
interface WorkspaceState {
  // 现有状态保留...
  
  // 新增状态
  activeSection: string           // 当前选中的模块 ID
  menuSections: MenuSection[]     // 模块列表配置
}

// useResumeOperations.ts 需要适配
// - 数据结构从旧 Resume 类型适配到新的 HTML 存储格式
```

---

## 十三、清理冗余代码

### 13.1 需要删除的组件/文件

在实现新 Workbench 过程中，以下现有代码需要删除：

```
frontend/src/
├── components/
│   └── ResumeEditor/           # ❌ 删除整个目录（用 magic-resume 的 EditPanel 替代）
│       ├── index.tsx
│       ├── AIImportModal.tsx   # ⚠️ 保留，移动到新位置
│       └── types.ts
├── pages/Workspace/
│   └── components/
│       ├── Toolbar.tsx         # ❌ 删除（工具栏内嵌到 RichEditor）
│       └── PreviewToolbar.tsx  # ⚠️ 保留或合并到 PreviewPanel
```

### 13.2 保留的核心逻辑

```
frontend/src/
├── services/
│   └── api.ts                  # ✅ 保留（PDF 渲染 API 调用）
├── types/
│   └── resume.ts               # ✅ 保留（Resume 类型定义，可能需要调整）

backend/
├── latex_generator.py          # ✅ 保留（json_to_latex）
├── latex_sections.py           # ✅ 保留（各 section 生成）
├── latex_compiler.py           # ✅ 保留（xelatex 编译）
├── routes/pdf.py               # ✅ 保留（PDF 渲染 API）
└── html_to_latex.py            # ⭐ 新增（HTML → LaTeX 转换）
```

### 13.3 清理原则

1. **直接删除**：用不到的组件、冗余代码
2. **合并/移动**：有用但位置不对的代码
3. **保留**：核心渲染逻辑、API 调用、类型定义

---

## 十三、硬性约束

⚠️ **以下约束不可违反：**

1. **最终输出必须是 LaTeX 渲染的 PDF**
   - 不能改用前端渲染
   - 不能改用其他 PDF 生成方式
   - 必须使用 xelatex + LATEX-slager 模板

2. **后端转换**
   - HTML → LaTeX 转换必须在后端完成
   - 前端只负责存储 HTML 格式

3. **用户触发渲染**
   - 不自动渲染
   - 用户点击按钮手动触发

---

## 十四、未来拓展计划

### 14.1 当前策略：先复刻，再优化

**阶段一：功能复刻（当前）**
- 直接复制 magic-resume 组件，快速实现功能
- 优先保证功能可用

**阶段二：风格融合**
- 逐步替换为我们自己的 UI 风格
- 保留现有项目的设计元素（颜色、动画等）
- 避免完全照搬，形成自己的特色

**阶段三：功能增强**
- 基于 magic-resume 进行微调和优化
- 加入我们独有的功能

### 14.2 可融合的现有元素

| 现有元素 | 来源 | 融合方式 |
|---------|------|---------|
| 渐变背景 | Dashboard | 应用到 Workbench |
| 动画效果 | OnboardingGuide | 页面切换/加载动画 |
| 按钮样式 | 现有 Toolbar | 统一按钮风格 |
| 颜色主题 | tailwind.config | 保持一致的配色 |

### 14.3 未来功能拓展

1. **模板系统**
   - 多套 LaTeX 模板可选
   - 用户自定义模板

2. **AI 增强**
   - AI 润色（已有基础）
   - AI 建议优化
   - 智能排版建议

3. **协作功能**
   - 简历分享
   - 在线预览链接

4. **导入导出**
   - 导入 PDF 解析
   - 导入 LinkedIn 数据
   - 多格式导出（PDF/Word/JSON）

5. **版本管理**
   - 简历历史版本
   - 一键回滚

### 14.4 代码质量优化

在功能稳定后：

1. **重构**：将复制的代码逐步改为符合项目规范
2. **类型完善**：统一 TypeScript 类型定义
3. **测试覆盖**：添加单元测试和 E2E 测试
4. **性能优化**：渲染防抖、缓存优化
5. **文档完善**：组件文档、API 文档
