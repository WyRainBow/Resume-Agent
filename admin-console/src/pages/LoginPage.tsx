import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/adminApi'
import { setToken } from '../lib/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await login(username, password)
      setToken(res.access_token)
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#ECEFF4] px-4">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 14% 18%, rgba(148,163,184,0.14), transparent 26%), radial-gradient(circle at 86% 2%, rgba(59,130,246,0.09), transparent 30%)' }} />
      <form onSubmit={onSubmit} className="relative z-10 w-full max-w-lg rounded-2xl border border-[#d7deea] bg-[#f8fafc] p-8 shadow-[0_16px_42px_rgba(15,23,42,0.07)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Resume Agent</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-slate-900">后台登录</h1>
        <p className="mt-1 text-base text-slate-500">仅管理员 / 成员可访问此页面。</p>

        <div className="mt-6 space-y-3">
          <input
            className="input-clean"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="input-clean"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-base text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-60"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </div>
      </form>
    </div>
  )
}
