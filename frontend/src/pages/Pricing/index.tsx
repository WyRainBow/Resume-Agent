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
    } catch {
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
                  {!user?.plan || user.plan === 'free' ? '当前套餐' : '免费版'}
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
