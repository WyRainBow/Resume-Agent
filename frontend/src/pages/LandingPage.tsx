import { motion } from 'framer-motion'
import {
  ChevronRight,
  FileText,
  Layout,
  Sparkles,
  Zap
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// 动画变体
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
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
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-[#1E293B] font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* 动态背景：中心柔光创意，营造空间纵深感 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-blue-400/5 rounded-full blur-[120px] -z-10" />
      </div>

      {/* 顶部导航 */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="flex items-center justify-center w-9 h-9 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
            <span className="text-white font-black text-sm italic tracking-tighter">RA</span>
          </div>
          <span className="text-2xl font-black tracking-tight text-slate-900">Resume Agent</span>
        </div>

          <div className="hidden md:flex items-center gap-10">
            <a href="#features" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">核心技术</a>
            <a href="#market" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">简历市场</a>
            <a href="#ai" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">智能体引擎</a>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all"
          >
            我的简历
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/create-new')}
            className="hidden md:block px-5 py-2.5 bg-white text-blue-600 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition-all border border-blue-100"
          >
            创建简历
          </motion.button>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="relative pt-48 pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black mb-10 border border-indigo-100 tracking-widest uppercase shadow-sm"
          >
            <Sparkles className="w-3 h-3 fill-current animate-spin-slow" />
            Neural Stream v2.0 Online
          </motion.div>

          <motion.h1 
            {...fadeInUp}
            className="text-6xl md:text-8xl font-black tracking-tighter text-slate-950 mb-10 leading-[0.9] relative"
          >
            写简历：就像和 AI 对话
          </motion.h1>

          <motion.p 
            {...fadeInUp}
            transition={{ delay: 0.1 }}
            className="text-xl md:text-2xl text-slate-500 font-medium mb-14 max-w-3xl mx-auto leading-relaxed"
          >
            Resume-Agent 是一款为开发者打造的简历智能体。
            <br />
            通过 <span className="text-slate-800 font-bold">一句话指令</span> 触发：实时流式生成具有 <span className="text-slate-800 font-bold">LaTeX 像素级精度</span> 的专业简历。
          </motion.p>

          <motion.div 
            {...fadeInUp}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <button
              onClick={() => navigate('/dashboard')}
              className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center gap-4 group"
            >
              启动 Agent
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="text-slate-500 font-bold">
              不再为排版浪费时间。
            </div>
          </motion.div>
          </div>
      </section>

      {/* 特性展示 */}
      <section id="features" className="py-32 bg-white/50 backdrop-blur-sm relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { 
                icon: <Zap className="w-8 h-8 text-indigo-600" />, 
                title: "Neural Streaming", 
                desc: "基于 SSE 的流式渲染技术。看着简历内容实时流转、AI Agent 在毫秒内完成内容润色与逻辑构建。" 
              },
              { 
                icon: <FileText className="w-8 h-8 text-violet-600" />, 
                title: "LaTeX Foundry", 
                desc: "告别 PDF 错位。原生集成 LaTeX 编译引擎、为程序员提供最严谨的对齐、间距与字体渲染。" 
              },
              { 
                icon: <Layout className="w-8 h-8 text-emerald-600" />, 
                title: "Agentic Logic", 
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
                className="p-10 rounded-[32px] bg-white border border-slate-100 hover:border-indigo-200 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(79,70,229,0.08)] transition-all group relative overflow-hidden"
              >
                {/* 卡片装饰：角落的微弱光晕 */}
                <div className="absolute top-[-20%] right-[-20%] w-32 h-32 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors" />
                
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
