# 做能收钱的海外AI产品 - Knowledge Base

这组知识库根据 OCR Markdown 整理而来，目标不是逐字还原课程，而是把课程里可复用的判断框架、产品模块、执行路径、提示词和检查清单抽出来。

原始 OCR 目录：

`/Users/wy770/Desktop/刘小排/做能收钱的海外AI产品_ocr_work/做能收钱的海外AI产品_split_work/做能收钱的海外AI产品_md`

## 快速入口

- [知识地图](00-knowledge-map.md)：按产品链路理解全局。
- [概念词典](08-concepts-glossary.md)：快速查 MicroSaaS、Webhook、Starter Kit 等概念。
- [任务 Playbook](09-playbooks.md)：按“我要做什么”检索行动步骤。
- [提示词模板](10-prompts-and-templates.md)：给 Codex / Claude Code / Cursor 的可复用提示词。
- [关系图谱](11-link-graph.md)：看各模块之间如何互相依赖。

## 主线

1. [MicroSaaS 产品判断](01-microsaas-product.md)
2. [Landing Page 与首屏转化](02-landing-page.md)
3. [用户中心、登录与权限](03-auth-user-center.md)
4. [海外支付、订阅与 Webhook](04-payment-webhook.md)
5. [Starter Kit 与技术底座](05-starter-kit.md)
6. [AI 编程实操流程](06-ai-dev-workflow.md)
7. [上线与打磨清单](07-launch-checklist.md)

## 按问题查

- 我还没有产品方向：读 [MicroSaaS 产品判断](01-microsaas-product.md) 和 [需求判断 Playbook](09-playbooks.md#playbook-1-判断一个想法是不是值得做)。
- 我已经有想法，但不知道页面怎么写：读 [Landing Page](02-landing-page.md) 和 [Landing Page 提示词](10-prompts-and-templates.md#landing-page-生成提示词)。
- 我要做登录、免费/付费权限：读 [用户中心、登录与权限](03-auth-user-center.md)。
- 我要接海外支付：读 [海外支付、订阅与 Webhook](04-payment-webhook.md) 和 [支付接入 Playbook](09-playbooks.md#playbook-3-接入订阅支付)。
- 我要选模板或 Starter：读 [Starter Kit 与技术底座](05-starter-kit.md)。
- 我要让 AI 帮我开发：读 [AI 编程实操流程](06-ai-dev-workflow.md) 和 [提示词模板](10-prompts-and-templates.md)。
- 我要上线前自查：读 [上线与打磨清单](07-launch-checklist.md)。

## 一句话总纲

这门课的核心是：找到一个具体人群反复遇到的具体麻烦，用现成 SaaS 基础设施快速搭出可登录、可支付、可交付核心功能的产品，然后通过测试模式、Webhook、权限和付费引导，把它变成能持续收钱的 MicroSaaS。

## 使用提醒

- OCR 版本有少量错字，尤其截图、代码、深色界面和幻灯片页。
- 代码片段只做方向参考，真正开发时应回到官方文档和项目源码核对。
- 这些笔记更适合做产品和开发路线图，不适合作为逐字教程。
