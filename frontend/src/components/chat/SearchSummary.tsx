import React from 'react'
import { Clock } from 'lucide-react'

interface SearchResultItem {
  position?: number
  url?: string
  title?: string
  description?: string
  source?: string
  raw_content?: string
}

interface SearchSummaryProps {
  query: string
  results: SearchResultItem[]
  searchTime?: string
}

const isWeatherQuery = (query: string) => /天气|weather/i.test(query)
const isNewsQuery = (query: string) => /新闻|news/i.test(query)

// 搜索时间显示组件
function SearchTimeDisplay({ searchTime }: { searchTime?: string }) {
  if (!searchTime) return null
  return (
    <div className="flex items-center gap-1 text-xs text-emerald-600">
      <Clock className="w-3 h-3" />
      <span>实时数据 · {searchTime}</span>
    </div>
  )
}

export default function SearchSummary({ query, results, searchTime }: SearchSummaryProps) {
  if (!results || results.length === 0) {
    return (
      <div className="mt-3 text-xs text-gray-400">
        暂无可用的搜索摘要
      </div>
    )
  }

  const topResults = results.slice(0, 3)

  if (isWeatherQuery(query)) {
    return (
      <div className="mt-3 rounded-lg border border-gray-200 bg-white">
        <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 flex items-center justify-between">
          <span>天气摘要</span>
          <SearchTimeDisplay searchTime={searchTime} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="px-4 py-2 font-medium">标题</th>
                <th className="px-4 py-2 font-medium">来源</th>
                <th className="px-4 py-2 font-medium">摘要</th>
              </tr>
            </thead>
            <tbody>
              {topResults.map((item, index) => (
                <tr key={`${item.url || index}`} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-700">
                    {item.title || '无标题'}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {item.source || '未知'}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {item.description || '暂无摘要'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (isNewsQuery(query)) {
    return (
      <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">新闻摘要</span>
          <SearchTimeDisplay searchTime={searchTime} />
        </div>
        <div className="space-y-3">
          {topResults.map((item, index) => (
            <div key={`${item.url || index}`} className="text-sm">
              <div className="text-gray-800 font-medium">
                {item.title || '无标题'}
              </div>
              <div className="text-xs text-gray-500">
                {item.source || '未知来源'}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {item.description || '暂无摘要'}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">搜索摘要</span>
        <SearchTimeDisplay searchTime={searchTime} />
      </div>
      <div className="space-y-2">
        {topResults.map((item, index) => (
          <div key={`${item.url || index}`} className="text-sm text-gray-700">
            <div className="font-medium">{item.title || '无标题'}</div>
            <div className="text-xs text-gray-500">
              {item.source || '未知来源'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
