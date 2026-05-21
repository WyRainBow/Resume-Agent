/**
 * ResumeCard 组件 - 简历卡片
 */
import React from 'react'
import { FileText, RefreshCw } from 'lucide-react'
import { AgentSpecialCard } from '@/components/agent-chat/AgentSpecialCard'

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
  title,
  subtitle,
  icon,
  onClick,
  onChangeResume,
  className = '',
}: ResumeCardProps) {
  return (
    <AgentSpecialCard
      className={`my-4 ${className}`}
      icon={icon || <FileText className="h-4 w-4" />}
      title={title}
      subtitle={subtitle || '已加载简历'}
      onClick={onClick}
      footer={
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            className="rounded-lg bg-chat-accent-deep px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-chat-accent-deep/90 active:scale-95"
            onClick={onClick}
          >
            预览
          </button>
          {onChangeResume && (
            <button
              className="flex items-center gap-1 rounded-lg border border-chat-border bg-chat-surface px-3.5 py-1.5 text-xs font-semibold text-chat-ink-muted transition-all hover:border-chat-accent/40 hover:text-chat-accent-deep active:scale-95"
              onClick={onChangeResume}
            >
              <RefreshCw className="h-3 w-3" />
              更换
            </button>
          )}
        </div>
      }
    >
      <p className="text-sm text-chat-ink-muted">点击查看简历预览</p>
    </AgentSpecialCard>
  )
}
