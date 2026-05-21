import React from 'react'
import { Search, ChevronRight, Clock } from 'lucide-react'
import { AgentSpecialCard } from '@/components/agent-chat/AgentSpecialCard'

interface SearchCardProps {
  query: string
  totalResults: number
  searchTime?: string
  onOpen?: () => void
  className?: string
}

export default function SearchCard({
  query,
  totalResults,
  searchTime,
  onOpen,
  className = '',
}: SearchCardProps) {
  return (
    <AgentSpecialCard
      className={`my-4 ${className}`}
      icon={<Search className="h-4 w-4" />}
      title={query || '搜索结果'}
      subtitle="搜索网页"
      onClick={onOpen}
      badge={
        <div className="flex items-center gap-2 text-sm text-chat-ink-muted">
          {searchTime && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <Clock className="h-3 w-3" />
              {searchTime}
            </span>
          )}
          <span className="rounded-full border border-chat-border bg-chat-surface px-2 py-1 text-xs font-medium">
            {totalResults} 个结果
          </span>
          <ChevronRight className="h-4 w-4 text-chat-accent" />
        </div>
      }
    >
      <p className="text-sm text-chat-ink-muted">点击查看完整结果列表</p>
    </AgentSpecialCard>
  )
}
