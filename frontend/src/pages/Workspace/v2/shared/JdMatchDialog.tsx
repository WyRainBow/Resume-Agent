/**
 * JD 匹配优化 —— 聚焦弹窗
 * 粘贴目标岗位 JD → 自动给出多维匹配度评分 → 一键进入按 JD 的逐字段优化。
 * 取代原先常驻页面底部的 JD 评分大框，与「翻译」「体检」保持一致的弹窗交互。
 */
import { useEffect, useRef } from 'react'
import { Target, X, Wand2, Loader2 } from 'lucide-react'
import { ScoreCard } from '@/components/ScoreCard'

type ScoreData = {
  overallScore: number
  dimensions: { name: string; score: number; reasons: string[] }[]
  jdText: string
}

interface JdMatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jdText: string
  onJdTextChange: (value: string) => void
  scoreData: ScoreData | null
  scoring: boolean
  hasContent: boolean
  onOptimize: () => void
}

export default function JdMatchDialog({
  open,
  onOpenChange,
  jdText,
  onJdTextChange,
  scoreData,
  scoring,
  hasContent,
  onOptimize,
}: JdMatchDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) textareaRef.current?.focus()
  }, [open])

  if (!open) return null

  const jdFilled = jdText.trim().length >= 10
  const canOptimize = jdFilled && hasContent
  const hint = !hasContent
    ? '简历内容为空，请先填写简历'
    : !jdFilled
    ? '请先粘贴职位描述'
    : '可进入逐字段优化'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">JD 匹配优化</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                粘贴目标岗位描述、AI 分析匹配度并按 JD 优化简历
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 min-h-0">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
            职位描述（JD）
          </label>
          <textarea
            ref={textareaRef}
            value={jdText}
            onChange={e => onJdTextChange(e.target.value)}
            placeholder="粘贴目标岗位的职位描述，例如：负责后端微服务架构设计与落地，要求熟悉 Go / Kubernetes / gRPC……"
            className="w-full min-h-[140px] p-3 border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />

          {!jdFilled && (
            <p className="mt-2 text-xs text-neutral-400">粘贴完整 JD 后，AI 会自动分析简历与岗位的匹配度。</p>
          )}

          {jdFilled && scoring && !scoreData && (
            <div className="mt-3 flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              正在分析匹配度…
            </div>
          )}

          {scoreData && <ScoreCard {...scoreData} />}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-neutral-200 dark:border-neutral-800 px-5 py-3">
          <span className="text-xs text-neutral-400">{hint}</span>
          <button
            onClick={onOptimize}
            disabled={!canOptimize}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Wand2 className="w-3.5 h-3.5" /> 一键优化简历
          </button>
        </div>
      </div>
    </div>
  )
}
