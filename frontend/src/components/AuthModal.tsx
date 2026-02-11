import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, Loader2, Sparkles, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export const AuthModal: React.FC = () => {
  const { isModalOpen, closeModal, modalMode, login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 当 Modal 打开时，根据传入的 mode 设置初始状态
  useEffect(() => {
    if (isModalOpen) {
      setMode(modalMode)
      setError(null)
      setUsername('')
      setPassword('')
    }
  }, [isModalOpen, modalMode])

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
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          {/* 模态框主体 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[420px] bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden"
          >
            {/* 顶部修饰：渐变条 */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

            {/* 关闭按钮 */}
            <button
              onClick={closeModal}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 pt-12">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-4"
                >
                  <Sparkles className="w-8 h-8 text-blue-600" />
                </motion.div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {mode === 'login' ? '欢迎回来' : '开启 AI 简历之旅'}
                </h2>
                <p className="text-slate-500 mt-2 font-medium">
                  {mode === 'login' ? '登录以同步您的简历数据' : '注册以享受完整的 AI 功能'}
                </p>
              </div>

              {/* 模式切换 */}
              <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
                <button
                  onClick={() => setMode('login')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    mode === 'login'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  登录
                </button>
                <button
                  onClick={() => setMode('register')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    mode === 'register'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  注册
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                    账号
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="请输入账号"
                      className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                    访问密码
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-950/20 hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    mode === 'login' ? '立即登录' : '免费注册'
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400 font-medium">
                  通过继续，即表示您同意我们的
                  <a href="#" className="text-slate-900 font-bold hover:underline ml-1">服务条款</a>
                  和
                  <a href="#" className="text-slate-900 font-bold hover:underline ml-1">隐私政策</a>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
