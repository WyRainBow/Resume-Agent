# `%%SUGGESTIONS%%`(ask 模式)交互机制现状调查

- **日期**:2026-07-11
- **分支**:`feature/agent-arch-wave2a`
- **背景**:用户提出"能不能把 Agent 反问用户要数据的场景做成表单卡片,每个问题一个输入框",怀疑代码里已有类似机制。查证后确认存在,记录现状,供后续如果要扩展"多字段表单"时参考,本文档只记录现状,不代表已批准的扩展方案。

## 一、机制现状

### 1. 协议:`%%SUGGESTIONS%%[...]%%END%%`

不是 Python 代码手工拼接的固定模板,而是**由 LLM 自己在回复正文末尾生成**这段 JSON 标记——system prompt(`backend/agent/prompt/manus.py:209/212/215`)给了几个示例格式教 LLM 什么时候该给建议、给什么样的文案,LLM 自主决定要不要生成、生成几条。这点很关键:整套机制已经是 LLM-first 风格,没有 Python 硬编码"什么时候该弹建议"的判断逻辑。

示例(manus.py:209):
```
%%SUGGESTIONS%%[{"text": "帮我直接修改这些问题", "msg": "帮我把诊断出的问题直接修改好"}, {"text": "针对目标岗位定制简历", "msg": "我想针对目标岗位定制简历，请问我的目标岗位"}, {"text": "查找匹配职位", "msg": "帮我搜索匹配的职位"}]%%END%%
```

每条建议的 JSON 结构:`{text, msg, template?}`。

### 2. 后端解析:`backend/agent/web/streaming/agent_stream.py`

- 正则 `%%SUGGESTIONS%%(\[.*?\])%%END%%`(:392)从 LLM 输出的完整正文里提取这段 JSON
- 还有一个 `partial_pattern`(:404)处理流式输出过程中标记尚未闭合的情况
- 提取后转成独立的 `SuggestionsEvent`(`EventType.SUGGESTIONS`,`events.py:47/423`)通过 SSE 发给前端,正文本身不包含这段 JSON(:935 有专门的 skip 逻辑避免正文重复)

### 3. 前端渲染:`frontend/src/components/agent-chat/StreamingLane.tsx:194-276` `SuggestionButtons`

支持两种形态:
- **纯按钮**:没有 `template` 字段的建议,点击直接把 `msg` 当用户消息发送
- **单填空模板**:有 `template` 字段(内含一个 `{input}` 占位符)的建议,点击后**内联展开**一个输入框 + 发送按钮(:219-253),用户填完点发送或回车,把 `template.replace("{input}", 用户输入)` 拼好当消息发出去

已知实际使用场景:诊断 Phase1 的"告诉我目标岗位名称"就是这种(`template: "我的目标岗位是{input}，请基于这个方向做诊断"`)。

## 二、能力边界

**当前只支持每条建议一个 `{input}` 槽位**,不支持"一条建议里同时列多个字段"(比如同时问"接口 QPS 提升了多少" + "优化了几条 SQL" + "项目覆盖多少用户量"这种需要多个输入框一起填、一起提交的场景)。目前遇到这类多信息点的追问,LLM 只能用纯文本一次性列出所有问题(参考本文档同批次测试记录:`帮我把字节跳动这段经历改得更有量化数据`,LLM 回复里用 Markdown 列表列了 5 个问题,但用户只能在聊天输入框里一次性回复,没有逐字段填写的 UI)。

## 三、如果要扩展成多字段表单,大致改动点(仅记录讨论要点,非已批准方案)

1. **协议扩展**:JSON schema 加一种新形态,比如 `{text, fields: [{label, placeholder, key}], submitTemplate}`,和现有 `{text, msg, template}` 共存(纯按钮/单字段/多字段三种建议可以混在同一个 `SUGGESTIONS` 数组里)
2. **system prompt 教学**:给 LLM 补充"信息缺口有多个独立字段时用 `fields` 格式"的示例和判断标准,不需要额外 Python 判断逻辑
3. **后端解析**:`agent_stream.py` 的正则提取逻辑不用大改(还是提取整段 JSON),但下游转发到 `SuggestionsEvent` 时要透传新的 `fields` 结构
4. **前端**:`SuggestionButtons` 加一个多字段渲染分支,内联展开多个 `<input>`,全部填完才允许提交,提交时按 `submitTemplate` 里的多个占位符替换拼接成一条消息发出去

## 四、下一步

本文档只是现状记录,用户已表示"停一下"暂不推进这个扩展。如果之后要做,建议走 `/brainstorming` 走一遍设计(尤其是 `submitTemplate` 多占位符替换的具体格式、多字段场景下"必填 vs 选填"要不要支持这些细节),不要直接跳过设计对齐派 agent 写。
