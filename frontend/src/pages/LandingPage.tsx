import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  Sparkles,
  LogIn,
  User,
  LogOut,
  Github,
  MessageCircle,
  X
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

// 刷新时标题/副标题轻微弹出（偏慢）
const popIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: 'spring', stiffness: 120, damping: 20 }
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout, openModal } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const [showWechatCard, setShowWechatCard] = useState(false)
  const [githubStars, setGithubStars] = useState<number | null>(null)
  const logoutMenuRef = useRef<HTMLDivElement>(null)

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
    }

    if (showLogoutMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showLogoutMenu])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white text-slate-900 font-hero antialiased selection:bg-slate-200 selection:text-slate-900 overflow-x-hidden">
      {/* 顶部导航 - 白底风格 */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? 'bg-white shadow-sm py-3' : 'bg-white py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer group shrink-0 min-w-0" onClick={() => navigate('/')}>
          <div className="w-11 h-11 bg-white rounded-lg flex items-center justify-center border border-slate-200 shadow-sm group-hover:scale-105 transition-transform shrink-0">
            <span className="text-slate-900 font-black text-base italic">RA</span>
          </div>
          <span className="text-slate-900 font-bold text-lg truncate">Resume.AI</span>
        </div>

          <div className="hidden md:flex items-center gap-10">
          </div>

          <div className="flex items-center gap-3">
            <motion.a
              href="https://github.com/WyRainBow/Resume-Agent"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all border border-slate-800 shadow-sm"
            >
              <Github className="w-5 h-5 shrink-0" />
              {githubStars !== null && (
                <span className="tabular-nums text-sm font-bold tracking-tight opacity-90">{githubStars.toLocaleString()}</span>
              )}
            </motion.a>
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/my-resumes')}
              className="px-6 py-2 bg-white text-slate-700 rounded-xl font-bold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
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
            <Sparkles className="w-3 h-3 fill-current animate-spin-slow" />
            公益 · Free
          </motion.div>

          <motion.div
            {...popIn}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.15 }}
            className="text-[1.375rem] sm:text-2xl md:text-3xl lg:text-[2.125rem] font-semibold tracking-[0.02em] text-slate-800 mb-10 leading-[1.65] max-w-4xl mx-auto flex flex-col items-center gap-3 sm:gap-3.5"
          >
            <span className="block">公益简历制作网站</span>
            <span className="block">
              功能都是{' '}
              <span className="font-bold text-slate-900">Free</span>
            </span>
            <span className="block">
              <span className="font-bold text-slate-900">Token</span> 无限
            </span>
            <span className="mt-0.5 flex flex-wrap items-center justify-center gap-2 text-[0.95em] sm:text-[inherit]">
              <span>
                希望留下你的 <span className="font-bold text-slate-900">Star</span>
              </span>
              <span className="text-slate-400 font-bold select-none" aria-hidden>
                ：
              </span>
              <motion.a
                href="https://github.com/WyRainBow/Resume-Agent"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="在 GitHub 上为项目点 Star"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center justify-center rounded-xl p-2 text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
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
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <button
              onClick={() => navigate('/create-new')}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all flex items-center gap-3 group"
            >
              开始创建
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
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
              className="w-full h-auto rounded-2xl border border-slate-200 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.15)]"
            />
          </motion.div>
      </section>

      {/* 底部信息 */}
      <footer className="py-20 text-center">
        <div className="text-slate-400 text-xs font-black tracking-[0.3em] uppercase">
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
              className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl shadow-lg border border-slate-200 hover:border-slate-300 transition-all cursor-pointer group"
              onClick={() => setShowLogoutMenu(!showLogoutMenu)}
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <User className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 font-medium">已登录</span>
                <span className="text-sm font-bold text-slate-900">{user?.username || user?.email}</span>
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white rounded-xl shadow-lg border border-red-200 hover:border-red-300 hover:bg-red-50 transition-all"
                  >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-bold text-red-600">退出登录</span>
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
            className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl shadow-lg border border-slate-200 hover:border-slate-300 transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
              <LogIn className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-bold text-slate-900">登录/注册</span>
          </motion.button>
        )}
      </motion.div>

      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence mode="wait">
          {showWechatCard ? (
            <motion.div
              key="wechat-card"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="w-[220px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.16)]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">联系我</div>
                  <div className="mt-1 text-xs text-slate-500">微信扫码、直接沟通</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWechatCard(false)}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label="关闭联系卡片"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <img
                src="/contact-wechat-qr.jpg"
                alt="微信二维码"
                className="w-full rounded-xl border border-slate-200 bg-white object-cover"
              />
              <div className="mt-3 text-center text-[11px] text-slate-400">
                扫码后备注：简历站
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="wechat-trigger"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowWechatCard(true)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-lg transition-all hover:border-slate-300"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-900">联系我</div>
                <div className="text-[11px] text-slate-400">微信二维码</div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

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
