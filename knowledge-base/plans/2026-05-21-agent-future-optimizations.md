# Agent 未来优化方向

> 文档日期：2026-05-21  
> 分支：`feature/05-21`  
> 状态：规划（尚未实施）  
> 背景：Hybrid 简历读取 + OPTIMIZE diff 卡片 + 经历 targeting 追问已落地；本文档记录后续 Agent 产品化与工程优化方向。

---

## 1. 当前基线（已完成）

| 能力 | 说明 | 相关提交/文件 |
|------|------|---------------|
| Hybrid 读取 | 简历正文注入 system prompt，读免 tool 费 | `manus._format_resume_for_context` |
| OPTIMIZE diff 卡片 | LLM 生成 JSON → `resume_patch` → 前端 `ResumeDiffCard` | `manus._llm_optimize_section_patch` |
| 未指定目标时追问 | 「优化实习经历」不再默认命中第一条 | `OPTIMIZE_SECTION` + `_build_optimize_target_clarification_message` |
| 经历 targeting | 公司简称 / Markdown `**` 剥离 / 建议按钮 msg 匹配 | `experience_entry.resolve_experience_target_index` |
| LLM JSON 解析 | thinking 前缀剥离、括号匹配、失败重试 | `manus._parse_optimize_llm_json` |
| delete/import patch | indexed patch + 前端 splice | `experience_entry.build_indexed_patch_*` |

---

## 2. 优化优先级总览

| 优先级 | 主题 | 预期收益 |
|--------|------|----------|
| **P0** | 数据模型统一（experience / internships） | 避免读/改/补丁路径不一致 |
| **P0** | 入库字段规范化（`**company**` 等） | 治本匹配与展示污染 |
| **P0** | 「应用优化」快路径与 diff 卡片对齐 | 消除双轨写回逻辑 |
| **P1** | 诊断两阶段状态机 | 减少重复 Phase 1 追问 |
| **P1** | 追问 UX（序数指代、循环检测、经历类型） | 降低用户困惑 |
| **P1** | Reader / Analyzer 与 optimize 共用解析层 | 减少遗漏 edge case |
| **P2** | OPTIMIZE 性能（context 裁剪 / 缓存） | 缩短 8–10s 等待 |
| **P2** | LLM 输出稳定性（json_mode / 专用 prompt） | 降低解析失败率 |
| **P2** | 技术债清理 | 可维护性 |

---

## 3. P0 — 数据与写回一致性

### 3.1 统一 `experience` / `internships` 解析层

**问题**

- 前端 canonical 数据常存于 `internships`（`title` / `subtitle` / `highlights`）。
- Agent 内存与优化路径主要使用 `experience`（`company` / `position` / `details`）。
- `resolve_experience_list` 已在 optimize 路径做 fallback，但以下模块仍只读 `experience`：
  - `work_experience_analyzer.py`
  - `cv_reader_tool.py`（Hybrid context 注入）
  - `build_optimization_resume_patch` 默认 `experience[0].details`
  - 前端 `applyPatchPaths` 以 `experience[i]` 为主

**风险**

部分简历仅有 `internships` 时，对话能读到内容，但 optimize patch 或 apply 可能写错字段。

**建议**

新增统一工具（示例命名）：

```python
resolve_experience_array(resume_data) -> tuple[str, list, str]
# 返回 (array_path, items, text_field)
# 例: ("internships", items, "highlights") 或 ("experience", items, "details")
```

Reader、Analyzer、Optimize、Patch 构建、前端 path 映射均调用同一入口。

**验收**

- 仅含 `internships` 的简历：读取 → 优化 → 应用 patch 全链路正确。
- patch path 为 `internships[i].highlights` 时前端 `applyPatchPaths` 能正确写回。

---

### 3.2 入库时 strip Markdown 强调标记

**问题**

`ResumeDashboard` 为 LaTeX 渲染将 company 包成 `**会计师事务所**`，写入 DB 后：

- targeting 需额外 strip（已在匹配层修复）；
- 追问按钮、LLM context、diff 标题仍可能带 `**`。

**建议**

- **存储层**：`company` / `title` 存纯文本。
- **渲染层**（PDF/LaTeX/对话展示）再加粗。
- **过渡方案**：`ResumeDataStore.set_data` 或 `sanitize_resume_payload` 统一 `_normalize_match_text`（strip `*`、空白）。

**验收**

- 新写入经历不再含 `**`；
- 历史数据经 sanitize 后 targeting 不依赖特殊逻辑。

---

### 3.3 「应用优化」快路径与 diff 卡片对齐

**问题**

- 当前 OPTIMIZE 主路径：`resume_patch` + 前端卡片「应用 / 拒绝」。
- `_handle_optimize_confirm` 仍从 `cv_analyzer_agent` tool 消息提取建议并调 `cv_editor_agent`。
- 用户对 Section 优化说「好的，应用吧」时，快路径**不会生效**。

**建议（二选一）**

1. **废弃 verbal confirm**：产品只保留 diff 卡片操作；删除或弱化 `_handle_optimize_confirm`。
2. **对齐数据源**：confirm 时读取 session 内最近 `pendingPatches` / 最近 assistant 回合关联的 patch_id。

**验收**

- Section optimize 后， verbal「应用」与卡片「应用」行为一致或 verbal 明确引导点卡片。

---

## 4. P1 — 产品体验与 Agent 逻辑

### 4.1 诊断两阶段状态机

**问题**

`ANALYZE_RESUME` Phase 1 → Phase 2 依赖用户输入关键词白名单：

```text
["先做通用", "通用诊断", "目标岗位", "JD", ...]
```

用户自由表述（如「帮我看看问题在哪」）可能反复进入 Phase 1。

**建议**

- Session 级状态：`diagnosis_phase = awaiting_target | running | done`。
- Phase 1 回复后任意非空用户输入（或点击 suggestion）进入 Phase 2。
- 关键词仅作增强，不作唯一门禁。

---

### 4.2 优化追问 UX 增强

**4.2.1 序数指代**

支持「优化第二段经历」「第一段」→ 映射 `experience[i]` / `internships[i]`。

**4.2.2 循环追问防护**

同一澄清消息连续出现 2 次时：

- 不再重复相同文案；
- 提示「请直接点击下方按钮选择」并保留 `%%SUGGESTIONS%%`。

**4.2.3 经历类型区分**

简历中混有实习、学生工作、社会实践时：

- 追问文案改为「以下哪一段经历需要优化表述？」；
- suggestions 可按类型分组或标注（实习 / 实践 / 学生工作）。

**4.2.4 suggestions msg 模板统一**

读取经历后生成的 suggestion `msg` 与 optimize 追问按钮保持一致：

```text
优化{company}的实习经历
```

避免「帮我优化 XX 的内容」类无法匹配的格式。

---

### 4.3 Reader / Analyzer 接入统一解析层

**范围**

- `cv_reader_tool._format_experience`：同时输出 `internships` 与 `experience`。
- `work_experience_analyzer.analyze`：使用 `resolve_experience_list`。
- `ReadCVContext` section 索引与 cv_editor path 提示一致。

---

## 5. P2 — 性能与技术债

### 5.1 OPTIMIZE context 裁剪与缓存

**现状**

每次 `_llm_optimize_section_patch` 注入整份简历 Hybrid context，耗时约 8–10s。

**建议**

- 同 session 缓存 `_format_resume_for_context()` 结果（resume hash 失效）。
- Optimize 仅注入：目标经历全文 + 基本信息摘要 + 相邻 0–1 条经历（可选）。

**注意**

需验证裁剪后优化质量不显著下降（尤其跨经历措辞一致性）。

---

### 5.2 LLM 输出稳定性

**现状**

`deepseek-v4-flash` 常带 thinking 前缀；已加 strip + 重试 + regex fallback。

**后续可选**

- optimize 专用调用关闭 thinking / 使用 `response_format: json_object`（视 DashScope 兼容性）。
- 失败时给用户明确文案：「生成失败，请重试或换一段经历」，而非技术向提示。

---

### 5.3 其他技术债

| 项 | 位置 | 说明 |
|----|------|------|
| `parse_thought_response` 待删 | `agent_stream.py` | TODO: 前端 CLTP 迁移完成后清理 |
| `sanitize` 触发过窄 | `resume_data_store._needs_sanitize` | 建议每次 set_data 轻量 normalize |
| 规则 analyzer 已移除 | `work_experience_analyzer.optimize` | 确认无残留调用路径 |
| 循环检测 silent | agent loop detector | 终止时应给用户可见说明 |

---

## 6. 建议实施顺序

```text
Phase A（数据一致性，1–2 天）
  1. resolve_experience_array 统一层
  2. set_data sanitize strip **
  3. 前端 applyPatchPaths 支持 internships[i].highlights

Phase B（产品体验，1 天）
  4. 诊断 phase 状态机
  5. 序数指代 + 循环追问 UX
  6. suggestions msg 模板统一

Phase C（写回与性能，按需）
  7. optimize confirm 与 diff 卡片对齐
  8. OPTIMIZE context 缓存 / 裁剪
  9. LLM json_mode 试验
```

---

## 7. 测试清单（实施时对照）

- [ ] 「优化实习经历」→ 追问 → 点选 / 输入公司名 → diff 卡片
- [ ] company 含 `**` 的历史简历 targeting 正确
- [ ] 仅 `internships` 字段的简历全链路
- [ ] 「优化第二段经历」序数命中
- [ ] 诊断：Phase 1 后任意有效回复进入 Phase 2
- [ ] 连续 2 次匹配失败不 infinite 相同追问
- [ ] patch apply 后 PDF 预览与 DB 持久化一致
- [ ] OPTIMIZE 失败重试后仍失败 → 友好错误，无规则模板 diff

---

## 8. 相关文档

- Hybrid 架构：`docs/resume-reader-hybrid-refactor.md`
- NL 重构设计：`knowledge-base/specs/2026-03-23-nl-resume-refactor-design.md`
- 诊断对齐：`knowledge-base/specs/2026-03-27-resume-diagnosis-alignment-spec.md`
