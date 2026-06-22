# 04 海外支付、订阅与 Webhook

来源页码：Page 034-060

## 支付是新手最大门槛之一

支付接入难，不是因为单个 API 难，而是它牵涉很多背景知识：

- 支付网关
- Checkout
- Payment Intent
- 订阅计划
- Webhook
- 测试模式
- 正式环境
- 退款和争议
- 权限开通
- 异常处理

课程建议：放平心态，先用测试模式跑通。

## 支付系统要解决的真实问题

支付不是让用户刷一下卡。对 MicroSaaS 来说，它至少要解决：

- 用户如何选择套餐。
- 用户如何进入收银台。
- 支付平台如何确认付款。
- 你的系统如何知道用户付了钱。
- 用户权益如何自动开通。
- 订阅取消、续费失败、退款时如何处理。
- 免费用户如何升级，付费用户如何管理订阅。

如果只做到了“按钮能打开支付页”，还不算完成支付接入。

## 基础概念

支付网关：
连接网站和银行/支付处理商的桥梁。

Checkout：
托管支付页面，支付平台帮你生成订单和收银台，接入快，但用户会跳转到平台域名。

Payment Intent：
更偏自建支付流程，只代表一笔支付意向。订单、商品和权限状态通常要自己维护。

Webhook：
支付平台在事件发生后主动通知你的服务器，例如支付成功、订阅创建、订阅取消。

## 支付闭环

标准闭环：

```text
Pricing 页面
-> 用户点击订阅
-> 后端创建 Checkout Session
-> 用户在支付平台付款
-> 支付平台跳回 Return URL
-> 支付平台发送 Webhook
-> 服务器验签
-> 写入订单/订阅状态
-> 前端重新读取用户权益
-> 用户看到付费功能已解锁
```

Return URL 只能说明用户浏览器跳回来了，不能作为开通权益的唯一依据。真正可靠的状态更新应该以 Webhook 为准。

## 对中国开发者友好的支付平台

Stripe：
最强、最成熟，但中国个人开发者接入门槛较高。

Paddle：
Merchant of Record 模式，风控和审核介于 Stripe 与 Creem 之间。

Creem：
课程重点推荐之一，对中国开发者友好，适合 SaaS 订阅业务，测试模式和订阅组件上手较快。

Dodo Payments：
也是推荐新手尝试的方向，有 Next.js 示例和 Supabase 相关 starter。

Waffo：
课程中提到，但公开教程和代码相对少。

## 平台选择思路

如果你是中国个人开发者，新手阶段优先考虑：

- 是否能用中国身份注册。
- 是否支持测试模式。
- 是否有 Next.js 示例。
- 是否支持订阅。
- 是否处理税务和合规。
- 是否有清楚的 Webhook 文档。
- 是否容易提现。

不要只看平台名气。Stripe 很强，但如果注册、收款、合规门槛卡住你，就不一定是早期最优解。

## Creem 配置要点

常见环境变量：

```env
CREEM_API_KEY=你的 Creem API Key
CREEM_BASE_URL=https://test-api.creem.io
CREEM_PRODUCT_ID=你的产品 ID
CREEM_WEBHOOK_SECRET=你的 Webhook Secret
```

Webhook 路径示例：

`src/app/api/webhooks/creem/route.ts`

Webhook URL 示例：

`https://你的域名/api/webhooks/creem`

流程：

1. 注册/登录 Creem。
2. 打开测试模式。
3. 进入开发者模式。
4. 创建并复制 API Key。
5. 创建 Webhook，复制 secret。
6. 创建产品，复制 product id。
7. 写入 `.env.local`。
8. 让 AI 阅读官方文档并补齐 checkout、webhook、成功回跳页、数据库状态更新。
9. 用测试卡测试支付。

## Creem 代码侧通常要做什么

常见改动：

- `pricing` 页面：展示套餐和订阅按钮。
- `create-checkout` API：根据用户和产品创建 checkout session。
- `webhooks/creem/route.ts`：接收支付事件。
- 数据库表：记录订单、订阅、用户套餐、积分。
- 成功页：告诉用户支付完成，等待权益同步。
- 用户中心：展示当前 plan 和订阅状态。

关键点：

- API Key 只在服务端使用。
- Webhook Secret 用来验签。
- Product ID / Price ID 要和 Creem 后台一致。
- 测试环境和正式环境的 Base URL 不要混用。

## Dodo Payments 配置要点

常见环境变量：

```env
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PAYMENTS_RETURN_URL=http://你的域名/pricing/success
DODO_PAYMENTS_PRODUCT_ID=你的产品ID
DODO_PAYMENTS_WEBHOOK_KEY=你的Webhook Signing Key
```

## Webhook 调试

支付平台无法访问本地 `localhost`，所以调试 Webhook 要有公网地址。

两种方式：

使用本地隧道：
例如 ngrok、Cloudflare Tunnel、Localtunnel。

使用 Vercel 部署地址：
把代码推到 GitHub，由 Vercel 部署，使用 Vercel 的公网 URL 接收 Webhook。

## Webhook 处理原则

Webhook 必须做到：

- 验签：确认事件真的来自支付平台。
- 幂等：同一个事件重复发送时不能重复开通或重复加积分。
- 可追踪：记录 provider event id、用户 id、订阅 id、处理时间。
- 可重试：失败时能从日志判断发生了什么。
- 不信任前端：不要因为用户访问成功页就开通权益。

常见事件：

- checkout completed
- subscription created
- subscription renewed
- subscription canceled
- payment failed
- refund created

早期可以只处理最核心的支付成功和订阅取消，但要知道后面会补哪些事件。

## 支付接入后必须确认

- 支付按钮能拉起 Checkout。
- 测试卡支付成功。
- 支付成功页能回跳。
- Webhook 能收到事件。
- Webhook 签名验证正确。
- 数据库订单/订阅/会员状态更新正确。
- 免费用户和付费用户权限发生变化。
- Vercel 环境变量和本地环境变量一致。

## 数据库状态设计

最小可用设计：

```text
users
- id
- email
- plan
- isPaid
- credits

subscriptions
- id
- userId
- provider
- providerCustomerId
- providerSubscriptionId
- status
- currentPeriodStart
- currentPeriodEnd

payments
- id
- userId
- provider
- providerEventId
- amount
- currency
- status
- rawEvent
```

如果是积分制，还需要：

```text
credit_transactions
- id
- userId
- amount
- reason
- providerPaymentId
- createdAt
```

## 常见坑

- 本地 Webhook 地址是 `localhost`，支付平台访问不到。
- 测试环境 product id 写到了正式环境。
- Webhook 路由路径和后台配置不一致。
- 签名验证失败但没有日志。
- 支付成功后只跳转成功页，数据库没有更新。
- 用户付费了但 session 缓存没刷新，前端还显示免费状态。
- `.env.local` 配好了，但 Vercel 环境变量漏配。

## 我的提炼

支付不是一个按钮，而是一条闭环：套餐展示 -> 创建 checkout -> 用户支付 -> 平台回调 webhook -> 验签 -> 更新数据库 -> 前端权限变化 -> 用户看到权益。

早期最重要的不是一次写出完美支付系统，而是在测试模式下把这条闭环跑通。

## 相关链接

- 支付依赖用户状态：[03 用户中心、登录与权限](03-auth-user-center.md)
- 支付接入步骤：[09 Playbook 3](09-playbooks.md#playbook-3-接入订阅支付)
- 支付接入提示词：[10 支付接入提示词](10-prompts-and-templates.md#支付接入提示词)
- 上线前支付检查：[07 支付上线前检查](07-launch-checklist.md#支付上线前检查)
