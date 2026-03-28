# Spec: 简历诊断功能对齐与实现 (Aligned with upcv)

## 1. 背景与目标
为了提升简历诊断的用户体验，我们将原有的单一 LLM 问答流程，重构为参考 `upcv` 体验的“结构化诊断流”。
核心目标是提供直观的工具反馈（工具卡片）以及层次分明的可视化报告（评分卡 + 分级建议）。

## 2. 核心设计思想：工具编排 (Tool Orchestration)
我们放弃了让 LLM 自由生成诊断文字的路径，改为在 `Manus` Agent 的 Intent 处理器中显式编排了一个两阶段的“虚拟工具执行链”：

1. **获取简历详情 (get_resume_detail)**：
   - **目的**：让用户感知 Agent 正在阅读简历上下文。
   - **实现**：发出一个带有简历元数据（ID, 名称, 更新时间）的虚拟工具调用。
2. **简历诊断 (resume-diagnosis)**：
   - **目的**：展示深度分析过程并输出结构化结果。
   - **实现**：聚合多个子 Analyzer（工作经历、技能等）的评分与建议，构建高维度的 JSON Payload。

## 3. 技术实现方案

### 3.1 后端意图识别加固 (Intent Recognition)
在 `ConversationStateManager` 和 `Manus.py` 中增加了对“诊断”关键词的强触发逻辑。
- **修复点**：原逻辑只识别“分析/评估”，导致“帮我诊断”会回退到普通 LLM 对话模式（无工具卡片）。
- **优化**：拦截包含“诊断”字样的请求，强制将意图路由至 `ANALYZE_RESUME`。

### 3.2 结构化数据映射 (Structured Metadata)
通过 `self._tool_structured_results` 将工具调用 ID 与复杂的报告 JSON 绑定。
- **Payload 结构**：
  - `summary`: 包含初筛通过率、质量得分、竞争力。
  - `details`: 包含分级的问题清单（必须修改/建议优化/可选优化）以及 Top 3 行动建议。
  - `next_steps`: 引导用户提供 JD 进行定向匹配。

### 3.3 前端组件化渲染 (Frontend Cards)
更新了 `DiagnosisToolCards.tsx` 以解析上述 Payload。
- **可视化评分卡**：使用网格布局展示 4 项核心指标。
- **分级问题列表**：使用不同颜色的 Badge 和图标标记优化优先级。
- **Top 建议展示**：以更显著的卡片形式展示最值得执行的前 3 项操作。

### 3.4 体验细节对齐
- **Thought 净化**：在 `ThoughtProcess.tsx` 中使用正则过滤掉 `Thought for Xs` 这类技术调试信息，使 UI 更加简洁专业。
- **中断保护**：在 `stream.py` 增加了 Session Guard。当用户开启新请求时，优雅中断旧流并给出“会话切换”的友好提示，而非原始的“Execution stopped by user”。

## 4. 参考 upcv 的特性
- **两阶段反馈**：模仿了 upcv 先读取再诊断的视觉节奏。
- **报告层次感**：模仿了其“先给分，再列痛点，最后给行动方案”的黄金分析模板。
- **引导式 CTA**：在报告末尾自动带入“请贴出 JD”或“直接修改”的快捷按钮，提高转化效率。

---
**日期**：2026-03-27
**作者**：Manus Agent (with Claude Code Support)
