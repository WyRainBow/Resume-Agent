import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  FileText,
  Layout,
  Sparkles,
  Zap,
  LogIn,
  User,
  LogOut,
  FileEdit
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

// 动画变体
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
}

// 刷新时标题/副标题轻微弹出（偏慢）
const popIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: 'spring', stiffness: 120, damping: 20 }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout, openModal } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const logoutMenuRef = useRef<HTMLDivElement>(null)

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
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-200 selection:text-slate-900 overflow-x-hidden">
      {/* 顶部导航 - 白底风格 */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? 'bg-white shadow-sm py-3' : 'bg-white py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer group shrink-0 min-w-0" onClick={() => navigate('/')}>
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-slate-200 shadow-sm group-hover:scale-105 transition-transform shrink-0">
            <span className="text-slate-900 font-black text-sm italic">RA</span>
          </div>
          <span className="text-slate-900 font-bold text-base truncate">Resume.AI</span>
        </div>

          <div className="hidden md:flex items-center gap-10">
            <a href="#features" className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">核心技术</a>
            <a href="#market" className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">简历市场</a>
            <a href="#ai" className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">AI 引擎</a>
          </div>

          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/create-new')}
              className="hidden md:block px-5 py-2.5 bg-white text-slate-900 rounded-xl font-bold border border-slate-300 hover:bg-slate-50 transition-all"
            >
              创建简历
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              我的简历
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="relative pt-48 pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            {...popIn}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 rounded-full text-xs font-bold mb-10 tracking-widest uppercase"
          >
            <Sparkles className="w-3 h-3 fill-current animate-spin-slow" />
            Neural Stream v2.0 Online
          </motion.div>

          <motion.h1
            {...popIn}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.15 }}
            className="text-4xl md:text-6xl font-black tracking-tight text-slate-950 mb-6 leading-tight"
          >
            从零写简历或一键针对不同岗位定制
          </motion.h1>

          <motion.p
            {...popIn}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.35 }}
            className="text-lg md:text-xl text-slate-600 font-medium mb-14 max-w-2xl mx-auto leading-relaxed"
          >
            最简洁、自动化的 AI 简历工具。Resume.AI 用 AI 为每份简历节省约 60 分钟
            绝对写出让HR眼前一亮的版本。
          </motion.p>

          <motion.div
            {...popIn}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.55 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <button
              onClick={() => navigate('/create-new')}
              className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-xl hover:bg-slate-800 transition-all flex items-center gap-4 group"
            >
              开始创建
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/agent/new')}
              className="px-12 py-5 bg-white text-slate-900 rounded-2xl font-black text-xl border-2 border-slate-300 hover:bg-slate-50 transition-all flex items-center gap-4 group"
            >
              <FileEdit className="w-6 h-6" />
              生成报告
            </button>
            <div className="text-slate-500 font-bold">
              不再为排版浪费时间。
            </div>
          </motion.div>
          </div>

          {/* 产品预览图：居中，略大 */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.6 }}
            className="mt-16 w-[98%] max-w-[1400px] mx-auto px-2"
          >
            <img
              src="https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com/landing/product-preview.png"
              alt="产品界面预览"
              className="w-full h-auto rounded-2xl border border-slate-200 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.12)]"
            />
          </motion.div>
      </section>

      {/* 特性展示 */}
      <section id="features" className="py-32 bg-slate-50/80 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { 
                icon: <Zap className="w-8 h-8 text-slate-600" />, 
                title: "Neural Streaming", 
                desc: "基于 SSE 的流式渲染技术。看着简历内容实时流转、AI 在毫秒内完成内容润色与逻辑构建。" 
              },
              { 
                icon: <FileText className="w-8 h-8 text-slate-600" />, 
                title: "LaTeX Foundry", 
                desc: "告别 PDF 错位。原生集成 LaTeX 编译引擎、为程序员提供最严谨的对齐、间距与字体渲染。" 
              },
              { 
                icon: <Layout className="w-8 h-8 text-slate-600" />, 
                title: "智能逻辑", 
                desc: "它懂你的项目亮点、也懂你的复杂场景。智能识别关键词、自动优化工作描述的动作词与数据产出。" 
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
                whileHover={{ 
                  y: -12,
                  transition: { type: "spring", stiffness: 300 }
                }}
                className="p-10 rounded-[32px] bg-white border border-slate-100 hover:border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.06)] transition-all group relative overflow-hidden"
              >
                {/* 卡片装饰：角落的微弱光晕 */}
                <div className="absolute top-[-20%] right-[-20%] w-32 h-32 bg-slate-100 rounded-full blur-2xl group-hover:bg-slate-200 transition-colors" />
                
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-10 group-hover:scale-110 group-hover:bg-white transition-all shadow-sm">
                  {feature.icon}
              </div>
                <h3 className="text-2xl font-black text-slate-900 mb-4">{feature.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
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
