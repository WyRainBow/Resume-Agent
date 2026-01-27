/**
 * ResumeCard 组件 - 简历卡片
 * 
 * 在对话中显示加载的简历卡片，点击后可在右侧查看详细简历
 * 样式参考：ReportCard 组件
 */
import React from 'react'
import { FileText } from 'lucide-react'

interface ResumeCardProps {
  resumeId: string
  title: string
  subtitle?: string
  icon?: React.ReactNode
  onClick?: () => void
  className?: string
}

export default function ResumeCard({
  resumeId,
  title,
  subtitle,
  icon,
  onClick,
  className = '',
}: ResumeCardProps) {
  return (
    <div
      className={`
        relative mt-4 mb-2 rounded-xl border border-gray-200 bg-gray-50/50 
        hover:bg-gray-100/50 transition-all cursor-pointer group
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-4 p-4">
        {/* 左侧图标 */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center shadow-sm">
          {icon || (
            <FileText className="w-6 h-6 text-white" />
          )}
        </div>

        {/* 中间内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-sm text-gray-500 truncate">{subtitle}</p>
          )}
          <p className="text-xs text-gray-400 mt-1 group-hover:text-gray-600 transition-colors">
            点击查看简历 →
          </p>
        </div>

        {/* 右侧按钮 */}
        <div className="flex-shrink-0">
          <button
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg 
                     hover:bg-gray-50 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onClick?.()
            }}
          >
            简历
          </button>
        </div>
      </div>
    </div>
  )
}
