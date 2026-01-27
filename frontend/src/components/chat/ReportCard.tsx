/**
 * ReportCard 组件 - 报告卡片
 * 
 * 在对话中显示生成的报告卡片，点击后可在右侧查看详细报告
 * 样式参考：Microsoft Brand Report 卡片
 */
import React from 'react'
import { Sparkles, ExternalLink } from 'lucide-react'

interface ReportCardProps {
  reportId: string
  title: string
  subtitle?: string
  icon?: React.ReactNode
  onClick?: () => void
  className?: string
}

export default function ReportCard({
  reportId,
  title,
  subtitle,
  icon,
  onClick,
  className = '',
}: ReportCardProps) {
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
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
          {icon || (
            <div className="grid grid-cols-2 gap-0.5 w-8 h-8">
              <div className="bg-green-500 rounded-tl" />
              <div className="bg-red-500 rounded-tr" />
              <div className="bg-blue-500 rounded-bl" />
              <div className="bg-yellow-500 rounded-br" />
            </div>
          )}
        </div>

        {/* 中间内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-sm text-gray-500 truncate">{subtitle}</p>
          )}
          <p className="text-xs text-gray-400 mt-1 group-hover:text-gray-600 transition-colors">
            Click to view full report →
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
            Report
          </button>
        </div>
      </div>
    </div>
  )
}
