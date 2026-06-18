/**
 * 简历一键翻译弹窗
 * 选目标语言 → AI 把各文本字段翻译成目标语言（保留 HTML 结构）→ 逐字段 before→after 预览，
 * 支持逐条 / 一键应用（确定性 original→translated 替换，由父级写回对应字段）。
 */
import { useEffect, useState, useCallback } from 'react'
import { Loader2, Languages, X, Check, Wand2, AlertTriangle } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { translateResume, type JdOptimizeField, type TranslateResult } from '../../../../services/api'

interface TranslateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: JdOptimizeField[]
  onApply: (key: string, original: string, suggested: string) => void
  /** 批量应用：一次性写回所有条目，避免多次 setState */
  onApplyBatch: (items: { key: string; original: string; suggested: string }[]) => void
}

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: '英语 English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日语 日本語' },
  { code: 'ko', label: '韩语 한국어' },
  { code: 'fr', label: '法语 Français' },
  { code: 'de', label: '德语 Deutsch' },
  { code: 'es', label: '西班牙语 Español' },
]

export default function TranslateDialog({ open, onOpenChange, fields, onApply, onApplyBatch }: TranslateDialogProps) {
  const [lang, setLang] = useState('en')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [applied, setApplied] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const labelByKey = new Map(fields.map(f => [f.key, f.label]))

  const run = useCallback(async (targetLang: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setApplied(new Set())
    try {
      const res = await translateResume(fields, targetLang)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : '翻译失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [fields])

  useEffect(() => {
    if (open) {
      run(lang)
    } else {
      setResult(null)
      setApplied(new Set())
      setError(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const onChangeLang = (code: string) => {
    setLang(code)
    run(code)
  }

  const applyOne = (idx: number) => {
    if (!result || applied.has(idx)) return
    const t = result.translations[idx]
    onApply(t.key, t.original, t.translated)
    setApplied(prev => new Set(prev).add(idx))
  }

  const applyAll = () => {
    if (!result) return
    const next = new Set(applied)
    const batch: { key: string; original: string; suggested: string }[] = []
    result.translations.forEach((t, idx) => {
      if (next.has(idx)) return
      batch.push({ key: t.key, original: t.original, suggested: t.translated })
      next.add(idx)
    })
    if (batch.length) onApplyBatch(batch)
    setApplied(next)
  }

  if (!open) return null

  const translations = result?.translations ?? []
  const remaining = translations.length - applied.size

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && !loading && onOpenChange(false)}
    >
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500">
              <Languages className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">简历一键翻译</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {loading ? 'AI 正在翻译...' : '把简历文本字段翻译成目标语言，可逐条应用'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={e => onChangeLang(e.target.value)}
              disabled={loading}
              className="text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 px-2 py-1.5 disabled:opacity-40"
            >
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
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
              <Loader2 className="h-8 w-8 animate-spin text-teal-500 mb-3" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">AI 正在翻译简历...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && result && (
            translations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm text-neutral-600 dark:text-neutral-300">没有可翻译的字段内容</p>
              </div>
            ) : (
              <div className="space-y-3">
                {translations.map((t, idx) => {
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
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/50">
                          {labelByKey.get(t.key) || t.key}
                        </span>
                        {isApplied && (
                          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="w-3 h-3" /> 已应用
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mb-1" dangerouslySetInnerHTML={{ __html: t.original }} />
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100" dangerouslySetInnerHTML={{ __html: t.translated }} />
                      {!isApplied && (
                        <div className="flex justify-end mt-2.5">
                          <button
                            onClick={() => applyOne(idx)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-teal-500 hover:bg-teal-600 text-white font-medium transition-colors"
                          >
                            <Check className="w-3 h-3" /> 应用
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-neutral-800 px-5 py-3">
          <button
            onClick={() => run(lang)}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
          >
            重新翻译
          </button>
          {remaining > 0 && (
            <button
              onClick={applyAll}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-medium transition-colors disabled:opacity-40"
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
