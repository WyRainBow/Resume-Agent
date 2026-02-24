/**
 * ResumeCard 组件 - 简历卡片
 * 
 * 在对话中显示加载的简历卡片，点击后可在右侧查看详细简历
 * 样式参考：ReportCard 组件
 */
import React from 'react'
import { FileText, RefreshCw } from 'lucide-react'

interface ResumeCardProps {
  resumeId: string
  title: string
  subtitle?: string
  icon?: React.ReactNode
  onClick?: () => void
  onChangeResume?: () => void
  className?: string
}

export default function ResumeCard({
  resumeId,
  title,
  subtitle,
  icon,
  onClick,
  onChangeResume,
  className = '',
}: ResumeCardProps) {
  return (
    <div
      className={`
        relative mt-4 mb-2 rounded-2xl border border-slate-200 bg-white
        hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-4 p-4">
        {/* 左侧图标 */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shadow-sm border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
          {icon || (
            <FileText className="w-6 h-6 text-indigo-600" />
          )}
        </div>

        {/* 中间内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-slate-900 truncate text-[15px]">{title}</h3>
          </div>
          <div className="flex flex-col gap-1">
            {subtitle && (
              <p className="text-sm text-slate-500 truncate font-medium">{subtitle}</p>
            )}
            <p className="text-xs text-slate-400 group-hover:text-indigo-500 transition-colors flex items-center gap-1">
              点击查看简历预览
            </p>
          </div>
        </div>

        {/* 右侧按钮组 */}
        <div className="flex flex-col gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg 
                     hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
            onClick={onClick}
          >
            预览
          </button>
          {onChangeResume && (
            <button
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg 
                       hover:bg-slate-100 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-1 active:scale-95"
              onClick={onChangeResume}
            >
              <RefreshCw className="w-3 h-3" />
              更换
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
