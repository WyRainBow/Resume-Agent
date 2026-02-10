/**
 * ResumeSelector - 简历选择组件
 * 
 * 在聊天区域显示可选择的简历卡片（仅 HTML 类型）
 * 支持水平滚动，用户点击后加载简历到右侧预览
 */

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { getAllResumes } from '@/services/resumeStorage'
import type { SavedResume } from '@/services/storage/StorageAdapter'

interface ResumeSelectorProps {
  /** 选择简历后的回调 */
  onSelect: (resume: SavedResume) => void
  /** 取消选择的回调 */
  onCancel?: () => void
}

export const ResumeSelector: React.FC<ResumeSelectorProps> = ({
  onSelect,
  onCancel
}) => {
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadResumes = async () => {
      try {
        setLoading(true)
        const allResumes = await getAllResumes()
        // 只显示 HTML 类型的简历
        const htmlResumes = allResumes.filter(r => {
          // 检查 templateType 字段或从 data 中获取
          const templateType = r.templateType || (r.data as any)?.templateType
          return templateType === 'html'
        })
        setResumes(htmlResumes)
        setError(null)
      } catch (err) {
        console.error('加载简历列表失败:', err)
        setError('加载简历列表失败')
      } finally {
        setLoading(false)
      }
    }
    loadResumes()
  }, [])

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -220, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 220, behavior: 'smooth' })
    }
  }

  // 格式化时间
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 my-4 shadow-sm border border-indigo-100"
      >
        <div className="flex items-center gap-3 text-indigo-600">
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">正在加载简历列表...</span>
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 rounded-2xl p-6 my-4 shadow-sm border border-red-100"
      >
        <p className="text-red-600 text-sm">{error}</p>
      </motion.div>
    )
  }

  if (resumes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl p-6 my-4 shadow-sm border border-slate-200"
      >
        <div className="text-center py-4">
          <div className="text-4xl mb-3">📄</div>
          <p className="text-slate-600 text-sm mb-2">暂无 HTML 格式的简历</p>
          <p className="text-slate-400 text-xs">
            请先在工作区创建一份 HTML 格式的简历
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700 py-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-indigo-50 via-violet-50 to-slate-50 rounded-2xl p-5 my-4 shadow-lg border border-indigo-100/50"
    >
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shadow-sm">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">选择一份简历</h3>
            <p className="text-xs text-slate-400">点击卡片加载到预览区</p>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg hover:bg-white/50 transition-colors"
          >
            取消
          </button>
        )}
      </div>

      {/* 简历卡片滚动区域 */}
      <div className="relative">
        {/* 左滚动按钮 */}
        {resumes.length > 2 && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-white transition-all -ml-2"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* 卡片容器 */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {resumes.map((resume, index) => (
            <motion.div
              key={resume.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelect(resume)}
              className="flex-shrink-0 w-[200px] bg-white rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-indigo-200 hover:-translate-y-1 transition-all duration-200 group"
            >
              {/* 简历图标 */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-3 group-hover:from-indigo-200 group-hover:to-violet-200 transition-colors">
                <FileText className="w-6 h-6 text-indigo-500" />
              </div>

              {/* 简历名称 */}
              <h4 className="text-sm font-medium text-slate-700 truncate mb-1 group-hover:text-indigo-600 transition-colors">
                {resume.name || '未命名简历'}
              </h4>

              {/* 模板类型标签 */}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                🌐 HTML
              </span>

              {/* 更新时间 */}
              <p className="text-xs text-slate-400 mt-2">
                更新于 {formatDate(resume.updatedAt)}
              </p>
            </motion.div>
          ))}
        </div>

        {/* 右滚动按钮 */}
        {resumes.length > 2 && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-white transition-all -mr-2"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 提示文字 */}
      <p className="text-xs text-slate-400 text-center mt-3">
        共 {resumes.length} 份 HTML 简历可选
      </p>
    </motion.div>
  )
}

export default ResumeSelector
