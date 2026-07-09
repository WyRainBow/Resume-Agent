/**
 * 创建简历入口页面
 * Swiss International Style：格子画布、硬阴影、serif 大标题、mono 标签
 */
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle,
  Sparkles,
  Upload,
  FileCode,
  ArrowRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { setCurrentResumeId } from '@/services/resumeStorage'
import { cn } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.12,
    },
  },
}

export default function CreateNew() {
  const navigate = useNavigate()

  const handleAIImport = () => {
    navigate('/my-resumes?openAIImport=1')
  }

  const handleLatexTemplate = () => {
    setCurrentResumeId(null)
    localStorage.removeItem('resume_v2_data')
    navigate('/workspace/new')
  }

  return (
    <div className="min-h-screen bg-[#F0F0E8] text-black font-sans overflow-hidden">
      {/* 格子纹理背景 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* 左上角返回 */}
      <div className="fixed top-6 left-6 z-50">
        <motion.button
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/my-resumes')}
          className={cn(
            'inline-flex items-center gap-2',
            'font-mono text-xs font-bold uppercase tracking-wide',
            'border-2 border-black bg-[#F0F0E8]',
            'shadow-[2px_2px_0px_0px_#000000]',
            'px-4 py-2 text-black',
            'hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none',
            'transition-[transform,box-shadow,background-color] duration-100',
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </motion.button>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* 标题区 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          {/* AI 标签 */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 border-2 border-black bg-[#F0F0E8] font-mono text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#000000] mb-6">
            <Sparkles className="w-3 h-3" />
            AI 智能体
          </div>

          {/* 大标题 */}
          <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tight text-black mb-4 leading-tight">
            选择创建方式
          </h1>

          <p className="font-mono text-sm text-[#878E99] max-w-2xl mx-auto">
            通过导入 PDF 解析、或使用默认 LaTeX 模板快速开始
          </p>
        </motion.div>

        {/* 两列卡片 */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full"
        >
          {/* 卡片一：默认模板 LaTeX（推荐） */}
          <motion.div
            variants={fadeInUp}
            whileHover={{ y: -4, translateX: 0 }}
            onClick={handleLatexTemplate}
            className="group cursor-pointer"
          >
            {/* 推荐角标 */}
            <div className="absolute -top-3 left-4 z-10">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1',
                  'border-2 border-black bg-[#F0F0E8]',
                  'font-mono text-[10px] font-black uppercase tracking-widest',
                  'shadow-[2px_2px_0px_0px_#000000]',
                )}
              >
                <Sparkles className="w-3 h-3" />
                推荐
              </div>
            </div>

            {/* 主卡片 */}
            <div
              className={cn(
                'relative h-full border-2 border-black bg-[#F0F0E8]',
                'shadow-[4px_4px_0px_0px_#000000]',
                'p-6',
                'hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none',
                'transition-[transform,box-shadow] duration-100',
              )}
            >
              {/* 图标区 */}
              <div
                className={cn(
                  'w-14 h-14 flex items-center justify-center mb-4',
                  'border-2 border-black bg-emerald-600',
                  'shadow-[2px_2px_0px_0px_#000000]',
                  'group-hover:translate-y-[1px] group-hover:translate-x-[1px] group-hover:shadow-none',
                  'transition-[transform,box-shadow] duration-100',
                )}
              >
                <FileCode className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-xl font-serif font-black text-black mb-2">
                默认模板 LaTeX
              </h3>

              <p className="font-mono text-xs text-[#878E99] mb-4 leading-relaxed">
                使用 LaTeX 默认模板从零填写、渲染 PDF
              </p>

              {/* 特性列表 */}
              <div className="space-y-2 mb-4">
                {['LaTeX 模板编辑', '渲染 PDF 下载'].map((text, i) => (
                  <div key={i} className="flex items-center gap-2 font-mono text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-[#444850]">{text}</span>
                  </div>
                ))}
              </div>

              {/* 底部 CTA */}
              <div
                className={cn(
                  'mt-auto flex items-center justify-center gap-2 w-full py-3',
                  'border-2 border-black bg-emerald-600',
                  'shadow-[2px_2px_0px_0px_#000000]',
                  'font-mono text-xs font-black uppercase tracking-wide text-white',
                  'group-hover:translate-y-[1px] group-hover:translate-x-[1px] group-hover:shadow-none',
                  'transition-[transform,box-shadow,background-color] duration-100',
                  'hover:bg-emerald-700',
                )}
              >
                使用模板{' '}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </motion.div>

          {/* 卡片二：AI 智能导入 */}
          <motion.div
            variants={fadeInUp}
            whileHover={{ y: -4, translateX: 0 }}
            onClick={handleAIImport}
            className="group cursor-pointer"
          >
            <div
              className={cn(
                'relative h-full border-2 border-black bg-[#F0F0E8]',
                'shadow-[4px_4px_0px_0px_#000000]',
                'p-6',
                'hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none',
                'transition-[transform,box-shadow] duration-100',
              )}
            >
              {/* 图标区 */}
              <div
                className={cn(
                  'w-14 h-14 flex items-center justify-center mb-4',
                  'border-2 border-black bg-violet-600',
                  'shadow-[2px_2px_0px_0px_#000000]',
                  'group-hover:translate-y-[1px] group-hover:translate-x-[1px] group-hover:shadow-none',
                  'transition-[transform,box-shadow] duration-100',
                )}
              >
                <Upload className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-xl font-serif font-black text-black mb-2">
                AI 智能导入
              </h3>

              <p className="font-mono text-xs text-[#878E99] mb-4 leading-relaxed">
                导入 PDF 等文件、AI 解析后进入编辑
              </p>

              {/* 特性列表 */}
              <div className="space-y-2 mb-4">
                {['支持 PDF 解析', '与编辑页同款导入'].map((text, i) => (
                  <div key={i} className="flex items-center gap-2 font-mono text-xs">
                    <CheckCircle className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <span className="text-[#444850]">{text}</span>
                  </div>
                ))}
              </div>

              {/* 底部 CTA */}
              <div
                className={cn(
                  'mt-auto flex items-center justify-center gap-2 w-full py-3',
                  'border-2 border-black bg-violet-600',
                  'shadow-[2px_2px_0px_0px_#000000]',
                  'font-mono text-xs font-black uppercase tracking-wide text-white',
                  'group-hover:translate-y-[1px] group-hover:translate-x-[1px] group-hover:shadow-none',
                  'transition-[transform,box-shadow,background-color] duration-100',
                  'hover:bg-violet-700',
                )}
              >
                去导入{' '}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
