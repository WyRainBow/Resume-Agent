# 03 用户中心、登录与权限

来源页码：Page 021-034, Page 083-086

## 不要自己造登录系统

登录看起来只是表单，背后是完整安全体系：

- 密码加密
- session 管理
- token 管理
- 忘记密码
- 邮件发送
- OAuth 回调
- CSRF 和暴力破解防护

课程判断：这些不是 MicroSaaS 早期最该投入的地方，应该用现成方案。

## 为什么登录会变成商业问题

登录不是技术边角料。它决定你能不能识别用户，也决定你能不能做商业化：

- 匿名用户不能可靠记录额度。
- 免费用户需要记录每日次数、历史记录和付费引导。
- 付费用户需要记录订阅状态、积分余额、套餐等级。
- 后台需要知道谁付款了、谁取消了、谁滥用额度。

没有稳定的登录和用户表，支付、积分、订阅、后台都会变得不可靠。

## 推荐方向

Clerk / Auth0：
托管服务，接入快，文档好，但后期成本和用户数据归属需要考虑。

Supabase：
认证、数据库、存储一体化，适合很多早期项目。

BetterAuth：
课程主要推荐。开源免费，数据存在自己的数据库里，和 Next.js + Neon + Vercel 配合顺。

## 方案选择对比

| 方案 | 优点 | 风险 | 适合情况 |
| --- | --- | --- | --- |
| Clerk/Auth0 | 接入最快，体验成熟 | 用户量上来后成本高，数据托管在第三方 | 想最快上线，不想管认证细节 |
| Supabase Auth | 认证、数据库、存储一体 | 和 Supabase 生态绑定较深 | 已经使用 Supabase |
| BetterAuth | 开源免费，数据在自己库里 | 需要自己理解配置和数据库 | Next.js + Neon + Vercel 项目 |

课程偏向 BetterAuth 的原因不是它永远最好，而是它在“成本、数据归属、现代全栈适配”之间比较均衡。

## BetterAuth 思路

BetterAuth 负责认证流程，用户数据、session、OAuth token 等存进自己的 Neon PostgreSQL 数据库。

常见配置：

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`

开发环境回调：

`http://localhost:3000/api/auth/callback/google`

生产环境回调：

`https://你的域名/api/auth/callback/google`

注意：OAuth 回调 URL 必须和代码配置完全一致。

## BetterAuth 接入流程

1. 安装依赖：`better-auth` 和数据库驱动。
2. 创建认证配置文件，例如 `lib/auth.ts`。
3. 配置数据库连接 `DATABASE_URL`。
4. 配置 OAuth provider，例如 Google。
5. 运行迁移，创建 user、session、account、verification 等表。
6. 创建 API 路由，例如 `app/api/auth/[...all]/route.ts`。
7. 在前端接入 session client。
8. 配置 `.env.local`。
9. 在 Google Cloud Console 配置回调 URL。
10. 本地测试登录，再部署到线上测试。

常见错误：

- `BETTER_AUTH_URL` 与实际开发端口不一致。
- Google 回调 URL 多了或少了斜杠。
- 生产域名上线后忘记在 Google Cloud Console 添加新的 redirect URI。
- 本地 `.env.local` 配了，Vercel 环境变量没配。

## 为什么优先 Google 登录

海外用户使用 Google 登录习惯更强。

Google 登录绑定真实账号，有一定注册门槛，可以减少临时邮箱滥用，尤其当产品有免费试用、免费额度或积分机制时。

邮箱登录可以作为补充，但不一定要作为唯一入口。

## Google 登录的产品价值

Google 登录不仅是方便，也是一层轻量风控。

对于有免费额度的产品，如果只支持邮箱登录，用户可以用临时邮箱反复注册，绕过免费限制。Google 账号虽然不是绝对防滥用，但门槛更高，足以减少早期很多低价值攻击。

但也要注意：如果目标用户在某些地区或行业不方便使用 Google，则应该补充邮箱登录、GitHub 登录或 magic link。

## 三类用户模型

匿名用户：
不知道是谁。目标是展示价值，引导登录。不能开放太多，也不能什么都不给看。

免费登录用户：
已经给出信任，但还没付钱。目标是让他用到免费额度边界，并在最需要的时候看到付费价值。

付费用户：
已经付钱。目标不是结束，而是续费、升级、复购、购买额外积分。

## 三类用户应该看到什么

匿名用户：

- 能看到产品价值、示例结果、价格。
- 可以体验非常有限的 demo，或完全要求登录。
- CTA 应该是登录或免费开始。

免费用户：

- 能使用核心功能的轻量版本。
- 能看到剩余额度。
- 能看到付费后能获得什么。
- 在接近额度上限时出现付费引导。

付费用户：

- 能使用完整权益。
- 能查看订阅状态、额度、账单入口。
- 能购买额外积分或升级套餐。
- 应该减少干扰性付费弹窗，转向续费和复购体验。

## 权限判断伪代码

```ts
const { data: session } = authClient.useSession();
const isPaid = session?.user?.isPaid;

if (!session) {
  return <ShowValueAndLoginPrompt />;
}

if (!isPaid) {
  return <FreeUserView />;
}

return <PaidUserView />;
```

## 数据模型建议

最小字段：

```text
user.id
user.email
user.name
user.image
user.createdAt
user.isPaid
user.plan
user.credits
user.dailyUsageCount
user.lastUsageResetAt
subscription.status
subscription.provider
subscription.providerCustomerId
subscription.providerSubscriptionId
subscription.currentPeriodEnd
```

实际项目里字段名称会因 Starter 而异，重点是能回答：

- 这个用户是谁？
- 他现在能不能用？
- 他能用多少次？
- 他为什么被限制？
- 支付后怎么恢复权益？

## 用户中心要解决的问题

- 用户身份是谁？
- 是否登录？
- 是否付费？
- 还有多少额度？
- 有哪些功能可用？
- 什么时候引导升级？
- 什么时候允许复购？

## 用户中心页面模块

一个能支撑商业化的用户中心通常包括：

- Profile：头像、邮箱、登录方式。
- Plan：当前套餐、订阅状态、到期时间。
- Usage：今日次数、本月额度、积分余额。
- Billing：管理订阅、发票、取消或升级入口。
- History：生成历史、下载记录。
- Settings：语言、通知、删除账号。

早期可以做得很简单，但不要完全没有。否则用户付费后不知道自己买到了什么，也不知道额度如何消耗。

## 验收清单

- 匿名用户访问核心功能时是否被正确引导登录？
- Google 登录是否成功？
- 刷新页面后 session 是否保持？
- 免费用户是否能看到额度？
- 免费用户达到限制后是否被引导付费？
- 付费用户是否绕过免费限制？
- 退出登录后是否不能访问付费资源？
- 线上域名的 OAuth 回调是否正确？

## 我的提炼

登录不是“进门按钮”，而是商业化分层的起点。MicroSaaS 的用户中心要为付费墙、额度、积分、订阅状态、复购和后台管理服务。

## 相关链接

- 支付后权益变化：[04 海外支付、订阅与 Webhook](04-payment-webhook.md)
- Starter 如何提供认证底座：[05 Starter Kit 与技术底座](05-starter-kit.md)
- 用户分层提示词：[10 用户分层设计提示词](10-prompts-and-templates.md#用户分层设计提示词)
