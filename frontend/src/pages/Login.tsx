import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        await register(username, password)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between mb-6">
          <button
            className={`flex-1 py-2 ${mode === 'login' ? 'border-b-2 border-black' : 'text-gray-500'}`}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          <button
            className={`flex-1 py-2 ${mode === 'register' ? 'border-b-2 border-black' : 'text-gray-500'}`}
            onClick={() => setMode('register')}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-gray-700">账号</label>
            <input
              type="text"
              className="w-full border rounded-md px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-700">密码</label>
            <input
              type="password"
              className="w-full border rounded-md px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <button
            type="submit"
            className="w-full bg-black text-white py-2 rounded-md disabled:opacity-60"
            disabled={loading}
          >
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>
      </div>
    </div>
  )
}
