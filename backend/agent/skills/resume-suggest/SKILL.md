---
name: resume-suggest
version: 1
description: 把同一次简历评估转为字段级、只读的修改建议。
---

# Resume Suggest

从既有评估生成 3-5 条具体修改建议，不重新分析整份简历。

## 每条建议

- 稳定 suggestion_id、assessment_id、所属模块和严重度。
- 展示问题标题、原文或明确缺口、证据理由和具体建议。
- 能在不新增事实的前提下安全改写时，才给可直接使用的 proposed。
- 缺少真实事实时不得生成示例值；邮箱、院校、日期、GPA、量化结果等写入 requires_facts，proposed 留空。
- 不使用 `XX%`、示例邮箱、示例学校或占位人名。

## 首期交互

- 建议卡只读，允许上一条和下一条浏览。
- 不提供“应用此修改”，不生成 patch，不调用 cv_editor_agent。
- 诊断卡和建议卡由同一次 cv_analyzer_agent 结果产生，不新增“AI 导师”空工具。
