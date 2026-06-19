import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
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
  X,
  FileText,
  Wand2,
  Target,
  BarChart3,
  Download,
  ScanLine,
  Star,
  ArrowUpRight,
  CornerDownLeft
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

const REPO_URL = 'https://github.com/WyRainBow/Resume-Agent'

// 简历制作核心能力（均为现有产品功能，不含面试类）
const CAPABILITIES = [
  {
    icon: FileText,
    title: '自然语言生成',
    desc: '一句话描述经历、自动生成结构化、可直接编辑的简历。',
    span: 'lg:col-span-3',
    variant: 'command'
  },
  {
    icon: Wand2,
    title: '划词润色改写',
    desc: '选中任意一段、一键润色、量化、换强动词。',
    span: 'lg:col-span-3',
    variant: 'standard'
  },
  {
    icon: Target,
    title: 'JD 岗位匹配',
    desc: '对照目标岗位诊断缺口、缺失关键词可一键融入经历。',
    span: 'lg:col-span-2',
    variant: 'standard'
  },
  {
    icon: ScanLine,
    title: '智能解析导入',
    desc: 'PDF 或文本简历一键解析为可编辑结构。',
    span: 'lg:col-span-2',
    variant: 'standard'
  },
  {
    icon: BarChart3,
    title: '简历质量评分',
    desc: '完整性、表达、匹配度多维打分并给出修改建议。',
    span: 'lg:col-span-2',
    variant: 'standard'
  },
  {
    icon: Download,
    title: '像素级 PDF 导出',
    desc: 'LaTeX 排版引擎、一键导出干净精美的 PDF。',
    span: 'lg:col-span-6',
    variant: 'pdf'
  }
] as const

// 自然语言生成卡内的小型"命令条"预览（real component preview，非 fake screenshot）
function CommandBar() {
  const phrases = [
    '一段在字节做推荐算法的实习，整理成简历条目',
    '把大二做的课程设计包装成项目经历',
    '把项目经历按 STAR 法则重写'
  ]
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % phrases.length), 3200)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="relative mt-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-sm px-3.5 py-2.5 flex items-center gap-2.5">
      <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0 relative h-5 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.span
            key={idx}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 text-[13px] text-slate-600 dark:text-slate-300 truncate"
          >
            {phrases[idx]}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 shrink-0">
        <CornerDownLeft className="w-3 h-3" />
        生成
      </span>
    </div>
  )
}

// PDF 导出卡内的迷你简历预览条（结构化 hairline 简历骨架，非 div fake screenshot）
function PdfPreview() {
  return (
    <div className="mt-5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-950 p-5 shadow-[0_18px_50px_-22px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_50px_-22px_rgba(0,0,0,0.6)] relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_0%_0%,rgba(37,99,235,0.10),transparent_60%)]"
      />
      <div className="relative grid grid-cols-12 gap-x-4 gap-y-3 text-slate-700 dark:text-slate-300">
        <div className="col-span-12 flex items-end justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <div className="h-3 w-28 rounded-sm bg-slate-900 dark:bg-slate-100" />
            <div className="mt-1.5 h-2 w-20 rounded-sm bg-slate-300 dark:bg-slate-600" />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            A4 · 1 页
          </div>
        </div>
        <div className="col-span-12 mt-1">
          <div className="h-1.5 w-12 rounded-sm bg-blue-600 mb-2" />
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded-sm bg-slate-200 dark:bg-slate-700" />
            <div className="h-1.5 w-[92%] rounded-sm bg-slate-200 dark:bg-slate-700" />
            <div className="h-1.5 w-[78%] rounded-sm bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
        <div className="col-span-7">
          <div className="h-1.5 w-16 rounded-sm bg-blue-600 mb-2" />
          <div className="space-y-1.5">
            <div className="h-1.5 w-[88%] rounded-sm bg-slate-200 dark:bg-slate-700" />
            <div className="h-1.5 w-[70%] rounded-sm bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
        <div className="col-span-5">
          <div className="h-1.5 w-12 rounded-sm bg-blue-600 mb-2" />
          <div className="flex flex-wrap gap-1">
            <span className="h-3 w-10 rounded-sm bg-slate-200 dark:bg-slate-700" />
            <span className="h-3 w-14 rounded-sm bg-slate-200 dark:bg-slate-700" />
            <span className="h-3 w-8 rounded-sm bg-slate-200 dark:bg-slate-700" />
            <span className="h-3 w-12 rounded-sm bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout, openModal } = useAuth()
  const { isDark, setTheme } = useTheme()
  const agentEnabled = isAgentEnabled()
  const reduceMotion = useReducedMotion()
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

  // 进入视口时的轻量上浮（尊重 prefers-reduced-motion）
  const reveal = {
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-hero antialiased selection:bg-blue-200 selection:text-slate-900 overflow-x-hidden">
      {/* 顶部导航 - 白底风格 */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/70 py-3'
          : 'bg-transparent py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer group shrink-0 min-w-0" onClick={() => navigate('/')}>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-400 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform shrink-0">
            <span className="text-white font-black text-base italic">RA</span>
          </div>
          <span className="text-slate-900 dark:text-slate-100 font-bold text-lg truncate">Resume.AI</span>
        </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-800 shadow-sm"
              title={isDark ? '切换到浅色模式' : '切换到深色模式'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </motion.button>
            <div className="relative hidden md:block" ref={wechatMenuRef}>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowWechatCard((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                <MessageCircle className="w-4 h-4 text-blue-600 shrink-0" />
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
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-all border border-slate-800 dark:border-slate-700 shadow-sm"
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
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl font-bold border border-blue-100 dark:border-blue-900/60 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all shadow-sm"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                AI 助手
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/my-resumes')}
              className="px-4 sm:px-6 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl font-bold border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
            >
              我的简历
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* 背景：极轻的 blue 光晕，单一品牌色 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.10),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.14),transparent_70%)]"
        />
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            {...popIn}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-semibold mb-7 tracking-wide bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            公益项目 · 完全免费
          </motion.div>

          <motion.h1
            {...popIn}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.12 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-slate-900 dark:text-white"
          >
            把经历、写成一份
            <br className="hidden sm:block" />
            <span className="text-blue-600 dark:text-blue-400">打动 HR</span> 的简历
          </motion.h1>

          <motion.p
            {...popIn}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.24 }}
            className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto"
          >
            AI 生成、润色、岗位匹配到 PDF 导出、一站做完。所有功能完全免费、Token 不限量。
          </motion.p>

          <motion.div
            {...popIn}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.36 }}
            className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
          >
            <button
              onClick={() => navigate('/create-new')}
              className="w-full sm:w-auto px-7 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-base hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
            >
              开始创建
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            {agentEnabled && (
              <button
                onClick={handleOpenAgent}
                className="w-full sm:w-auto px-7 py-3.5 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 rounded-xl font-bold text-base hover:bg-blue-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-900/60 hover:border-blue-300 dark:hover:border-blue-800 group active:scale-[0.98]"
              >
                <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                体验 AI 助手
              </button>
            )}
          </motion.div>

          <motion.a
            {...popIn}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.46 }}
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Star className="w-4 h-4" />
            觉得有用、欢迎在 GitHub 点个 Star
          </motion.a>
        </div>

        {/* 产品预览图：居中，略大 */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.6 }}
          className="mt-14 w-full max-w-[1180px] mx-auto"
        >
          <img
            src="https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com/landing/product-preview.png"
            alt="产品界面预览"
            className="w-full h-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
          />
        </motion.div>
      </section>

      {/* 能力区域 - bento 网格 */}
      <section className="px-6 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <motion.div {...reveal} className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              一份简历、从写到投、都帮你想到了
            </h2>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              围绕简历制作的全流程能力、每一步都由 AI 协助、不收费、不限量。
            </p>
          </motion.div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-6 gap-4 sm:gap-5">
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon
              const isHero = cap.variant === 'command' || cap.variant === 'pdf'
              return (
                <motion.div
                  key={cap.title}
                  initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.55, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className={`${cap.span} group relative overflow-hidden rounded-2xl p-6 sm:p-7 border transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-22px_rgba(37,99,235,0.35)] dark:hover:shadow-[0_18px_50px_-22px_rgba(37,99,235,0.45)] ${
                    isHero
                      ? 'border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-slate-900 hover:border-blue-200 dark:hover:border-blue-800'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-200 dark:hover:border-blue-800'
                  }`}
                >
                  {isHero && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-blue-200/40 dark:bg-blue-500/20 blur-2xl"
                    />
                  )}
                  <div className={`flex items-center justify-center w-11 h-11 rounded-xl mb-4 transition-transform group-hover:scale-105 ${
                    isHero
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 dark:bg-slate-800 text-white group-hover:bg-blue-600 dark:group-hover:bg-blue-500'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{cap.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{cap.desc}</p>
                  {cap.variant === 'command' && <CommandBar />}
                  {cap.variant === 'pdf' && <PdfPreview />}
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 结尾 CTA 区块 */}
      <section className="px-6 pb-24">
        <motion.div
          {...reveal}
          className="max-w-6xl mx-auto rounded-3xl bg-slate-900 dark:bg-slate-900 border border-slate-800 px-8 py-14 sm:px-14 sm:py-16 text-center relative overflow-hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_0%,rgba(59,130,246,0.22),transparent_70%)]"
          />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              免费开始制作你的简历
            </h2>
            <p className="mt-4 text-base text-slate-300 max-w-md mx-auto leading-relaxed">
              不用注册付费、不限 Token、打开就能写。
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={() => navigate('/create-new')}
                className="w-full sm:w-auto px-7 py-3.5 bg-white text-slate-900 rounded-xl font-bold text-base hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
              >
                开始创建
                <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-7 py-3.5 bg-white/5 text-white rounded-xl font-bold text-base hover:bg-white/10 transition-all flex items-center justify-center gap-2 border border-white/15 active:scale-[0.98]"
              >
                <Github className="w-5 h-5" />
                GitHub 点个 Star
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 底部信息 */}
      <footer className="border-t border-slate-200 dark:border-slate-800 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-400 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xs italic">RA</span>
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Resume.AI</span>
            <span className="text-sm text-slate-400 dark:text-slate-500">公益 AI 简历制作</span>
          </div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Github className="w-4 h-4" />
            开源于 GitHub
          </a>
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
    </div>
  )
}
