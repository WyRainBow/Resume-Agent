# 用户中心 + 额度显示 + Mock 支付闭环 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不接入真实支付的前提下，把完整产品闭环跑通——用户能看到自己的额度、访问用户中心、在定价页用 Mock 支付购买额度，为后续接入 Creem 预留接口。

**Architecture:** 后端新增 `POST /api/billing/mock-checkout` 直接更新 `BetterAuthEntitlement.credits`；前端在 AuthContext 登录后拉取 `/api/auth/better/account` 把 `credits/plan` 注入 User 状态；`UserMenu` 组件展示额度徽章并链接到新建的 `/account`（用户中心）和 `/pricing`（定价/购买）页面。

**Tech Stack:** FastAPI · SQLAlchemy · React 18 · TypeScript · React Router v6 · Tailwind CSS · axios · lucide-react

---

## 文件地图

| 操作 | 文件 |
|---|---|
| **新建** | `backend/routes/billing.py` |
| **新建** | `frontend/src/pages/Account/index.tsx` |
| **新建** | `frontend/src/pages/Pricing/index.tsx` |
| **修改** | `backend/routes/__init__.py` |
| **修改** | `backend/main.py` |
| **修改** | `frontend/src/services/api.ts` |
| **修改** | `frontend/src/contexts/AuthContext.tsx` |
| **修改** | `frontend/src/components/UserMenu.tsx` |
| **修改** | `frontend/src/App.tsx` |

---

## Task 1：后端 — Mock Checkout 路由

**Files:**
- Create: `backend/routes/billing.py`

- [ ] **Step 1: 创建 billing.py**

```python
"""
Billing routes — mock checkout for development.
Real Creem webhook handler will replace mock_checkout when payment goes live.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.better_auth import BetterAuthUser, get_current_better_auth_user
from backend.services.better_auth_entitlements import get_or_create_entitlement

router = APIRouter(prefix="/api/billing", tags=["Billing"])

MOCK_PLANS = {
    "starter": {"credits": 50,  "plan": "starter"},
    "pro":     {"credits": 200, "plan": "pro"},
}


class MockCheckoutRequest(BaseModel):
    package: str  # "starter" | "pro"


class EntitlementResponse(BaseModel):
    plan: str
    credits: int
    daily_usage_count: int
    subscription_status: str


@router.post("/mock-checkout", response_model=EntitlementResponse)
async def mock_checkout(
    body: MockCheckoutRequest,
    current_user: BetterAuthUser = Depends(get_current_better_auth_user),
    db: Session = Depends(get_db),
) -> EntitlementResponse:
    """Mock 支付：直接充值 credits，无真实扣款。上线 Creem 后替换此端点。"""
    pkg = MOCK_PLANS.get(body.package)
    if not pkg:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown package: {body.package}")

    entitlement = get_or_create_entitlement(db, current_user)
    entitlement.credits += pkg["credits"]
    entitlement.plan = pkg["plan"]
    entitlement.subscription_status = "active"
    db.commit()
    db.refresh(entitlement)

    return EntitlementResponse(
        plan=entitlement.plan,
        credits=entitlement.credits,
        daily_usage_count=entitlement.daily_usage_count,
        subscription_status=entitlement.subscription_status,
    )
```

- [ ] **Step 2: 注册到 `backend/routes/__init__.py`**

在文件末尾 `__all__` 之前添加一行 import，并把 `billing_router` 加入 `__all__`：

```python
# 在现有 import 列表末尾追加
from .billing import router as billing_router
```

`__all__` 列表里追加：
```python
'billing_router',
```

- [ ] **Step 3: 注册到 `backend/main.py`**

在 `leetcode_router = routes_module.leetcode_router` 行之后追加：

```python
billing_router = routes_module.billing_router
```

在 `app.include_router(leetcode_router)` 行之后追加：

```python
app.include_router(billing_router)
```

- [ ] **Step 4: 验证后端启动无报错**

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000 &
curl -s http://127.0.0.1:9000/docs | grep -o "mock-checkout"
# 期望输出: mock-checkout
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add backend/routes/billing.py backend/routes/__init__.py backend/main.py
git commit -m "feat(billing): add mock-checkout endpoint for credits pre-charge"
```

---

## Task 2：前端 api.ts — 新增 entitlement 和 mock checkout 调用

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: 在文件顶部（`PdfDownloadQuota` 类型定义之前）追加类型和函数**

在 `api.ts` 现有 `export type PdfDownloadQuota` 之前插入：

```typescript
export type UserEntitlement = {
  plan: string
  credits: number
  daily_usage_count: number
  subscription_status: string
}

export async function fetchUserEntitlement(): Promise<UserEntitlement> {
  const { data } = await axios.get(`${getApiBaseUrl()}/api/auth/better/account`, {
    headers: getAuthHeaders(),
  })
  return (data as { entitlement: UserEntitlement }).entitlement
}

export async function mockCheckout(packageName: 'starter' | 'pro'): Promise<UserEntitlement> {
  const { data } = await axios.post(
    `${getApiBaseUrl()}/api/billing/mock-checkout`,
    { package: packageName },
    { headers: getAuthHeaders() },
  )
  return data as UserEntitlement
}
```

- [ ] **Step 2: 前端构建验证**

```bash
cd frontend && npm run build 2>&1 | tail -5
# 期望: ✓ built in ...
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(api): add fetchUserEntitlement and mockCheckout"
```

---

## Task 3：AuthContext — User 类型加 credits/plan，登录后拉取额度

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: 扩展 User 类型（第 13 行附近）**

将现有：
```typescript
type User = {
  id: number
  username: string
  email?: string
  image?: string | null
  betterAuthUserId?: string
}
```
替换为：
```typescript
type User = {
  id: number
  username: string
  email?: string
  image?: string | null
  betterAuthUserId?: string
  credits?: number
  plan?: string
}
```

- [ ] **Step 2: 在 import 行添加 fetchUserEntitlement**

将现有第 1 行附近的 services 导入追加：
```typescript
import { fetchUserEntitlement } from '@/services/api'
```

- [ ] **Step 3: 在 BetterAuth session 成功后拉取额度**

找到 `AuthContext.tsx` 中的这段代码：
```typescript
          if (sessionUser) {
            setUser(mapBetterAuthUser(sessionUser))
            setToken(BETTER_AUTH_TOKEN)
            // 异步回填真实 legacy user.id
            void fetchLegacyUserId().then((legacyId) => {
              if (legacyId) {
                setUser((prev) => (prev ? { ...prev, id: legacyId } : prev))
              }
            })
            return
          }
```

替换为：
```typescript
          if (sessionUser) {
            setUser(mapBetterAuthUser(sessionUser))
            setToken(BETTER_AUTH_TOKEN)
            void fetchLegacyUserId().then((legacyId) => {
              if (legacyId) {
                setUser((prev) => (prev ? { ...prev, id: legacyId } : prev))
              }
            })
            // 异步拉取额度，不阻塞首屏
            void fetchUserEntitlement().then((ent) => {
              setUser((prev) =>
                prev ? { ...prev, credits: ent.credits, plan: ent.plan } : prev,
              )
            }).catch(() => {/* 拉取失败不影响登录态 */})
            return
          }
```

- [ ] **Step 4: 导出 refreshEntitlement 供 Pricing 页调用**

在 `AuthContextValue` type 里追加：
```typescript
  refreshEntitlement: () => Promise<void>
```

在 `AuthProvider` 函数体内（`logout` useCallback 之后）追加：
```typescript
  const refreshEntitlement = useCallback(async () => {
    try {
      const ent = await fetchUserEntitlement()
      setUser((prev) => (prev ? { ...prev, credits: ent.credits, plan: ent.plan } : prev))
    } catch {
      // ignore
    }
  }, [])
```

在 `value` useMemo 里追加 `refreshEntitlement`：
```typescript
  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && (token || user.betterAuthUserId)),
      login,
      register,
      logout,
      refreshEntitlement,
      isModalOpen,
      openModal,
      closeModal,
      modalMode
    }),
    [user, token, loading, login, register, logout, refreshEntitlement, isModalOpen, openModal, closeModal, modalMode]
  )
```

- [ ] **Step 5: 构建验证**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx
git commit -m "feat(auth): inject credits/plan into User state after BetterAuth login"
```

---

## Task 4：UserMenu — 额度徽章 + 账户/定价链接

**Files:**
- Modify: `frontend/src/components/UserMenu.tsx`

- [ ] **Step 1: 替换 UserMenu 全文**

```typescript
import React from 'react'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function UserMenu() {
  const { user, isAuthenticated, logout, openModal } = useAuth()

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => openModal('login')}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        登录/注册
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {/* 额度徽章 */}
      <Link
        to="/pricing"
        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-colors"
        title="查看套餐 / 购买额度"
      >
        <Zap className="w-3 h-3" />
        {user?.credits ?? 0} 额度
      </Link>

      {/* 用户名 → 账户页 */}
      <Link
        to="/account"
        className="text-sm text-gray-700 hover:text-gray-900 hover:underline"
      >
        {user?.username || user?.email}
      </Link>

      <button
        className="text-sm text-gray-500 hover:text-gray-900"
        onClick={logout}
      >
        退出
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 构建验证**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/UserMenu.tsx
git commit -m "feat(ui): add credits badge and account/pricing links to UserMenu"
```

---

## Task 5：新建 `/account` 用户中心页面

**Files:**
- Create: `frontend/src/pages/Account/index.tsx`

- [ ] **Step 1: 创建页面文件**

```bash
mkdir -p frontend/src/pages/Account
```

- [ ] **Step 2: 写入 Account/index.tsx**

```typescript
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Zap, LogOut, ArrowLeft, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const PLAN_LABEL: Record<string, string> = {
  free: '免费版',
  starter: 'Starter',
  pro: 'Pro',
}

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-slate-100 text-slate-600',
  starter: 'bg-blue-50 text-blue-600',
  pro: 'bg-purple-50 text-purple-600',
}

export default function AccountPage() {
  const { user, isAuthenticated, logout, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-slate-600">请先登录</p>
        <Link to="/" className="text-blue-500 hover:underline text-sm">返回首页</Link>
      </div>
    )
  }

  const plan = user?.plan || 'free'
  const credits = user?.credits ?? 0

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-lg mx-auto px-4 py-10">
        {/* 返回 */}
        <Link
          to="/my-resumes"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          返回简历列表
        </Link>

        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">我的账户</h1>

        {/* 个人信息卡 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">个人信息</h2>
          <div className="flex items-center gap-4">
            {user?.image ? (
              <img src={user.image} alt="avatar" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-7 h-7 text-blue-500" />
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{user?.username || '未设置昵称'}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                {user?.email || '未绑定邮箱'}
              </p>
            </div>
          </div>
        </div>

        {/* 套餐与额度卡 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">套餐与额度</h2>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-600 dark:text-slate-300">当前套餐</span>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${PLAN_COLOR[plan] || PLAN_COLOR.free}`}>
              {PLAN_LABEL[plan] || plan}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-600 dark:text-slate-300">剩余额度</span>
            </div>
            <span className="text-xl font-black text-blue-600">{credits}</span>
          </div>
          <Link
            to="/pricing"
            className="mt-4 block w-full text-center py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-colors"
          >
            购买额度
          </Link>
        </div>

        {/* 退出 */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-100 text-red-500 hover:bg-red-50 text-sm font-semibold transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 构建验证**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

---

## Task 6：新建 `/pricing` 定价页（含 Mock 购买按钮）

**Files:**
- Create: `frontend/src/pages/Pricing/index.tsx`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p frontend/src/pages/Pricing
```

- [ ] **Step 2: 写入 Pricing/index.tsx**

```typescript
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Zap, ArrowLeft } from 'lucide-react'
import { mockCheckout } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'

const PACKAGES = [
  {
    id: 'free' as const,
    name: '免费版',
    price: '¥0',
    credits: 0,
    description: '适合体验和轻度使用',
    features: ['5 次 AI 简历生成', '基础模板', 'PDF 导出'],
    cta: '当前套餐',
    disabled: true,
    highlight: false,
  },
  {
    id: 'starter' as const,
    name: 'Starter',
    price: '¥14',
    credits: 50,
    description: '适合求职冲刺阶段',
    features: ['50 次 AI 额度', '全部模板', 'PDF 导出', 'Agent 对话修改'],
    cta: '立即购买',
    disabled: false,
    highlight: false,
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '¥39',
    credits: 200,
    description: '适合高频使用或多岗位投递',
    features: ['200 次 AI 额度', '全部模板', 'PDF 导出', 'Agent 对话修改', '优先支持'],
    cta: '立即购买',
    disabled: false,
    highlight: true,
  },
] as const

type PackageId = 'starter' | 'pro'

export default function PricingPage() {
  const { user, isAuthenticated, openModal, refreshEntitlement } = useAuth()
  const [loading, setLoading] = useState<PackageId | null>(null)
  const [done, setDone] = useState<PackageId | null>(null)

  const handleBuy = async (pkgId: PackageId) => {
    if (!isAuthenticated) {
      openModal('login')
      return
    }
    setLoading(pkgId)
    try {
      await mockCheckout(pkgId)
      await refreshEntitlement()
      setDone(pkgId)
    } catch (e) {
      alert('购买失败，请稍后重试')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link
          to="/my-resumes"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-3">选择套餐</h1>
          <p className="text-slate-500">按需购买，无订阅，永不过期</p>
          {isAuthenticated && user?.credits !== undefined && (
            <p className="mt-2 text-sm text-blue-600 font-medium">
              当前剩余：<span className="font-black">{user.credits}</span> 额度
            </p>
          )}
          {/* 开发阶段提示 */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
            <Zap className="w-3.5 h-3.5" />
            当前为测试模式，购买不扣款，额度直接到账
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative rounded-2xl p-6 border transition-all ${
                pkg.highlight
                  ? 'bg-blue-500 text-white border-blue-400 shadow-xl shadow-blue-100 scale-105'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-100 dark:border-slate-700 shadow-sm'
              }`}
            >
              {pkg.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-amber-400 text-amber-900 text-xs font-black">
                  推荐
                </div>
              )}

              <h3 className={`text-lg font-black mb-1 ${pkg.highlight ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                {pkg.name}
              </h3>
              <p className={`text-sm mb-4 ${pkg.highlight ? 'text-blue-100' : 'text-slate-500'}`}>
                {pkg.description}
              </p>

              <div className="mb-6">
                <span className={`text-4xl font-black ${pkg.highlight ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                  {pkg.price}
                </span>
                {pkg.credits > 0 && (
                  <span className={`ml-2 text-sm ${pkg.highlight ? 'text-blue-100' : 'text-slate-400'}`}>
                    / {pkg.credits} 额度
                  </span>
                )}
              </div>

              <ul className="space-y-2.5 mb-8">
                {pkg.features.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-sm ${pkg.highlight ? 'text-blue-50' : 'text-slate-600 dark:text-slate-300'}`}>
                    <Check className={`w-4 h-4 shrink-0 ${pkg.highlight ? 'text-white' : 'text-blue-500'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              {pkg.disabled ? (
                <div className={`w-full text-center py-2.5 rounded-xl text-sm font-bold ${pkg.highlight ? 'bg-blue-400 text-blue-100' : 'bg-slate-100 text-slate-400'}`}>
                  {user?.plan === 'free' || !user?.plan ? '当前套餐' : '免费版'}
                </div>
              ) : (
                <button
                  onClick={() => handleBuy(pkg.id as PackageId)}
                  disabled={loading === pkg.id}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60 ${
                    pkg.highlight
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {loading === pkg.id
                    ? '处理中...'
                    : done === pkg.id
                      ? '✓ 已到账'
                      : pkg.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          额度永不过期 · 支持支付宝付款（即将开放）· 有问题请联系 support@resumegenkk.xyz
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 构建验证**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

---

## Task 7：App.tsx 注册路由

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 追加 lazy imports（在现有 RefundPage import 之后）**

```typescript
const AccountPage = lazyWithRetry(() => import('./pages/Account'))
const PricingPage = lazyWithRetry(() => import('./pages/Pricing'))
```

- [ ] **Step 2: 在 Routes 里注册（在 `/refund` 路由之后）**

```tsx
<Route path="/account" element={<AccountPage />} />
<Route path="/pricing" element={<PricingPage />} />
```

- [ ] **Step 3: 构建验证**

```bash
cd frontend && npm run build 2>&1 | tail -5
# 期望: ✓ built in ...
```

- [ ] **Step 4: Commit 所有前端改动**

```bash
git add \
  frontend/src/services/api.ts \
  frontend/src/contexts/AuthContext.tsx \
  frontend/src/components/UserMenu.tsx \
  frontend/src/pages/Account/index.tsx \
  frontend/src/pages/Pricing/index.tsx \
  frontend/src/App.tsx
git commit -m "feat: user center, credits badge, pricing page with mock checkout"
```

---

## Task 8：浏览器实测验收

- [ ] **Step 1: 启动前后端**

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000 &
cd frontend && npm run dev &
```

- [ ] **Step 2: 验证路径**

| 测试点 | 期望结果 |
|---|---|
| 打开 `http://127.0.0.1:5173/` | Landing page 正常 |
| 未登录访问 `/pricing` | 显示定价页，点击「立即购买」弹登录 |
| 登录后看 UserMenu | 右上角出现「X 额度」蓝色徽章，用户名可点击跳转 `/account` |
| 访问 `/account` | 显示头像/邮箱/套餐/额度，「购买额度」按钮跳 `/pricing` |
| 在 `/pricing` 点击 Starter「立即购买」 | 按钮变「处理中...」→「✓ 已到账」，UserMenu 额度数字更新 |
| 在 `/pricing` 点击 Pro「立即购买」 | 同上，额度再增加 200 |
| 刷新页面后看 UserMenu | 额度数字持久（从后端重新拉取） |

- [ ] **Step 3: 最终 commit**

```bash
git add knowledge-base/plans/2026-06-23-user-center-credits-mock-payment.md
git commit -m "docs: add user-center + mock-payment implementation plan"
```

---

## 自查清单（Self-Review）

- [x] **Spec 覆盖**：后端 mock-checkout ✅ · AuthContext credits/plan ✅ · UserMenu 徽章 ✅ · /account 页 ✅ · /pricing 页 ✅ · App.tsx 路由 ✅
- [x] **无占位符**：所有代码步骤均为完整可运行代码
- [x] **类型一致**：`UserEntitlement.plan/credits` → AuthContext `User.plan/credits` → UserMenu/Account/Pricing 全链路一致
- [x] **接口一致**：`mockCheckout(packageName)` → `POST /api/billing/mock-checkout` body `{ package }` → `MOCK_PLANS[package]` → 返回 `EntitlementResponse`
- [x] **refreshEntitlement** 在 AuthContextValue 声明、Provider 实现、Pricing 页消费三处均已对齐

---

## Creem 上线替换清单（备忘）

当 Creem KYC 通过、真实支付接入时，只需：

1. 在 `backend/routes/billing.py` 新增 `POST /api/billing/creem/webhook` 处理 `checkout.completed` 事件，同样调用 `get_or_create_entitlement` 更新 credits
2. 在 `frontend/src/pages/Pricing/index.tsx` 把 `handleBuy` 改为跳转 Creem checkout URL（通过后端生成）
3. `mock-checkout` 端点保留供本地开发，不删除
