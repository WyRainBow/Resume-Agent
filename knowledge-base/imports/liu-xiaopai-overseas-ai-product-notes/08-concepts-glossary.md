# 08 概念词典

## MicroSaaS

面向窄人群，解决具体高频问题，由小团队运营，通过订阅、积分或经常性付费持续收钱的软件产品。

相关：

- [MicroSaaS 产品判断](01-microsaas-product.md)
- [Landing Page 与首屏转化](02-landing-page.md)

## 真需求

有人愿意付出代价的问题。代价可以是钱、时间、迁移成本、学习成本或组织流程改变。

相关：

- [伪需求危险信号](01-microsaas-product.md#伪需求危险信号)
- [Playbook 1](09-playbooks.md#playbook-1-判断一个想法是不是值得做)

## 订阅

订阅不是价格格式，而是问题的时间结构。只有反复发生、持续制造麻烦的问题，才支撑订阅。

相关：

- [MicroSaaS 四个关键词](01-microsaas-product.md#microsaas-四个关键词)
- [海外支付、订阅与 Webhook](04-payment-webhook.md)

## Landing Page

产品落地页。它的任务不是一次性解释所有功能，而是在 8 秒内买到用户继续看的时间。

相关：

- [Landing Page 与首屏转化](02-landing-page.md)
- [Landing Page 生成提示词](10-prompts-and-templates.md#landing-page-生成提示词)

## 用户中心

用于承载身份、权限、额度、订阅状态、积分、历史记录和付费引导的产品区域。

相关：

- [用户中心、登录与权限](03-auth-user-center.md)
- [三类用户模型](03-auth-user-center.md#三类用户模型)

## BetterAuth

开源认证库，适合 Next.js + Neon + Vercel。用户数据保存在自己的数据库里。

相关：

- [BetterAuth 思路](03-auth-user-center.md#betterauth-思路)
- [Starter Kit 与技术底座](05-starter-kit.md)

## Google OAuth

通过 Google 账号登录。课程推荐海外产品优先支持 Google 登录，因为它降低临时邮箱滥用风险。

相关：

- [为什么优先 Google 登录](03-auth-user-center.md#为什么优先-google-登录)

## 支付网关

连接网站和支付处理商的桥梁，处理支付信息、交易状态和资金流转。

相关：

- [海外支付、订阅与 Webhook](04-payment-webhook.md)

## Checkout

支付平台提供的托管收银台。优点是接入快，缺点是用户会跳转到支付平台域名，定制空间有限。

相关：

- [基础概念](04-payment-webhook.md#基础概念)

## Webhook

第三方服务在事件发生后主动通知你的服务器。支付系统中常用于通知支付成功、订阅创建、订阅取消等事件。

相关：

- [Webhook 调试](04-payment-webhook.md#webhook-调试)
- [支付接入后必须确认](04-payment-webhook.md#支付接入后必须确认)

## Creem

对中国开发者友好的订阅支付平台之一，课程中重点用于测试模式和订阅支付演示。

相关：

- [Creem 配置要点](04-payment-webhook.md#creem-配置要点)

## Dodo Payments

另一个对中国开发者较友好的支付平台，提供 Next.js 示例和相关 Starter。

相关：

- [Dodo Payments 配置要点](04-payment-webhook.md#dodo-payments-配置要点)

## Starter Kit

预先集成登录、支付、数据库、邮件、后台、积分、多语言等基础设施的模板项目。

相关：

- [Starter Kit 与技术底座](05-starter-kit.md)
- [Playbook 4](09-playbooks.md#playbook-4-选择-starter-kit)

## ShipAny

适合快速推出 MVP 的商业 Starter，功能多，接入快，但后期可能需要补强架构和性能。

相关：

- [ShipAny](05-starter-kit.md#shipany)

## MkSaaS

课程较认可的 Starter，代码结构和技术栈更符合作者审美，但对新手配置可能更复杂。

相关：

- [MkSaaS](05-starter-kit.md#mksaas)

## AI 编程工具

包括 Cursor、Claude Code、Codex、V0。课程强调：复杂任务要让 AI 读项目、出计划、改代码、跑验证，而不是只聊天。

相关：

- [AI 编程实操流程](06-ai-dev-workflow.md)
- [提示词模板](10-prompts-and-templates.md)
