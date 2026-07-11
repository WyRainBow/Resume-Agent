# resumeRichtext 统一收敛引入的回归 bug(含修复记录)

- 日期:2026-07-11
- 分支:`feature/wy/20260711/01`
- 关联 commit:`5835d94d`(收敛重构)→ `c291255c`(修复 Bug1/Bug2)
- 复核方式:sonnet 子 agent 独立 review + 真实执行 `resumeRichtext.ts` 验证(非猜测)

## 背景

`5835d94d` 把原来分散在 `useAIImport.ts`/`ResumeDashboard/index.tsx`/`CocoChat.tsx` 三处的重复富文本转换逻辑收敛进 `frontend/src/utils/resumeRichtext.ts`。收敛本身是对的(消除重复代码、统一 `custom-list` 格式),但把两条"只在 AI 解析导入这一条路径生效的启发式规则",无差别扩散到了之前不受影响的 ResumeDashboard/CocoChat 两条路径,引入 2 个回归。

## Bug 1(数据静默丢失):`filterNonSkill` 过滤规则被扩散

`resumeRichtext.ts:178-183`(重构后原版本行号)的过滤规则(无 `category` 且 `details.length > 100` 且包含"参与/负责/开发/主导/构建"任一词就丢弃)原本**只作用于 AI 解析导入路径**。重构后 `ResumeDashboard`/`CocoChat` 也统一调用,而这两处**之前完全不过滤**,且都没有"过滤后为空则回退"的保护。

实测:
```
输入: [{ details: "负责公司核心交易系统的技术选型与架构设计工作，参与制定团队编码规范和代码评审流程，
        同时负责新人技术培训和团队技术能力建设，在高并发场景下有丰富的系统设计与性能调优经验，
        能够独立完成从需求分析到上线部署的全流程工作，对分布式系统、微服务架构有深入理解。"}]（125字，无 category）
输出: ""（整条技能被丢弃）
```

**状态:已修复(`c291255c`)**。过滤逻辑抽成独立的 `dropNonSkillEntries` 函数,`skillsToHtml` 本体不再做任何过滤;只有 `useAIImport.ts` 显式调用 `dropNonSkillEntries` 保持原有行为,`ResumeDashboard`/`CocoChat` 不再过滤。sonnet 独立 review 复测确认修复正确。

## Bug 2(产生错误的从属关系):`isGroupTitle` 分组识别被扩散

`isGroupTitle`(重构后原版本)除了可靠的 `**xxx**` 规则外,还有两条宽松的兜底规则(以"专项/优化/模块"结尾且<25字;纯中文/字母数字<15字不含标点),会把普通简历要点误判成分组标题。这个缺陷本来就存在于 AI 解析导入路径,但重构前 `ResumeDashboard`/`CocoChat` **完全没有分组识别逻辑**,这次统一把风险带了过去。

实测:
```
输入:
  "负责用户增长模块的设计与开发，覆盖注册/登录/风控全流程"
  "性能优化"
  "将首页加载时间从 3.2s 优化到 800ms，提升用户留存率 15%"

输出:第二条"性能优化"(4字,命中"以优化结尾"规则)被误判成分组标题,
第三条被错误地降级嵌套成它的子项,产生了原文没有的从属关系。
```

**状态:已修复(`c291255c`)**。`isGroupTitle` 只保留可靠的 `**xxx**` 规则,删除两条误判率高的宽松规则。分组识别拆成独立的 `groupedHighlightsToHtml`,重构时判断"只有 openSource items 需要分组",experience/education/projects 全部走扁平的 `highlightsToHtml`。sonnet 独立 review 复测确认"性能优化"不再被误判。

## Bug 3(新发现,`c291255c` 修复引入,待处理):`projects` 字段的嵌套分组能力被误删

sonnet 二次独立 review 发现:修复 Bug2 时判断"只有 openSource 需要分组识别"是**不准确的**。`backend/prompts_pdf_parser.py` 的 `NESTED_RULES`(实际拼装点在 `backend/services/resume_assembler.py:353,426`)明确规定:"嵌套层级结构规则……适用于 **projects、openSource**",并给出了 `projects.highlights` 带真实 `**标题**` 分组标记的官方示例:
```
["**搜索服务拆分专项**", "重构搜索服务架构", "实现分布式索引", "**性能优化**", "优化数据库查询"]
```
但 `c291255c` 把 `projects` 字段的调用点(`useAIImport.ts:146,283` 等)全部留在扁平的 `highlightsToHtml`,该函数已完全不含分组识别代码。

实测(用后端官方 prompt 示例验证):
```
highlightsToHtml(projectsHighlights)         // 当前实际行为
→ 5 个平级 <li>，"搜索服务拆分专项"和它的子项变成兄弟关系

groupedHighlightsToHtml(projectsHighlights)  // 若改用分组函数
→ 正确产出 2 个分组，each 带 nested-list 子列表
```

**性质**:不是数据丢失,是结构降级(标题-子项从属关系丢失)。`useAIImport.ts:146,283` 两处调用点的代码注释仍写着"使用统一的嵌套层级逻辑"/"支持嵌套层级",与实际行为不符,是本次改动留下的注释与实现不一致。

**根因**:修复 Bug2 时只核对了前端三处调用点的现状,没有反查后端 prompt 契约(`backend/prompts_pdf_parser.py`/`resume_assembler.py`)里对 `projects.highlights` 分组能力的产品设计要求,属于调研不完整导致的遗漏。

**状态:待修复**。建议:`useAIImport.ts` 的 `projects` 字段调用点(146/283 行及其它遗漏点,需要重新全面 grep)改用 `groupedHighlightsToHtml`,并同步修正注释使其与实现一致。
