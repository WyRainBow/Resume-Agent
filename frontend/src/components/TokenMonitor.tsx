/**
 * Token 使用量监控组件
 * 显示本次请求的 token 使用情况
 */
import { Activity } from 'lucide-react'
import { cn } from '../lib/utils'

interface TokenUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

interface TokenMonitorProps {
  usage?: TokenUsage
  className?: string
}

export default function TokenMonitor({ usage, className }: TokenMonitorProps) {
  // 如果没有 usage 信息或所有值都是 0，不显示
  if (!usage || (usage.total_tokens === 0 && usage.prompt_tokens === 0 && usage.completion_tokens === 0)) {
    return null
  }

  const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = usage

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
        'bg-slate-50 dark:bg-slate-800',
        'border border-slate-200 dark:border-slate-700',
        'text-xs text-slate-600 dark:text-slate-400',
        className
      )}
    >
      <Activity className="w-3.5 h-3.5 text-blue-500" />
      <div className="flex items-center gap-3">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          总: {total_tokens.toLocaleString()}
        </span>
        <span className="text-slate-500 dark:text-slate-500">
          输入: {prompt_tokens.toLocaleString()}
        </span>
        <span className="text-slate-500 dark:text-slate-500">
          输出: {completion_tokens.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

