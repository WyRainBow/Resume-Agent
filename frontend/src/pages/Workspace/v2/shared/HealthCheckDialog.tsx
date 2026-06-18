/**
 * 通用简历体检弹窗（无需 JD）
 * AI 从完整度/表达/量化/关键词/格式等维度打分，并给出逐条可应用的改写建议。
 * 应用走确定性 original→suggested 替换，由父级写回对应字段。
 */
import { useEffect, useState, useCallback } from 'react'
import { Loader2, Stethoscope, X, Check, Wand2, AlertTriangle } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { healthCheck, type JdOptimizeField, type HealthCheckResult } from '../../../../services/api'

interface HealthCheckDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: JdOptimizeField[]
  onApply: (key: string, original: string, suggested: string) => void
  /** 批量应用：一次性写回所有条目，避免多次 setState */
  onApplyBatch: (items: { key: string; original: string; suggested: string }[]) => void
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-neutral-400'
  if (score < 60) return 'text-red-500'
  if (score < 80) return 'text-amber-500'
  return 'text-emerald-500'
}

function barColor(score: number | null): string {
  if (score === null) return 'bg-neutral-300'
  if (score < 60) return 'bg-red-400'
  if (score < 80) return 'bg-amber-400'
  return 'bg-emerald-400'
}

export default function HealthCheckDialog({ open, onOpenChange, fields, onApply, onApplyBatch }: HealthCheckDialogProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HealthCheckResult | null>(null)
  const [applied, setApplied] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const labelByKey = new Map(fields.map(f => [f.key, f.label]))

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setApplied(new Set())
    try {
      const res = await healthCheck(fields)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : '体检失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [fields])

  useEffect(() => {
    if (open) {
      run()
    } else {
      setResult(null)
      setApplied(new Set())
      setError(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const applyOne = (idx: number) => {
    if (!result || applied.has(idx)) return
    const s = result.suggestions[idx]
    onApply(s.key, s.original, s.suggested)
    setApplied(prev => new Set(prev).add(idx))
  }

  const applyAll = () => {
    if (!result) return
    const next = new Set(applied)
    const batch: { key: string; original: string; suggested: string }[] = []
    result.suggestions.forEach((s, idx) => {
      if (next.has(idx)) return
      batch.push({ key: s.key, original: s.original, suggested: s.suggested })
      next.add(idx)
    })
    if (batch.length) onApplyBatch(batch)
    setApplied(next)
  }

  if (!open) return null

  const suggestions = result?.suggestions ?? []
  const dimensions = result?.dimensions ?? []
  const remaining = suggestions.length - applied.size

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && !loading && onOpenChange(false)}
    >
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">简历体检</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {loading ? 'AI 正在体检...' : '无需 JD 的通用质量评分与改进建议'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result && result.overallScore !== null && (
              <div className={cn('text-sm font-bold tabular-nums', scoreColor(result.overallScore))}>
                {result.overallScore}<span className="text-xs font-normal text-neutral-400">/100</span>
              </div>
            )}
            <button
              onClick={() => !loading && onOpenChange(false)}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-3" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">AI 正在给简历做体检...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && result && (
            <>
              {dimensions.length > 0 && (
                <div className="mb-4 space-y-2.5">
                  {dimensions.map((d, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-neutral-600 dark:text-neutral-300">{d.dimension}</span>
                        <span className={cn('font-medium tabular-nums', scoreColor(d.score))}>{d.score ?? '—'}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div className={cn('h-full rounded-full', barColor(d.score))} style={{ width: `${d.score ?? 0}%` }} />
                      </div>
                      {d.comment && <p className="text-[11px] text-neutral-400 mt-0.5">{d.comment}</p>}
                    </div>
                  ))}
                </div>
              )}

              {result.summary && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">{result.summary}</p>
              )}

              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-3">
                    <Check className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">暂无可应用的改写建议</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">改进建议</p>
                  {suggestions.map((s, idx) => {
                    const isApplied = applied.has(idx)
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'rounded-lg border p-3.5 transition-colors',
                          isApplied
                            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                            : 'border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-800/30'
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-violet-50 text-violet-600 border border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/50">
                            {labelByKey.get(s.key) || s.key}
                          </span>
                          {isApplied && (
                            <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <Check className="w-3 h-3" /> 已应用
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-400 line-through decoration-red-300 mb-1">{s.original}</p>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{s.suggested}</p>
                        {s.reason && <p className="text-xs text-neutral-400 mt-1.5">理由：{s.reason}</p>}
                        {!isApplied && (
                          <div className="flex justify-end mt-2.5">
                            <button
                              onClick={() => applyOne(idx)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors"
                            >
                              <Check className="w-3 h-3" /> 应用
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-neutral-800 px-5 py-3">
          <button
            onClick={run}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
          >
            重新体检
          </button>
          {remaining > 0 && (
            <button
              onClick={applyAll}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-40"
            >
              <Wand2 className="w-3.5 h-3.5" /> 一键全部应用（{remaining}）
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-200 font-medium transition-colors disabled:opacity-40"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
