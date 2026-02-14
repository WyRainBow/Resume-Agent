import React from 'react'
import { X, ExternalLink } from 'lucide-react'
import CustomScrollbar from '../common/CustomScrollbar'

interface SearchResultItem {
  position?: number
  url?: string
  title?: string
  description?: string
  source?: string
  raw_content?: string
}

interface SearchResultPanelProps {
  isOpen: boolean
  query: string
  totalResults: number
  results: SearchResultItem[]
  onClose: () => void
}

export default function SearchResultPanel({
  isOpen,
  query,
  totalResults,
  results,
  onClose,
}: SearchResultPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/30"
        role="button"
        tabIndex={-1}
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[420px] bg-white shadow-2xl border-l border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="text-xs text-gray-500">搜索网页</div>
            <div className="font-semibold text-gray-900 truncate">{query}</div>
            <div className="text-xs text-gray-400 mt-1">共 {totalResults} 条结果</div>
          </div>
          <button
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <CustomScrollbar className="flex-1 px-5 py-4 space-y-4">
          {results.map((item, index) => (
            <div key={`${item.url || index}`} className="border-b border-gray-100 pb-4">
              <div className="text-sm font-medium text-gray-900">
                {item.title || '无标题'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {item.source || '未知来源'}
              </div>
              {item.description && (
                <div className="text-xs text-gray-600 mt-2">
                  {item.description}
                </div>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 mt-2 hover:underline"
                >
                  打开链接
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
          {results.length === 0 && (
            <div className="text-sm text-gray-400">暂无搜索结果</div>
          )}
        </CustomScrollbar>
      </aside>
    </div>
  )
}
