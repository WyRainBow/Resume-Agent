# 核心链路健壮性巡检与修复（loading / 错误提示 / 大小限制）

> 日期：2026-06-23
> 分支：`feature/06-20/01`
> 触发：刘小排 `07-launch-checklist.md` 的"产品体验检查 / AI 功能检查"（失败要有明确提示、
> 生成中要有 loading、上传要有大小限制）。
> 关联：`knowledge-base/reviews/2026-06-23-session-summary.md`

## 1. 巡检范围与方法

用 Explore agent 巡检四条核心链路（简历导入解析 / Agent 生成对话 / PDF 导出预览 / 照片·logo 上传）
的 loading 态、失败提示、上传大小限制三项，只取**用户可感知缺口**，逐条带 file:line 证据。

## 2. 已修（本次）

| 提交 | 缺口 | 修复 |
|------|------|------|
| `fc8d3a5` | 照片 / logo 上传无前端大小预校验，>2MB 等上传完才被后端 400 拒 | `BasicPanel` / `ExperienceItem` 加 2MB + 类型预校验，对齐后端 `photos.py`/`logos.py`，沿用现有 `validateFile`/alert 风格；照片 input `accept` 收窄 |
| `4790f6d` | 简历导入解析（PDF/图片）上传无超时，后端挂死则一直卡"解析中" | 复用 `fetchWithTimeout` 加 60s 超时；`FetchTimeoutError` 给可重试提示 |

## 3. 刻意未改（带原因，非遗漏）

- **alert → toast 全站化**：仓库**当前没有任何 toast/通知系统**（无 sonner/react-hot-toast）。
  为这些提示引入 toast 库属新增基础设施 + 大范围改写，违背"简单优先 / 不引入单次抽象"。
  现有约定就是 `alert()`，本次维持，仅在缺口处补提示。
- **PDF 渲染错误展示**（`usePDFOperations` → `PreviewPanel`）：错误经单一 `progress` 字符串展示，
  且 `finally` 把 `loading` 置 false 后状态栏不再显示——要做对需新增独立 error 态并贯穿
  `usePDFOperations → index → ResizableLayout → EditPreviewLayout → PreviewPanel`（4–5 文件），
  且必须**起后端真实跑 PDF 失败路径**验证。本地无后端，盲改高风险，暂缓。
- **Agent SSE 静默断流提示**：显式 error 事件**已有**处理（`useToolEventRouter.ts:80` →
  "流式请求失败，请稍后重试" → `setResumeError`）。仅"网络静默掉线、流无错误事件直接结束"
  这一窄缝可能未覆盖，但其修复要动 `SophiaChat`（约 4000 行）的流式状态机，且需**起后端 + LLM
  端到端**验证，盲改易引入新 bug（参见本会话曾因依赖优化引入 `/agent/new` 闪屏），暂缓。

## 4. 验证

- `fc8d3a5` / `4790f6d`：`npm run build` 均 ✓。预校验与超时为确定性同步/超时逻辑，
  置于异步调用前，构建 + 代码审查即可确认；完整上传/解析运行需后端，已如实标注。

## 5. 待办（需后端在跑时再做，按用户影响排序）

1. PDF 渲染失败的独立错误态 + 红色样式（贯穿渲染链路，需后端 PDF 失败路径实测）。
2. Agent SSE 静默断流的兜底提示（需后端 + LLM 端到端）。
3. 照片/logo 上传失败的"重试"引导（低优先）。
