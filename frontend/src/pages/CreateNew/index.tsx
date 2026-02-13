/**
 * 创建简历入口页面
 * 提供两个选项：创建新简历（推荐）和导入已有简历
 */
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  Sparkles
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// 动画变体
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.15
    }
  }
}

export default function CreateNew() {
  const navigate = useNavigate()

  const handleCreateNew = () => {
    // 跳转到 AI 对话创建简历页面
    navigate('/resume-creator')
  }

  const handleImportExisting = () => {
    // 跳转到模板市场
    navigate('/templates')
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1E293B] font-sans overflow-hidden">
      {/* 动态背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-400/5 rounded-full blur-[100px] -z-10" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-400/5 rounded-full blur-[80px] -z-10" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-400/5 rounded-full blur-[80px] -z-10" />
      </div>

      {/* 返回按钮 */}
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

      {/* 主内容区 */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* 标题区域 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black mb-6 border border-indigo-100 tracking-widest uppercase shadow-sm">
            <Sparkles className="w-3 h-3 fill-current" />
            AI 智能体
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-4">
            选择创建方式
          </h1>

          <p className="text-lg text-slate-500 font-medium max-w-xl mx-auto">
            通过 AI 对话快速生成专业简历、或导入现有简历进行编辑
          </p>
        </motion.div>

        {/* 选项卡片 */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full"
        >
          {/* 创建新简历卡片（推荐） */}
          <motion.div
            variants={fadeInUp}
            whileHover={{ y: -8 }}
            onClick={handleCreateNew}
            className="group relative cursor-pointer"
          >
            {/* 推荐标签 */}
            <div className="absolute -top-3 left-6 z-10">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full text-white text-xs font-bold shadow-lg shadow-indigo-500/30">
                <Sparkles className="w-3 h-3 fill-current" />
                推荐
              </div>
            </div>

            <div className="relative h-full p-8 bg-white rounded-2xl border-2 border-indigo-100 hover:border-indigo-300 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(79,70,229,0.12)] transition-all duration-300">
              {/* 卡片内容 */}
              <div className="flex flex-col h-full">
                {/* 图标 */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/30">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>

                {/* 标题 */}
                <h3 className="text-2xl font-black text-slate-900 mb-3">
                  AI 对话创建
                </h3>

                {/* 描述 */}
                <p className="text-slate-500 font-medium mb-6 leading-relaxed">
                  通过与 AI 智能对话、轻松收集和整理您的信息、自动生成专业简历
                </p>

                {/* 特性列表 */}
                <div className="space-y-3 mb-6">
                  {[
                    { icon: CheckCircle, text: '智能对话引导、无需担心格式' },
                    { icon: CheckCircle, text: '实时预览、所见即所得' },
                    { icon: Clock, text: '5分钟完成初稿' }
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <feature.icon className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                      <span className="text-slate-600 font-medium">{feature.text}</span>
                    </div>
                  ))}
                </div>

                {/* 按钮 */}
                <div className="mt-auto">
                  <div className="flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl font-bold text-base shadow-lg shadow-indigo-500/30 group-hover:shadow-xl group-hover:shadow-indigo-500/40 transition-all">
                    开始创建
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>

              {/* 装饰：角落光晕 */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-100 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity -z-10" />
            </div>
          </motion.div>

          {/* 导入已有简历卡片 */}
          <motion.div
            variants={fadeInUp}
            whileHover={{ y: -8 }}
            onClick={handleImportExisting}
            className="group relative cursor-pointer"
          >
            <div className="relative h-full p-8 bg-white rounded-2xl border-2 border-slate-100 hover:border-slate-300 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-300">
              {/* 卡片内容 */}
              <div className="flex flex-col h-full">
                {/* 图标 */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                  <FileText className="w-8 h-8 text-white" />
                </div>

                {/* 标题 */}
                <h3 className="text-2xl font-black text-slate-900 mb-3">
                  从模板创建 / 导入
                </h3>

                {/* 描述 */}
                <p className="text-slate-500 font-medium mb-6 leading-relaxed">
                  选择精美模板直接编辑、或导入 PDF/Word 文件进行优化
                </p>

                {/* 特性列表 */}
                <div className="space-y-3 mb-6">
                  {[
                    { icon: CheckCircle, text: '支持 PDF、Word 格式解析' },
                    { icon: CheckCircle, text: '可视化拖拽编辑' },
                    { icon: CheckCircle, text: '丰富的模板选择' }
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <feature.icon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-600 font-medium">{feature.text}</span>
                    </div>
                  ))}
                </div>

                {/* 按钮 */}
                <div className="mt-auto">
                  <div className="flex items-center justify-center gap-2 w-full py-3.5 bg-slate-700 text-white rounded-xl font-bold text-base shadow-lg group-hover:bg-slate-800 transition-all">
                    去编辑
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>

              {/* 装饰：角落光晕 */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-slate-100 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity -z-10" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
