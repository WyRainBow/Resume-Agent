/**
 * 语法 / 表达体检弹窗
 * 对单个字段内容做 AI 体检，展示 issues（原文 → 建议 + 严重度），支持逐条 / 一键修复。
 * 修复为确定性替换（original → suggestion），不再额外调用 LLM。
 */
import { useEffect, useState, useCallback } from 'react'
import { Loader2, SpellCheck, X, Check, Wand2, AlertTriangle } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import AiProgressBar from './AiProgressBar'
import { grammarCheckField, type GrammarCheckResult, type GrammarIssue } from '../../../../services/api'

interface GrammarCheckDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string
  onApply: (content: string) => void
  path: string
}

const TYPE_LABEL: Record<GrammarIssue['type'], string> = {
  grammar: '语法',
  wording: '措辞',
  vague: '笼统',
  quantify: '量化',
}

const SEVERITY_STYLE: Record<GrammarIssue['severity'], string> = {
  high: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50',
  medium: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
  low: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
}

const SEVERITY_LABEL: Record<GrammarIssue['severity'], string> = {
  high: '高',
  medium: '中',
  low: '低',
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-neutral-400'
  if (score < 60) return 'text-red-500'
  if (score < 80) return 'text-amber-500'
  return 'text-emerald-500'
}

export default function GrammarCheckDialog({
  open,
  onOpenChange,
  content,
  onApply,
  path,
}: GrammarCheckDialogProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GrammarCheckResult | null>(null)
  const [working, setWorking] = useState('')
  const [applied, setApplied] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const runCheck = useCallback(async (text: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setApplied(new Set())
    try {
      const res = await grammarCheckField(text, path)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : '体检失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    if (open) {
      setWorking(content)
      runCheck(content)
    } else {
      setResult(null)
      setApplied(new Set())
      setError(null)
      setWorking('')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const applyIssue = (idx: number) => {
    if (!result || applied.has(idx)) return
    const issue = result.issues[idx]
    if (!working.includes(issue.original)) {
      // 原文已不在（可能被前一条修改影响），仅标记为已处理
      setApplied(prev => new Set(prev).add(idx))
      return
    }
    const next = working.replace(issue.original, issue.suggestion)
    setWorking(next)
    setApplied(prev => new Set(prev).add(idx))
    onApply(next)
  }

  const applyAll = () => {
    if (!result) return
    let next = working
    const nextApplied = new Set(applied)
    result.issues.forEach((issue, idx) => {
      if (nextApplied.has(idx)) return
      if (next.includes(issue.original)) {
        next = next.replace(issue.original, issue.suggestion)
      }
      nextApplied.add(idx)
    })
    setWorking(next)
    setApplied(nextApplied)
    onApply(next)
  }

  if (!open) return null

  const issues = result?.issues ?? []
  const remaining = issues.length - applied.size

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && !loading && onOpenChange(false)}
    >
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
              <SpellCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">语法 / 表达体检</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {loading ? 'AI 正在检查...' : '检测语法、措辞、笼统与量化问题'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result && result.score !== null && (
              <div className={cn('text-sm font-bold tabular-nums', scoreColor(result.score))}>
                {result.score}<span className="text-xs font-normal text-neutral-400"> / 100</span>
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
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">AI 正在体检该字段...</p>
              <div className="w-full max-w-xs">
                <AiProgressBar active={loading} barClassName="bg-gradient-to-r from-emerald-500 to-teal-500" estimateMs={10000} />
              </div>
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
              {result.summary && (
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">{result.summary}</p>
              )}

              {issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-3">
                    <Check className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">未发现明显问题，表达不错！</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {issues.map((issue, idx) => {
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
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300">
                            {TYPE_LABEL[issue.type]}
                          </span>
                          <span className={cn('px-1.5 py-0.5 rounded border text-[11px] font-medium', SEVERITY_STYLE[issue.severity])}>
                            {SEVERITY_LABEL[issue.severity]}
                          </span>
                          {isApplied && (
                            <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <Check className="w-3 h-3" /> 已应用
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-400 line-through decoration-red-300 mb-1">{issue.original}</p>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{issue.suggestion}</p>
                        {!isApplied && (
                          <div className="flex justify-end mt-2.5">
                            <button
                              onClick={() => applyIssue(idx)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
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
            onClick={() => runCheck(working)}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
          >
            重新检查
          </button>
          {remaining > 0 && (
            <button
              onClick={applyAll}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-40"
            >
              <Wand2 className="w-3.5 h-3.5" /> 一键全部修复（{remaining}）
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
