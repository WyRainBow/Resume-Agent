# 支付平台选型探索实录（暂停接入）

> 日期：2026-06-20  
> 操作人：coco yu（weiyu9484@gmail.com）  
> 项目：Resume-Agent  
> 分支：`feature/06-20/01`  
> **决策：支付接入暂缓，本文记录三家 MoR 平台探索结论，供恢复时参考**

## 背景

Resume-Agent 认证层（BetterAuth + 用户中心）已基本可用，下一步是商业化收款。操作人为**中国大陆个人开发者、无公司主体**，目标场景：

- 向全球用户销售 AI 简历额度包（一次性数字产品为主）
- 国内用户 ideally 支持微信/支付宝付款
- 卖家侧 ideally 无需营业执照即可收款

本文记录 Lemon Squeezy、Paddle、Creem 三平台实际注册与卡点，以及暂停原因与恢复清单。

---

## 关键结论（先看这个）

| 问题 | 结论 |
|------|------|
| 是否已写 billing 代码？ | ❌ **未开始**（无 checkout / webhook 路由） |
| 哪家最适合大陆个人卖家收款？ | **Creem**（个人支付宝提现）；Paddle 要个体户/身份验证 |
| 哪家支持国内买家微信支付？ | **Paddle**（一次性购买）；Creem **coming soon** |
| Lemon Squeezy 能继续吗？ | ❌ 大陆激活卡 Stripe KYC，暂搁置 |
| 当前决策 | **支付先不做**，优先其他功能；恢复时建议 **Creem（海外+个人收款）+ Paddle（国内微信）** 双轨 |

---

## 平台对比总表

| 维度 | Lemon Squeezy | Paddle | Creem |
|------|---------------|--------|-------|
| 个人注册 | ✅ | ✅（沙盒已用） | ✅ |
| 大陆卖家激活 | ❌ Stripe KYC | ⚠️ 个体户 / 身份验证 | ⚠️ KYC（Sumsub） |
| 卖家收款（大陆个人） | PayPal（未连通） | Paddle 结算 / 银行 | **支付宝**（个人，有年限额） |
| 买家微信支付 | ✅ 一次性 | ✅ 一次性（桌面端） | ❌ coming soon |
| 买家支付宝 | ✅ 一次性 | ✅ 需审批 | ❌ coming soon |
| 费率 | ~5% + $0.50 | ~5% + $0.50 | **3.9% + $0.40** |
| BetterAuth 官方插件 | ❌ | ❌ | ✅ `@creem_io/better-auth` |
| 代码集成状态 | 0% | 0% | 0% |

---

## 一、Lemon Squeezy

> 详见：`knowledge-base/reviews/2026-06-20-lemonsqueezy-paypal-setup.md`

### 已完成

- 店铺 `cocoyu`（国家 China）已创建
- PayPal 已注册（weiyu9484@gmail.com），银联卡已绑，PayPal.Me = `cocoyuResume`

### 卡点

- 点「激活店铺」「身份验证」均报错：**大陆不支持 Stripe**
- 银行转账收款在大陆不可用
- 自助激活内部依赖 Stripe KYC，大陆个人走不通

### 状态

**搁置**。可选后续：邮件 `support@lemonsqueezy.com` 申请人工开通，或放弃改 Creem/Paddle。

---

## 二、Paddle

### 已完成

- 账号已注册，沙盒产品创建成功
- Checkout settings 已勾选 **WeChat Pay**
- 入驻流程中填写了产品说明（Resume-Agent SaaS / 一次性额度包）
- 企业类型页选择 **个体工商户**（尚未有执照）

### 卡点

| 页面 / 环节 | 问题 |
|-------------|------|
| Checkout settings → 默认付款链接 | 为空时无法保存，报错「创建交易需要默认付款链接」 |
| 网站审核页 | 需 `resumegenkk.xyz` + `/pricing` `/terms` `/privacy` `/refund`，**站点尚未上线这些页面** |
| 设置账户 → 商业时代（成立年月） | 无公司无法如实填写；个人应走 Individual，或办个体户 |
| Go Live KYB | 个体工商户路线需营业执照 |

### Paddle 微信支付条件（官方）

- 一次性购买 ✅；订阅 ❌
- 货币 CNY 或 USD；客户地址在中国；**桌面端**结账
- 卖家无需微信商户号
- 开启路径：Checkout → Checkout settings → WeChat Pay

### 状态

**沙盒可继续测，Live 审核暂停**。默认付款链接建议填：`https://resumegenkk.xyz`

---

## 三、Creem

### 已完成

- 账号已注册，店铺 **cocResume**
- Store ID：`sto_1EAmWgxW0GLmDosgM8Q3ze`
- 产品 **Resume Agent AI Credits** 已创建：Active，**$1.99**，Single Payment
- Test Mode 可用；Share 结账链接可生成

### 失败页面（具体）

**不是**产品创建页或定价页失败。

失败发生在：

```text
Creem Dashboard → Finance / Balance → Payout Account → Sumsub 身份验证（KYC）
```

- 拒因文案：`Identity verification needs changes`
- 审核方：Sumsub（第三方合规）
- Creemie 客服：需**人工合规团队**处理，无法由 AI 直接重审
- 已留言人工客服，含 Store ID；团队离线时预计约 48–58 小时响应

### 大陆个人收款（官方文档）

来源：<https://docs.creem.io/merchant-of-record/finance/payouts#china>

| 身份 | 提现方式 | 限额 |
|------|----------|------|
| 个人收款人 | **支付宝** | 单次 ≤ 5 万 CNY；年约 30–60 万 CNY |
| 收款方（企业） | 本地银行账户 | 无上限 |

- 中国已在 [Supported Countries](https://docs.creem.io/merchant-of-record/supported-countries)（86 国）列表
- Go Live 流程：Business Details → KYC/KYB → Payout Account → Creem 审核 → Live
- 个人应走 **Individual + 支付宝**，无需公司（与 Paddle 个体户路线对比更轻）

### 买家支付方式（官方 FAQ）

- 当前：信用卡、PayPal、Apple Pay、Google Pay、部分地区本地支付
- **微信支付、支付宝付款：coming soon**（结账端尚未上线）

### 状态

**KYC 待人工复核**；产品与沙盒开发可并行，Live 收款需 KYC 通过。

---

## 四、Resume-Agent 代码与站点现状

| 项 | 状态 |
|----|------|
| `POST /api/billing/*` checkout / webhook | ❌ 未实现 |
| `better_auth_entitlements` 充值逻辑 | ❌ 未实现 |
| `/account` 购买按钮 | ❌ 未实现 |
| 环境变量 `PADDLE_*` / `CREEM_*` | ❌ 未配置 |
| `resumegenkk.xyz` 法务页 `/terms` `/privacy` `/refund` | ⚠️ **前端已实现待部署**（2026-06-23，`17de7b6`；首页页脚已可点击）；`/pricing` 仍未做 |
| 路线图 | `knowledge-base/plans/2026-06-20-auth-commercialization-roadmap.md` |

### 恢复接入时推荐技术路线

```text
billing provider 抽象（paddle | creem）

Creem 路径（优先，与 BetterAuth 同栈）：
  web/ + @creem_io/better-auth 或 FastAPI webhook
  环境变量：CREEM_API_KEY、CREEM_WEBHOOK_SECRET、CREEM_PRODUCT_ID
  事件：checkout.completed → 更新 better_auth_entitlements.credits

Paddle 路径（国内买家微信）：
  POST /api/billing/paddle/checkout + webhook
  环境变量：PADDLE_API_KEY、PADDLE_PRICE_ID、PADDLE_WEBHOOK_SECRET
  事件：transaction.completed（微信延迟到账，勿仅用 checkout.completed）

前端：
  /account「购买额度」→ 按用户地区或配置选择 provider
```

---

## 五、暂停原因与恢复条件

### 暂停原因

1. **卖家审核均未完成**：LS 卡 Stripe；Paddle 要网站法务页 + 个体户/身份；Creem KYC 被 Sumsub 拒、等人工
2. **国内买家微信**：仅 Paddle 可用，Creem 尚未支持
3. **业务优先级**：认证与用户中心已可用，支付集成分散精力，先聚焦其他功能

### 恢复前建议完成的准备

- [~] `resumegenkk.xyz` 法务页：`/terms` `/privacy` `/refund` 前端已实现 + 首页页脚可点击（2026-06-23，`17de7b6`），**待部署**；`/pricing` 仍未做
- [ ] Creem：按人工客服指引修正 KYC 材料（Individual、证件清晰、姓名与支付宝一致）
- [ ] Paddle：填默认付款链接；个体户执照或改 Individual；沙盒测试卡 `4242...` 跑通
- [ ] 确定主力 provider：大陆个人收款优先 **Creem**；国内买家微信优先 **Paddle**
- [ ] 实现 billing 抽象 + webhook + entitlements 充值

---

## 六、账号与资产清单

| 平台 | 标识 | 备注 |
|------|------|------|
| Lemon Squeezy | 店铺 `cocoyu` | 未激活 |
| PayPal | weiyu9484@gmail.com，PayPal.Me `cocoyuResume` | 已绑银联卡 |
| Paddle | 沙盒产品已建 | 微信已勾选；KYB 未完成 |
| Creem | `sto_1EAmWgxW0GLmDosgM8Q3ze`，产品 $1.99 | KYC 待人工 |
| 主站 | https://resumegenkk.xyz | 法务页待补 |
| 规划认证域 | https://auth.resumegenkk.xyz | 未部署 |

---

## 七、相关文档

| 文件 | 说明 |
|------|------|
| `knowledge-base/plans/2026-06-20-auth-commercialization-roadmap.md` | 认证商业化总路线图 |
| `knowledge-base/reviews/2026-06-20-lemonsqueezy-paypal-setup.md` | LS + PayPal 详细实录 |
| `knowledge-base/specs/2026-03-31-monetization-model.md` | 早期商业化模型（支付待定） |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 完成 LS / Paddle / Creem 探索；决定**支付接入暂停**；本文建档 |
| 2026-06-23 | 法务页前端落地（`17de7b6`），同步「代码现状」与「恢复前准备」中法务页状态为待部署；支付仍暂停 |