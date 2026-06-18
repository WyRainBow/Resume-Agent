import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  LogIn,
  User,
  LogOut,
  Github,
  MessageCircle,
  Sparkles,
  Sun,
  Moon,
  X
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { isAgentEnabled } from '@/lib/runtimeEnv'

// 刷新时标题/副标题轻微弹出（偏慢）
const popIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: 'spring', stiffness: 120, damping: 20 }
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout, openModal } = useAuth()
  const { isDark, setTheme } = useTheme()
  const agentEnabled = isAgentEnabled()
  const [isScrolled, setIsScrolled] = useState(false)
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const [showWechatCard, setShowWechatCard] = useState(false)
  const [githubStars, setGithubStars] = useState<number | null>(null)
  const logoutMenuRef = useRef<HTMLDivElement>(null)
  const wechatMenuRef = useRef<HTMLDivElement>(null)

  const handleOpenAgent = () => {
    if (!agentEnabled) return
    navigate('/agent/new')
  }

  // 拉取 GitHub star 数（公开 API，无需 token）
  useEffect(() => {
    fetch('https://api.github.com/repos/WyRainBow/Resume-Agent')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.stargazers_count === 'number') setGithubStars(data.stargazers_count)
      })
      .catch(() => {})
  }, [])

  // 点击外部区域关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (logoutMenuRef.current && !logoutMenuRef.current.contains(event.target as Node)) {
        setShowLogoutMenu(false)
      }
      if (wechatMenuRef.current && !wechatMenuRef.current.contains(event.target as Node)) {
        setShowWechatCard(false)
      }
    }

    if (showLogoutMenu || showWechatCard) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showLogoutMenu, showWechatCard])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-hero antialiased selection:bg-slate-200 selection:text-slate-900 overflow-x-hidden">
      {/* 顶部导航 - 白底风格 */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? 'bg-white dark:bg-slate-950 shadow-sm dark:shadow-slate-900/40 py-3' : 'bg-white dark:bg-slate-950 py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer group shrink-0 min-w-0" onClick={() => navigate('/')}>
          <div className="w-11 h-11 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm group-hover:scale-105 transition-transform shrink-0">
            <span className="text-slate-900 dark:text-white font-black text-base italic">RA</span>
          </div>
          <span className="text-slate-900 dark:text-slate-100 font-bold text-lg truncate">Resume.AI</span>
        </div>

          <div className="hidden md:flex items-center gap-10">
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-800 shadow-sm"
              title={isDark ? '切换到浅色模式' : '切换到深色模式'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </motion.button>
            <div className="relative hidden md:block" ref={wechatMenuRef}>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowWechatCard((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-bold">联系我</span>
              </motion.button>
              <AnimatePresence>
                {showWechatCard && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 top-full z-50 mt-2 w-[220px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.16)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">联系我</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">微信扫码、直接沟通</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowWechatCard(false)}
                        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
                        aria-label="关闭联系卡片"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <img
                      src="/contact-wechat-qr.jpg"
                      alt="微信二维码"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white object-cover"
                    />
                    <div className="mt-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
                      扫码后备注：简历站
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <motion.a
              href="https://github.com/WyRainBow/Resume-Agent"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-all border border-slate-800 dark:border-slate-700 shadow-sm"
            >
              <Github className="w-5 h-5 shrink-0" />
              {githubStars !== null && (
                <span className="tabular-nums text-sm font-bold tracking-tight opacity-90">{githubStars.toLocaleString()}</span>
              )}
            </motion.a>
            {agentEnabled && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleOpenAgent}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold border border-indigo-100 dark:border-indigo-900/60 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all shadow-sm"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                AI 助手
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/my-resumes')}
              className="px-6 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl font-bold border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
            >
              我的简历
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="relative pt-32 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            {...popIn}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            className="inline-flex items-center gap-2 px-4 py-2 text-blue-700 rounded-full text-[13px] font-semibold mb-8 tracking-wide"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            公益 · Free
          </motion.div>

          <motion.div
            {...popIn}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.15 }}
            className="text-[1.375rem] sm:text-2xl md:text-3xl lg:text-[2.125rem] font-semibold tracking-[0.02em] text-slate-800 dark:text-slate-200 mb-10 leading-[1.65] max-w-4xl mx-auto flex flex-col items-center gap-3 sm:gap-3.5"
          >
            <span className="block">公益简历制作网站</span>
            <span className="block">
              功能都是{' '}
              <span className="font-bold text-slate-900 dark:text-white">Free</span>
            </span>
            <span className="block">
              <span className="font-bold text-slate-900 dark:text-white">Token</span> 无限
            </span>
            <span className="mt-0.5 flex flex-wrap items-center justify-center gap-2 text-[0.95em] sm:text-[inherit]">
              <span>
                希望留下你的 <span className="font-bold text-slate-900 dark:text-white">Star</span>
              </span>
              <span className="text-slate-400 dark:text-slate-500 font-bold select-none" aria-hidden>
                ：
              </span>
              <motion.a
                href="https://github.com/WyRainBow/Resume-Agent"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="在 GitHub 上为项目点 Star"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center justify-center rounded-xl p-2 text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <Github className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2} />
              </motion.a>
            </span>
          </motion.div>

          <motion.div
            {...popIn}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.35 }}
            className="flex flex-col items-center justify-center gap-4"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
              <button
                onClick={() => navigate('/create-new')}
                className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-3 group"
              >
                开始创建
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              {agentEnabled && (
                <button
                  onClick={handleOpenAgent}
                  className="px-8 py-4 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 rounded-2xl font-bold text-lg hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all flex items-center gap-3 border-2 border-indigo-100 dark:border-indigo-900/60 hover:border-indigo-200 dark:hover:border-indigo-800 group shadow-sm"
                >
                  <Sparkles className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                  体验 AI 助手
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
            {agentEnabled && (
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                智能润色简历、分析岗位匹配、模拟面试 — 登录后即可开始对话
              </p>
            )}
          </motion.div>
          </div>

          {/* 产品预览图：居中，略大 */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.6 }}
            className="mt-12 w-[98%] max-w-[1400px] mx-auto px-2"
          >
            <img
              src="https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com/landing/product-preview.png"
              alt="产品界面预览"
              className="w-full h-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_80px_-12px_rgba(0,0,0,0.6)]"
            />
          </motion.div>
      </section>

      {/* 底部信息 */}
      <footer className="py-20 text-center">
        <div className="text-slate-400 dark:text-slate-600 text-xs font-black tracking-[0.3em] uppercase">
          RA · Neural Engine · Pixel Perfect LaTeX
      </div>
      </footer>

      {/* 左下角登录按钮 */}
      <motion.div
        ref={logoutMenuRef}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-6 left-6 z-50"
      >
        {isAuthenticated ? (
          <div className="relative">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer group"
              onClick={() => setShowLogoutMenu(!showLogoutMenu)}
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">已登录</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{user?.username || user?.email}</span>
              </div>
            </motion.div>
            
            {/* 退出按钮下拉菜单 */}
            <AnimatePresence>
              {showLogoutMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-full left-0 mb-2 w-full"
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowLogoutMenu(false)
                      logout()
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-red-200 dark:border-red-900/50 hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                  >
                    <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">退出登录</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => openModal('login')}
            className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 dark:group-hover:bg-slate-600 transition-colors">
              <LogIn className="w-4 h-4 text-slate-600 dark:text-slate-300 group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">登录/注册</span>
          </motion.button>
        )}
      </motion.div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  )
}
