# 操作记录 · AI 能力增强（第二批，对标 JadeAI）

> 日期：2026-06-18 ｜ 分支：feature/06-18/04 ｜ 模式：全自动执行（/goal）
> 计划：knowledge-base/plans/2026-06-18-ai-enhance-batch2-plan.md

## 完成的子任务与提交

| # | 子任务 | commit |
|---|---|---|
| 0 | 实施计划入库 | `d91713a` |
| 1 | 增强对话系统 prompt | `44554f2` |
| 2 | JD 分析升级（ATS 分 + 命中关键词） | `0f0c3dd` |
| 3 | 简历一键翻译 / 双语 | `7ed96fb` |
| 4 | 通用简历体检（无需 JD） | `2c4aced` |

均已推送 `origin/feature/06-18/04`。

## 关键改动
- 后端 `backend/routes/resume.py`：
  - 重写 `_build_resume_chat_prompt`（角色/边界/意图自适应/基于事实/简洁分点）。
  - `_build_jd_optimize_prompt` + jd-optimize 返回新增 `atsScore`、`keywordMatches`。
  - 新增 `/resume/translate`（`TranslateRequest` + `_build_translate_prompt`，**逐字段翻译**，部分成功可用、全失败才 500）。
  - 新增 `/resume/health-check`（`HealthCheckRequest` + `_build_health_check_prompt`，5 维度评分+建议）。
- 前端：
  - `services/api.ts`：`JdOptimizeResult` 增 atsScore/keywordMatches；新增 `translateResume` / `healthCheck` 及类型。
  - 新增 `TranslateDialog.tsx`、`HealthCheckDialog.tsx`（镜像 JdOptimizeDialog，apply 走 applyTextReplacement）。
  - `JdOptimizeDialog.tsx`：展示 ATS 分 + 已命中关键词（绿）。
  - `AiAssistantChat.tsx`：Dock 新增「简历一键翻译」「简历体检」入口（props onTranslate/onHealthCheck/hasContent）。
  - `Workspace/v2/index.tsx`：挂载两个新弹窗并接线。

## 验证
- `npm run build`：通过（exit 0）。
- 后端 curl：
  - chat：评估意图结构化输出且引用简历事实；越界问题礼貌带回。
  - jd-optimize：返回 atsScore=60、keywordMatches=[Java,Spring,Redis]、missingKeywords=[MySQL,Kafka,微服务,...]。
  - translate：中→英保留 HTML；多字段逐字段成功；空 fields→400。
  - health-check：总分 + 5 维度分 + 建议 + 总结；空 fields→400。
- 浏览器（5173→9007）：
  - 翻译：弹窗出 9 条→一键全部应用→自我评价字段写回英文。
  - 体检：弹窗出 5 维度 + 3 条建议，无报错。

## 已知问题 / 遗留
- **React dev 警告**「Cannot update a component (ResumeProvider) while rendering (WorkspaceV2)」：在批量 applyTextReplacement（翻译/体检/JD 一键全部应用）时出现，源自既有简历数据更新→自动评分/渲染副作用级联，非本批新引入（JdOptimizeDialog 同路径）；功能不受影响。建议后续把 applyTextReplacement 的批量写入合并为一次 setResumeData，或将 onApply 的连续调用包进 transition。仅 dev 模式告警。
- 翻译整篇为**逐字段串行**调用，字段多时较慢（样例简历 ~9 字段约 50s），有 loading 态；后续可并行或合并。
- 未登录态编辑触发 PDF 自动渲染 401，属既有行为。
- 环境：标准后端口径 9000；本批因 ark 占 9000，后端临时 9007、前端 `VITE_DEV_PROXY_TARGET=9007`，零代码改动。
