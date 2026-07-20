/**
 * 针对 JD 的简历优化弹窗
 * 输入 JD + 多字段内容 → AI 给出匹配度、缺失关键词、各字段 before→after 建议，
 * 支持逐条 / 一键应用（确定性 original→suggested 替换，由父级写回对应字段）。
 */
import { useEffect, useState, useCallback } from 'react'
import { Loader2, Target, X, Check, Wand2, AlertTriangle, Plus } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { jdOptimize, jdIntegrateKeyword, type JdOptimizeField, type JdOptimizeResult } from '../../../../services/api'
import { looksLikeHtml } from '../../../../utils/resumePatch'
import { linkifyHtmlContent } from '../../../../utils/linkifyText'
import AiProgressBar from './AiProgressBar'

/** 缺失关键词「一键融入」的单条状态 */
type KeywordIntegration =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready' | 'applied'; key: string; original: string; suggested: string; reason: string }

interface JdOptimizeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: JdOptimizeField[]
  jdText: string
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

/**
 * 渲染简历字段的「修改前 / 修改后」文本：富文本字段是 HTML（<ul class="custom-list">…），
 * 直接当文本会露出标签，故按内容是否为 HTML 分流——HTML 用 .diff-rich-content 安全渲染
 * （正确显示圆点列表、加粗），纯文本保留换行。修改前弱化、修改后强调，与对话区 diff 卡一致。
 */
function RichFieldText({ value, tone }: { value: string; tone: 'original' | 'suggested' }) {
  const toneCls =
    tone === 'original'
      ? 'text-neutral-400 dark:text-neutral-500'
      : 'text-neutral-800 dark:text-neutral-100 font-medium'

  if (!value || !value.trim()) {
    return (
      <p className="text-sm italic text-neutral-400">
        {tone === 'original' ? '（原先无内容）' : '（无内容）'}
      </p>
    )
  }

  if (looksLikeHtml(value)) {
    return (
      <div
        className={cn('diff-rich-content text-sm', toneCls)}
        dangerouslySetInnerHTML={{ __html: linkifyHtmlContent(value) }}
      />
    )
  }

  return <p className={cn('text-sm whitespace-pre-wrap', toneCls)}>{value}</p>
}

export default function JdOptimizeDialog({
  open,
  onOpenChange,
  fields,
  jdText,
  onApply,
  onApplyBatch,
}: JdOptimizeDialogProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<JdOptimizeResult | null>(null)
  const [applied, setApplied] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [integrations, setIntegrations] = useState<Record<string, KeywordIntegration>>({})

  const labelByKey = new Map(fields.map(f => [f.key, f.label]))

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setApplied(new Set())
    setIntegrations({})
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
      setIntegrations({})
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // 缺失关键词「一键融入」：让 AI 把该关键词自然写进最相关的一条经历
  const integrateKeyword = async (kw: string) => {
    if (integrations[kw]) return // 进行中或已出结果，不重复请求
    setIntegrations(prev => ({ ...prev, [kw]: { status: 'loading' } }))
    try {
      const res = await jdIntegrateKeyword(kw, fields, jdText)
      setIntegrations(prev => ({
        ...prev,
        [kw]: res.integrated
          ? { status: 'ready', key: res.key, original: res.original, suggested: res.suggested, reason: res.reason }
          : { status: 'failed' },
      }))
    } catch {
      setIntegrations(prev => ({ ...prev, [kw]: { status: 'failed' } }))
    }
  }

  const applyIntegration = (kw: string) => {
    const it = integrations[kw]
    if (!it || it.status !== 'ready') return
    onApply(it.key, it.original, it.suggested)
    setIntegrations(prev => ({ ...prev, [kw]: { ...it, status: 'applied' } }))
  }

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
              <Loader2 className="h-7 w-7 animate-spin text-blue-500 mb-4" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">AI 正在对照 JD 分析简历...</p>
              <AiProgressBar active={loading} barClassName="bg-gradient-to-r from-blue-500 to-indigo-500" estimateMs={14000} />
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
              {(result.atsChecklist?.length ?? 0) > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5" title="ATS（招聘方简历筛选系统）逐条兼容检查">ATS 兼容检查</p>
                  <div className="space-y-1">
                    {result.atsChecklist!.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs leading-5">
                        <span className={cn(
                          'mt-0.5 shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold border',
                          c.status === 'pass' && 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
                          c.status === 'fail' && 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
                          c.status === 'template' && 'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700',
                        )}>
                          {c.status === 'pass' ? '达标' : c.status === 'fail' ? '待改' : '模板保证'}
                        </span>
                        <span className="text-neutral-700 dark:text-neutral-300">
                          {c.item}
                          {c.note && <span className="text-neutral-400 dark:text-neutral-500">｜{c.note}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                    JD 中缺失的关键词<span className="text-neutral-400 font-normal">（点击让 AI 融入相关经历）</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missingKeywords.map((kw, i) => {
                      const st = integrations[kw]
                      const status = st?.status
                      return (
                        <button
                          key={i}
                          onClick={() => integrateKeyword(kw)}
                          disabled={status === 'loading' || status === 'ready' || status === 'applied'}
                          title={status === 'failed' ? '难以自然融入，点击重试' : '点击让 AI 把该关键词融入最相关的经历'}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                            status === 'applied' || status === 'ready'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
                              : status === 'failed'
                              ? 'bg-neutral-50 text-neutral-400 border-neutral-200 line-through dark:bg-neutral-800/40 dark:border-neutral-700'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50 dark:hover:bg-amber-900/40'
                          )}
                        >
                          {status === 'loading' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : status === 'applied' || status === 'ready' ? (
                            <Check className="w-3 h-3" />
                          ) : status === 'failed' ? null : (
                            <Plus className="w-3 h-3" />
                          )}
                          {kw}
                        </button>
                      )
                    })}
                  </div>

                  {/* 融入结果卡片：original → suggested，可应用 */}
                  {result.missingKeywords.some(kw => {
                    const s = integrations[kw]?.status
                    return s === 'ready' || s === 'applied'
                  }) && (
                    <div className="mt-2.5 space-y-2">
                      {result.missingKeywords.map(kw => {
                        const it = integrations[kw]
                        if (!it || (it.status !== 'ready' && it.status !== 'applied')) return null
                        const isApplied = it.status === 'applied'
                        return (
                          <div
                            key={kw}
                            className={cn(
                              'rounded-lg border p-3 transition-colors',
                              isApplied
                                ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                                : 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10'
                            )}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                融入「{kw}」→ {labelByKey.get(it.key) || it.key}
                              </span>
                              {isApplied && (
                                <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  <Check className="w-3 h-3" /> 已应用
                                </span>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <RichFieldText value={it.original} tone="original" />
                              <RichFieldText value={it.suggested} tone="suggested" />
                            </div>
                            {it.reason && <p className="text-xs text-neutral-400 mt-1.5">理由：{it.reason}</p>}
                            {!isApplied && (
                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => applyIntegration(kw)}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
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
                        <div className="space-y-1.5">
                          <RichFieldText value={s.original} tone="original" />
                          <RichFieldText value={s.suggested} tone="suggested" />
                        </div>
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
