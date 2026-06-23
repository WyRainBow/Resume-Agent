import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Zap, LogOut, ArrowLeft, ShieldCheck } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
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
            <Avatar
              src={user?.image}
              name={user?.username}
              email={user?.email}
              className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-500 border-transparent"
              textClassName="text-xl"
            />
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
