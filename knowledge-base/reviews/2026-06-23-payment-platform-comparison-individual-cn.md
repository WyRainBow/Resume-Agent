# 中国大陆个人开发者收款平台横评

> 日期：2026-06-23  
> 操作人：coco yu（weiyu9484@gmail.com）  
> 场景：**无营业执照的中国大陆个人开发者**，向全球用户销售 AI 数字产品（一次性额度包）  
> 结论：**Creem 是当前唯一满足全部核心条件的平台**

---

## 核心需求矩阵

| 需求 | 说明 |
|---|---|
| 个人可注册 | 无需营业执照、个体户执照 |
| 卖家出款到大陆 | 支付宝或 PayPal（已有账号）提现 |
| 买家支付宝付款 | 国内用户友好 |
| MoR（商户代理） | 平台替我处理税务/发票/合规 |
| 费率合理 | <6% |
| Webhook 支持 | 支付完成后自动充值 credits |

---

## 平台详细对比

### ✅ Creem（首选）

| 项 | 详情 |
|---|---|
| 官网 | https://www.creem.io |
| 文档 | https://docs.creem.io |
| 个人可用 | ✅ 支持大陆个人注册 |
| 卖家出款 | ✅ **支付宝**（个人，单次 ≤5万 CNY，年约 30–60 万 CNY） |
| 买家支付宝 | ✅ **2026-06-23 确认已上线** |
| 买家微信 | ❌ 暂未支持 |
| MoR | ✅ |
| 费率 | **3.9% + $0.40**（全平台最低之一） |
| Webhook | ✅ 标准 webhook，签名验证 |
| BetterAuth 插件 | ✅ `@creem_io/better-auth` |
| 沙盒 | ✅ Test Mode 可用 |
| 实测案例 | ✅ V2EX 多人实测通过，含保姆级攻略 |

**我们的账号状态：**
- 店铺：`cocResume`，Store ID：`sto_1EAmWgxW0GLmDosgM8Q3ze`
- 产品：Resume Agent AI Credits，$1.99，Active
- KYC：Sumsub 审核，邮件已批准，Dashboard 状态待确认
- KYC 入口：https://www.creem.io/dashboard/balances/accounts

**KYC 通过关键（来自 V2EX 实战）：**
- 网站必须有：隐私政策 `/privacy`、服务条款 `/terms`、联系邮箱 ✅（本项目均已实现）
- 不能有虚假评价、虚假销量描述
- 被拒后逐条回应 + 附证据，3 次以内基本通过
- 整个流程约 11 天（含邮件延迟）

---

### ✅ Gumroad（备选，门槛最低）

| 项 | 详情 |
|---|---|
| 官网 | https://gumroad.com |
| 个人可用 | ✅ 注册极简，几乎无 KYC |
| 卖家出款 | ✅ PayPal（我方已有账号 weiyu9484@gmail.com） |
| 买家支付宝 | ❌ |
| MoR | ✅（2026 年起完整 MoR） |
| 费率 | **10%**（免费版）/ $10/月后 0% |
| Webhook | ⚠️ 有限，自定义充值 credits 需额外开发 |
| 适合场景 | Creem KYC 彻底走不通时的应急方案 |

**缺点：** 费率高，买家无支付宝，Webhook 能力弱，不适合 credits 系统深度集成。

---

### ❌ Polar.sh（大陆不可用）

| 项 | 详情 |
|---|---|
| 官网 | https://polar.sh |
| 费率 | 4% + $0.40（最低） |
| 卖家出款 | ❌ Stripe Connect Express，中国大陆**不在支持列表** |
| 结论 | 费率诱人但大陆卖家无法出款，放弃 |

---

### ❌ Lemon Squeezy（已搁置）

| 项 | 详情 |
|---|---|
| 费率 | 5% + $0.50 |
| 卡点 | Stripe KYC，大陆激活卡走不通 |
| 结论 | 已搁置，不再考虑 |

---

### ⚠️ Paddle（国内微信备用，个人路线复杂）

| 项 | 详情 |
|---|---|
| 个人可用 | ⚠️ 需个体户执照或 Individual 身份验证 |
| 买家微信 | ✅ 一次性购买（桌面端） |
| 买家支付宝 | ✅ 需审批 |
| 费率 | ~5% + $0.50 |
| 现状 | 沙盒可用，KYB 未完成，法务页待部署 |
| 结论 | Creem 上线后如需覆盖微信支付可补充接入 |

---

### ⚠️ Dodo Payments（待验证）

| 项 | 详情 |
|---|---|
| 官网 | https://dodopayments.com |
| 费率 | 4% + $0.40 |
| 声称 | 支持中国卖家，无需注册公司 |
| 出款 | 不明确，疑似 Stripe，大陆可能有障碍 |
| 中文实测 | ❌ 暂无大陆个人开发者实测案例 |
| 结论 | 备选观察，Creem 跑通后无需评估 |

---

### ❌ Stripe / Square / Braintree

大陆个人无法开设账户，不在考虑范围。

---

## 决策树

```
是否急需上线？
├── 是 → Gumroad（当天可开，PayPal 出款）
└── 否 → 继续推进 Creem KYC
         ├── KYC 通过 → 接入 Creem（首选）
         └── KYC 一直被拒 → Gumroad 应急 + 继续申诉 Creem
                            └── 未来如需微信支付 → 补充 Paddle
```

---

## 技术接入优先级

| 阶段 | 平台 | 状态 |
|---|---|---|
| P0 | Creem（沙盒）| 待接入，KYC 确认后即可启动 |
| P1 | Creem（正式）| KYC 通过后切换 |
| P2 | Paddle（微信）| KYB 完成后补充 |
| 应急 | Gumroad | Creem 彻底卡住时启用 |

---

## 相关文档

| 文件 | 说明 |
|---|---|
| `knowledge-base/reviews/2026-06-20-payment-provider-evaluation-pause.md` | 原始三平台探索实录（LS/Paddle/Creem） |
| `knowledge-base/plans/2026-06-20-auth-commercialization-roadmap.md` | 认证商业化总路线图 |
| `knowledge-base/specs/2026-03-31-monetization-model.md` | 早期商业化模型 |

---

## 参考来源

- [creem 支付审核通过！搭配支付宝搞定个人海外收款 - V2EX](https://www.v2ex.com/t/1132849)
- [网站通过 Creem 收款申请啦（保姆级实操）- V2EX](https://www.v2ex.com/t/1183828)
- [Polar 支持国家列表](https://polar.sh/docs/merchant-of-record/supported-countries)
- [Best MoR for Indie Hackers 2026 - Dodo Payments](https://dodopayments.com/blogs/best-merchant-of-record-indie-hackers)
- [Creem 大陆个人收款指南 - CSDN](https://blog.csdn.net/SK_Studio/article/details/153197898)
