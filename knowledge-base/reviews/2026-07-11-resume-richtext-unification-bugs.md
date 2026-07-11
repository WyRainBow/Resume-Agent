# resumeRichtext 统一收敛引入的 2 个回归 bug

- 日期:2026-07-11
- 分支:`feature/wy/20260711/01`
- 关联 commit:`5835d94d`(简历导入富文本格式化收敛重构)
- 复核方式:sonnet 子 agent 独立 review + 真实执行 `resumeRichtext.ts` 验证(非猜测)

## 背景

`5835d94d` 把原来分散在 `useAIImport.ts`/`ResumeDashboard/index.tsx`/`CocoChat.tsx` 三处的重复富文本转换逻辑收敛进 `frontend/src/utils/resumeRichtext.ts`。收敛本身是对的(消除重复代码、统一 `custom-list` 格式),但把两条"只在 AI 解析导入这一条路径生效的启发式规则",无差别扩散到了之前不受影响的 ResumeDashboard/CocoChat 两条路径,引入 2 个回归。

## Bug 1(数据静默丢失):`filterNonSkill` 过滤规则被扩散

`resumeRichtext.ts:178-183` 的过滤规则(无 `category` 且 `details.length > 100` 且包含"参与/负责/开发/主导/构建"任一词就丢弃)原本**只作用于 AI 解析导入路径**。重构后 `ResumeDashboard`/`CocoChat` 也统一调用,而这两处**之前完全不过滤**,且都没有"过滤后为空则回退"的保护。

实测:
```
输入: [{ details: "负责公司核心交易系统的技术选型与架构设计工作，参与制定团队编码规范和代码评审流程，
        同时负责新人技术培训和团队技术能力建设，在高并发场景下有丰富的系统设计与性能调优经验，
        能够独立完成从需求分析到上线部署的全流程工作，对分布式系统、微服务架构有深入理解。"}]（125字，无 category）
输出: ""（整条技能被丢弃）
```
这类"无分类、纯文字描述、含负责/参与"的技能条目在真实简历里很常见,只要没写 `category` 就会被整条吞掉,用户毫无感知。

## Bug 2(产生错误的从属关系):`isGroupTitle` 分组识别被扩散

`isGroupTitle`(`resumeRichtext.ts:27-52`)除了可靠的 `**xxx**` 规则外,还有两条宽松的兜底规则(以"专项/优化/模块"结尾且<25字;纯中文/字母数字<15字不含标点),会把普通简历要点误判成分组标题。这个缺陷本来就存在于 AI 解析导入路径,但重构前 `ResumeDashboard`/`CocoChat` **完全没有分组识别逻辑**,这次统一把风险带了过去。

实测:
```
输入:
  "负责用户增长模块的设计与开发，覆盖注册/登录/风控全流程"
  "性能优化"
  "将首页加载时间从 3.2s 优化到 800ms，提升用户留存率 15%"

输出:第二条"性能优化"(4字,命中"以优化结尾"规则)被误判成分组标题,
第三条被错误地降级嵌套成它的子项,产生了原文没有的从属关系。
```

## 根因(同一种模式)

重构收敛时,把"只在一条路径生效的启发式规则"当成了通用规则,无差别应用到所有调用点。独立复核还发现:`HighlightsToHtmlOptions.wrapParagraph`/`detectGroups`/`SkillsToHtmlOptions.filterNonSkill` 这三个配置开关全仓 grep 确认**从未被任何调用点传过非默认值**——是纯粹的死配置面,本该在收敛时就分场景显式声明,而不是让三处调用方"隐式共享同一套默认行为"。

## 修复方向(待实施)

1. 去掉这三个从未被使用的死配置开关,改为按场景在调用点显式决定行为(而不是留着"永远等于默认值"的隐藏开关)
2. `ResumeDashboard`/`CocoChat` 调用 `skillsToHtml` 时不应用 AI 解析导入专属的过滤规则,或至少加"过滤后为空则回退未过滤结果"的保护
3. 分组识别(`detectGroups`)限定在真正需要嵌套结构的调用方(如 `openSource` items),`ResumeDashboard`/`CocoChat` 这类没有分组概念的路径不启用,或至少去掉"纯短文本无标点即标题"这条误判率最高的规则
4. 顺手抽取 `wrapLi`/`wrapUl` 工具函数,消除 `highlightsToHtml`/`skillsToHtml` 内部 4-5 处重复的字符串拼接模板(sonnet review 的优雅度建议,非 bug,一并处理)
