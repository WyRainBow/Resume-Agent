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
- **PDF 渲染错误展示** → ✅ 已做（`0989462`，见 3.1）。
- **Agent SSE 静默断流提示** → ✅ 已做（`0989462`，见 3.1）。

### 3.1 后续补做（`0989462`，浏览器实测）

之前因"无后端、盲改高风险"暂缓的两项，用**更内聚的方案**实现并实测：

- **PDF 渲染错误展示**：未走"新增 error 态贯穿 5 文件"的重型路线，改为在 `PreviewPanel`
  单文件按 `!loading && progress!==""` 判定终态错误（成功时 `progress` 被清空），红色告警横幅展示，
  区别于 indigo 进度 / amber 待更新。实测：后端 down 时点「渲染 PDF」→ 红色横幅显示
  「渲染失败：…HTTP 500…」（修复前该错误被静默吞掉）。
- **Agent SSE 静默断流**：根因是 `useCLTP` 的 `heartbeatTimeout(60s)` 是**死 prop**、
  `streamAgent` 读循环无空闲上限；后端本就每 55s 发心跳（注释写明"前端超时 60s"），契约缺前端半边。
  `streamAgent` 新增 `idleTimeoutMs` 看门狗（每块/心跳到达即重置，超时 cancel reader 报错退出），
  `useCLTP` 透传 `heartbeatTimeout`。实测 `/agent/new` 正常加载无回归；60s 静默 stall 完整复现
  需"可连上后挂起"的服务端，已如实标注。

## 4. 验证

- `fc8d3a5` / `4790f6d`：`npm run build` 均 ✓。预校验与超时为确定性同步/超时逻辑，
  置于异步调用前，构建 + 代码审查即可确认；完整上传/解析运行需后端，已如实标注。

## 5. 剩余待办

- 照片/logo 上传失败的"重试"引导（低优先）。
- SSE 60s 静默 stall 的端到端复现（需可"连上后挂起"的服务端或故障注入）。
