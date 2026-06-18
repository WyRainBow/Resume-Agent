# AI 能力增强（第二批，对标 JadeAI）实施计划

> 日期：2026-06-18 ｜ 分支：feature/06-18/04 ｜ 模式：全自动执行（/goal）
> 参考：reference/JadeAI（jd-analysis / translate / grammar-check / chat）

排除「AI 模拟面试」（用户明确不做）。本批 4 项，均复用既有"结构化 JSON 接口 + 弹窗 + applyTextReplacement 写回"三件套。

## 子任务 1 · 增强对话系统 prompt
- 目标：让右下角 AI 助手回答更像资深简历顾问——意图自适应（问答/评估/改写）、贴合简历事实、给可落地示例、简洁分点、拒答越界话题。
- 改动：后端 `_build_resume_chat_prompt`。
- 完成标准：流式正常；带简历上下文时回答引用事实、结构清晰。
- 验证：curl 多轮提问。

## 子任务 2 · JD 分析升级（ATS 分 + 命中关键词）
- 目标：在现有 JD 优化基础上补 `atsScore`（ATS 兼容分）与 `keywordMatches`（命中关键词），直击简历过筛痛点。
- 改动：后端 `_build_jd_optimize_prompt` + jd-optimize 返回/校验；前端 `JdOptimizeResult` 类型 + JdOptimizeDialog 展示（ATS 分、命中=绿/缺失=黄关键词）。
- 完成标准：接口返回新字段；弹窗展示；旧"匹配分/缺失词/逐条应用"不回归。
- 验证：curl + npm run build。

## 子任务 3 · 简历一键翻译 / 双语
- 目标：把简历主要文本字段一键翻译成目标语言（中/英/日…），逐字段 before→after 预览并可应用。
- 改动：后端 `/resume/translate`（fields[] + target_lang → 逐字段 translated，保留 HTML 结构）；前端 `translateResume` + `TranslateDialog`（镜像 JdOptimizeDialog）+ AI 助手 Dock「翻译简历」入口（index.tsx 挂载）。
- 完成标准：选语言→翻译→应用写回对应字段；空字段 400。
- 验证：curl + build + 浏览器。

## 子任务 4 · 通用简历体检（无需 JD）
- 目标：不依赖 JD 的简历质量评分：维度（完整度/表达/量化/关键词/格式）+ 总分 + 逐条可应用建议。
- 改动：后端 `/resume/health-check`（fields[] → overallScore + dimensions[] + suggestions[]）；前端 `healthCheck` + `HealthCheckDialog` + AI 助手 Dock「简历体检」入口。
- 完成标准：返回维度分+建议；建议可一键写回；无字段 400。
- 验证：curl + build + 浏览器。

## 子任务 5 · 收尾
- 总验证：npm run build + 浏览器走查（翻译/体检/JD ATS/对话）。
- 记录：knowledge-base/reviews 操作记录；执行总结（子任务+commit+遗留）。
