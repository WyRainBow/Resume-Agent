# 05 Starter Kit 与技术底座

来源页码：Page 061-074, Page 081-086, Page 094-095

## 为什么用 Starter Kit

MicroSaaS 早期不应该从零搭所有基础设施。

Starter Kit 的价值是提前提供：

- 登录认证
- 数据库
- 支付
- 邮件系统
- 管理后台
- 用户管理
- 积分/订阅
- 多语言
- 博客/SEO
- Waiting list
- 法律页面
- AI demo 能力

这样开发者可以把时间放在核心功能和流量上。

## Starter Kit 的本质

Starter Kit 不是“模板皮肤”，而是一套商业化基础设施。

它帮你提前处理那些每个 SaaS 都差不多、但从零做很耗时的东西：

- 用户怎么注册登录。
- 用户数据存在哪里。
- 用户怎么付费。
- 支付后权益怎么开通。
- 管理员怎么查看用户。
- 多语言、邮件、法律页面怎么组织。
- 基础 UI 和路由怎么搭。

课程的思路是：不要把精力浪费在低差异化工作上。真正让产品成立的是核心功能和真实流量。

## 课程推荐顺序

对于新手，课程大致推荐：

1. ShipAny
2. MkSaaS
3. MakerKit
4. SupaStarter
5. ShipFast

实际选择取决于目标：最快 MVP、代码审美、学习深度、支付平台支持、未来扩展性。

## 选择 Starter 前先问自己

1. 我是想最快验证，还是想深入学习？
2. 我的支付平台必须支持什么？
3. 我需要多语言吗？
4. 我需要积分系统吗？
5. 我是否需要后台？
6. 我是否能读懂它的代码结构？
7. AI 工具是否能轻松理解这个项目？
8. 它的环境变量配置是否清楚？
9. 它的文档是否覆盖部署和支付？
10. 如果后面要迁移，成本大不大？

不同答案会导向不同选择。没有绝对最好的 Starter，只有适合当前阶段的 Starter。

## ShipAny

优势：

- MVP 开发很快。
- 支持多种支付网关，如 Creem、Stripe、PayPal。
- 功能完整，包含博客、分销、在线客服等。

劣势：

- 代码健壮性一般。
- 一些配置可能为了方便牺牲安全性。
- 更适合早期个人项目，后期流量大了需要补性能和架构。

适合：
想最快上线验证想法的人。

## ShipAny 使用策略

如果使用 ShipAny，建议把目标定为“快速验证”，不要一开始就追求完美架构。

适合先做：

- 快速套出 Landing Page。
- 快速接入支付。
- 快速做一个 AI 功能 demo。
- 快速上线收集用户反馈。

后续需要补：

- 性能优化。
- 更严谨的环境变量管理。
- 更清晰的权限模型。
- 更完整的测试。
- 更安全的后台和团队协作流程。

## MkSaaS

优势：

- 架构优秀且相对简单。
- 使用 Next-Intl、Resend、Drizzle、shadcn、MagicUI、BetterAuth、Zustand 等课程喜欢的技术栈。
- 性价比高。

劣势：

- 支付平台支持相对少，默认偏 Stripe。
- 比较新。
- 对新手来说配置可能更繁琐。

适合：
想深入理解技术栈，同时重视代码结构的人。

## MkSaaS 使用策略

MkSaaS 更适合愿意学习代码结构的人。它不是最低门槛路线，但长期可能更舒服。

适合先关注：

- i18n 文案在哪里。
- BetterAuth 怎么配置。
- Drizzle schema 怎么组织。
- Resend 邮件如何接。
- shadcn/MagicUI 组件如何复用。
- 支付模块是否要从 Stripe 改成 Creem/Dodo。

如果你想用 AI 工具协作开发，清晰的代码结构会让 AI 更容易做正确修改。

## MakerKit / SupaStarter / ShipFast

MakerKit：
更稳定，文档好，适合想快速构建稳定基础的团队。数据库和后端偏 Supabase，对新手友好。

SupaStarter：
架构强，适合复杂项目或未来规模更大的项目，但新手理解成本高。

ShipFast：
更偏快速启动，适合推出 MVP，但课程中不是最重点推荐。

## 对比维度表

| 维度 | 快速 MVP | 长期项目 |
| --- | --- | --- |
| 支付 | 能尽快跑通 Creem/Dodo/Stripe | 订阅、退款、发票、权限状态完整 |
| 认证 | Google 登录可用 | 多 provider、账号管理、安全策略 |
| 数据库 | 能存用户和生成记录 | schema 清晰，可迁移，可扩展 |
| UI | 能上线可用页面 | 组件体系统一、主题可维护 |
| 后台 | 能查用户和订单 | 权限、审计、手动调整状态 |
| 代码 | AI 能改动 | 团队能长期维护 |

## Sistine Starter

课程配套 Starter，目标是让学员快速上线可收款 AI SaaS。

包含能力：

- 登录
- Creem 支付
- 管理后台
- 积分系统
- 定时任务
- 数据分析
- 多语种
- 邮件
- AI 对话/生图/视频 demo
- 法律页面
- 用户状态管理

技术框架：

- Next.js
- shadcn/ui
- Tailwind CSS
- PostgreSQL
- Drizzle ORM
- BetterAuth
- Creem

## Starter 启动后的第一小时

拿到任何 Starter 后，第一小时不要急着改功能，先做这些事：

1. 本地安装依赖。
2. 跑开发服务器。
3. 打开首页、登录页、价格页、后台。
4. 找到 `.env.example`。
5. 找到数据库 schema。
6. 找到认证配置。
7. 找到支付配置。
8. 找到核心文案文件。
9. 找到 API 路由目录。
10. 让 Codex / Claude Code 生成项目理解文档。

这一步能显著降低后面 AI 改错文件的概率。

## Starter 选择原则

如果目标是快速验证：
优先 ShipAny 或课程配套 Starter。

如果目标是学习架构：
优先 MkSaaS、MakerKit、SupaStarter。

如果目标是长期大项目：
需要关注代码架构、性能、权限模型、数据库设计和可迁移性。

## Starter 改造顺序

推荐顺序：

1. 先改品牌和文案。
2. 再改 Landing Page。
3. 跑通登录。
4. 跑通支付测试模式。
5. 接入核心 AI API。
6. 做免费/付费权限。
7. 做额度或积分。
8. 做结果页和历史记录。
9. 做上线检查。
10. 最后再做 SEO、博客、品牌故事。

不要一开始就改太多底层结构。先让商业闭环跑起来。

## 我的提炼

Starter Kit 是 MicroSaaS 的“基础设施外包”。选 Starter 不是偷懒，而是把低差异化工作交给成熟模板，把稀缺精力留给核心功能、用户反馈和获客。

## 相关链接

- Starter 选择流程：[09 Playbook 4](09-playbooks.md#playbook-4-选择-starter-kit)
- Starter 评估模板：[10 Starter Kit 评估模板](10-prompts-and-templates.md#starter-kit-评估模板)
- 在 Starter 上做开发：[06 AI 编程实操流程](06-ai-dev-workflow.md)
