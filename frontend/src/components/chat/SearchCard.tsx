import React from 'react'
import { Search, ChevronRight } from 'lucide-react'

interface SearchCardProps {
  query: string
  totalResults: number
  onOpen?: () => void
  className?: string
}

export default function SearchCard({
  query,
  totalResults,
  onOpen,
  className = '',
}: SearchCardProps) {
  return (
    <div
      className={`
        relative mt-4 mb-2 rounded-xl border border-gray-200 bg-gray-50/70
        hover:bg-gray-100/70 transition-all cursor-pointer group
        ${className}
      `}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen?.()
        }
      }}
    >
      <div className="flex items-center gap-4 p-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-sm">
          <Search className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500 mb-1">搜索网页</div>
          <div className="font-semibold text-gray-900 truncate">{query || '搜索结果'}</div>
          <div className="text-xs text-gray-400 mt-1 group-hover:text-gray-600 transition-colors">
            点击查看完整结果列表
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="px-2 py-1 rounded-full bg-white border border-gray-200 text-xs font-medium">
            {totalResults} 个结果
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  )
}
