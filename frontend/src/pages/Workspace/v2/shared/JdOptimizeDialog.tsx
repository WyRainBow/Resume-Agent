/**
 * 针对 JD 的简历优化弹窗
 * 输入 JD + 多字段内容 → AI 给出匹配度、缺失关键词、各字段 before→after 建议，
 * 支持逐条 / 一键应用（确定性 original→suggested 替换，由父级写回对应字段）。
 */
import { useEffect, useState, useCallback } from 'react'
import { Loader2, Target, X, Check, Wand2, AlertTriangle } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { jdOptimize, type JdOptimizeField, type JdOptimizeResult } from '../../../../services/api'

interface JdOptimizeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: JdOptimizeField[]
  jdText: string
  onApply: (key: string, original: string, suggested: string) => void
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-neutral-400'
  if (score < 60) return 'text-red-500'
  if (score < 80) return 'text-amber-500'
  return 'text-emerald-500'
}

export default function JdOptimizeDialog({
  open,
  onOpenChange,
  fields,
  jdText,
  onApply,
}: JdOptimizeDialogProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<JdOptimizeResult | null>(null)
  const [applied, setApplied] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const labelByKey = new Map(fields.map(f => [f.key, f.label]))

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setApplied(new Set())
    try {
      const res = await jdOptimize(fields, jdText)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : '优化分析失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [fields, jdText])

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
    result.suggestions.forEach((s, idx) => {
      if (next.has(idx)) return
      onApply(s.key, s.original, s.suggested)
      next.add(idx)
    })
    setApplied(next)
  }

  if (!open) return null

  const suggestions = result?.suggestions ?? []
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
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">针对 JD 优化简历</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {loading ? 'AI 正在分析匹配度...' : '按目标岗位优化措辞与关键词'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {result && result.matchScore !== null && (
              <div className={cn('text-sm font-bold tabular-nums', scoreColor(result.matchScore))}>
                匹配 {result.matchScore}<span className="text-xs font-normal text-neutral-400">/100</span>
              </div>
            )}
            {result && result.atsScore !== null && (
              <div className={cn('text-sm font-bold tabular-nums', scoreColor(result.atsScore))} title="ATS（招聘方简历筛选系统）兼容度">
                ATS {result.atsScore}<span className="text-xs font-normal text-neutral-400">/100</span>
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
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">AI 正在对照 JD 分析简历...</p>
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
              {result.keywordMatches.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">已命中的 JD 关键词</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.keywordMatches.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.missingKeywords.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">JD 中缺失的关键词</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missingKeywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-3">
                    <Check className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">暂无可应用的改写建议</p>
                </div>
              ) : (
                <div className="space-y-3">
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
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50">
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
                        {s.reason && (
                          <p className="text-xs text-neutral-400 mt-1.5">理由：{s.reason}</p>
                        )}
                        {!isApplied && (
                          <div className="flex justify-end mt-2.5">
                            <button
                              onClick={() => applyOne(idx)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
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
            重新分析
          </button>
          {remaining > 0 && (
            <button
              onClick={applyAll}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-40"
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
