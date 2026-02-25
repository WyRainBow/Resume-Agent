/**
 * 创建简历入口页面
 * 三个选项：AI 对话创建、AI 智能导入、使用默认模板 LaTeX 生成简历
 */
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle,
  Sparkles,
  Upload,
  FileCode
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { setCurrentResumeId } from '@/services/resumeStorage'

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.12
    }
  }
}

export default function CreateNew() {
  const navigate = useNavigate()

  const handleAIChat = () => {
    navigate('/resume-creator')
  }

  const handleAIImport = () => {
    navigate('/my-resumes?openAIImport=1')
  }

  const handleLatexTemplate = () => {
    // 强制从默认模板新建，避免继续加载上一次编辑的简历
    setCurrentResumeId(null)
    localStorage.removeItem('resume_v2_data')
    navigate('/workspace/latex')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-[#1E293B] font-sans overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-400/5 rounded-full blur-[100px] -z-10" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-400/5 rounded-full blur-[80px] -z-10" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-400/5 rounded-full blur-[80px] -z-10" />
      </div>

      <div className="fixed top-6 left-6 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/my-resumes')}
          className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-sm font-medium text-slate-600 hover:text-slate-900 shadow-sm hover:shadow-md transition-all"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          返回
        </motion.button>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black mb-6 border border-indigo-100 tracking-widest uppercase shadow-sm">
            <Sparkles className="w-3 h-3 fill-current" />
            AI 智能体
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-4">
            选择创建方式
          </h1>
          <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">
            通过 AI 对话生成、导入 PDF 解析、或使用默认 LaTeX 模板快速开始
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full"
        >
          {/* 1. 默认模板 LaTeX（推荐） */}
          <motion.div
            variants={fadeInUp}
            whileHover={{ y: -8 }}
            onClick={handleLatexTemplate}
            className="group relative cursor-pointer"
          >
            <div className="absolute -top-3 left-4 z-10">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full text-white text-xs font-bold shadow-lg shadow-indigo-500/30">
                <Sparkles className="w-3 h-3 fill-current" />
                推荐
              </div>
            </div>
            <div className="relative h-full p-6 bg-white rounded-2xl border-2 border-indigo-100 hover:border-indigo-300 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(79,70,229,0.12)] transition-all duration-300">
              <div className="flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <FileCode className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">默认模板 LaTeX</h3>
                <p className="text-slate-500 font-medium text-sm mb-4 leading-relaxed">
                  使用 LaTeX 默认模板从零填写、渲染 PDF
                </p>
                <div className="space-y-2 mb-4">
                  {['LaTeX 模板编辑', '渲染 PDF 下载'].map((text, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-slate-600 font-medium">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto">
                  <div className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg group-hover:bg-emerald-700 transition-all">
                    使用模板 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 2. AI 对话创建 */}
          <motion.div
            variants={fadeInUp}
            whileHover={{ y: -8 }}
            onClick={handleAIChat}
            className="group relative cursor-pointer"
          >
            <div className="relative h-full p-6 bg-white rounded-2xl border-2 border-slate-100 hover:border-slate-300 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-300">
              <div className="flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">AI 对话创建</h3>
                <p className="text-slate-500 font-medium text-sm mb-4 leading-relaxed">
                  与 AI 对话收集信息、自动生成专业简历
                </p>
                <div className="space-y-2 mb-4">
                  {['智能对话引导', '5 分钟出初稿'].map((text, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span className="text-slate-600 font-medium">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto">
                  <div className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg group-hover:bg-indigo-700 transition-all">
                    开始创建 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 3. AI 智能导入 */}
          <motion.div
            variants={fadeInUp}
            whileHover={{ y: -8 }}
            onClick={handleAIImport}
            className="group relative cursor-pointer"
          >
            <div className="relative h-full p-6 bg-white rounded-2xl border-2 border-slate-100 hover:border-slate-300 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-300">
              <div className="flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <Upload className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">AI 智能导入</h3>
                <p className="text-slate-500 font-medium text-sm mb-4 leading-relaxed">
                  导入 PDF 等文件、AI 解析后进入编辑
                </p>
                <div className="space-y-2 mb-4">
                  {['支持 PDF 解析', '与编辑页同款导入'].map((text, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-violet-500 flex-shrink-0" />
                      <span className="text-slate-600 font-medium">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto">
                  <div className="flex items-center justify-center gap-2 w-full py-3 bg-violet-600 text-white rounded-xl font-bold text-sm shadow-lg group-hover:bg-violet-700 transition-all">
                    去导入 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
