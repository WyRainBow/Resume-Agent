# 2026-06-19 简历制作 AI 优化（A 闭环 + C 体验）操作记录

分支：`feature/06-19/02`（基于 `dev`）

## 背景
现有 AI 能力（生成/解析/划词改写/语法体检/JD优化/翻译/通用体检/评分/聊天）已覆盖简历制作主链路。
本次只做两件高性价比、聚焦"简历制作"的增量，明确**不碰面试类功能、不碰模型配置/Provider**，不涉及数据库改动。

## A · JD 缺失关键词「一键融入」闭环
把 JD 优化从"只告诉你缺什么"升级成"帮你补上"。

- 后端：`backend/routes/resume.py`
  - 新增 `JdKeywordIntegrateRequest` 模型与 `_build_jd_keyword_integrate_prompt`。
  - 新增 `POST /api/resume/jd-keyword-integrate`：传入一个缺失关键词 + 多字段，AI 选**最相关的一条经历**返回 `{key, original, suggested, reason}`。
  - 系统边界校验沿用 jd-optimize：`original` 必须逐字命中对应字段内容，否则返回 `{"integrated": false}`；无法真实融入也返回 false，不编造经历。
- 前端：
  - `services/api.ts` 新增 `jdIntegrateKeyword()` 与 `JdKeywordIntegrateResult` 类型。
  - `JdOptimizeDialog.tsx` 缺失关键词标签改为可点击按钮，四态：`loading / ready / applied / failed`；生成后展示 original→suggested 融入卡片，复用既有 `onApply` 确定性写回。
- 测试：`backend/tests/test_jd_keyword_integrate.py`，monkeypatch `call_llm`，覆盖 golden / original 未命中 / 空对象 / 空关键词 / 空字段 三路，5 passed。

## C · 划词改写快捷动作 chips
- `AiAssistantChat.tsx` 的 `REWRITE_PRESETS` 由 3 个扩到 6 个：新增「更专业 / 换强动词 / 扩写」。
- 纯指令注入，复用现有 `rewriteTextStream` + 写回链路，无新增接口。

## 验证
- 前端 `npm run build` 通过（A、C 各一次）。
- 后端新端点经 FastAPI TestClient 三路测试通过。
- 注：本机 9000 端口被无关进程 `ark` 占用、且 AI 调用需真实 Key，未做浏览器端到端实测；逻辑复用既有成熟的 apply 写回与 jd-optimize 校验模式。

## 提交
- `feat(ai-assistant): 扩充划词改写快捷动作 chips`（C）
- `feat(jd-optimize): 缺失关键词「一键融入」闭环`（A）
两笔均已推送 `origin/feature/06-19/02`。
