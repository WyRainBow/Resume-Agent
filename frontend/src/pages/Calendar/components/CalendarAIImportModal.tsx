import { useMemo, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { aiParseCalendarEvent } from '@/services/calendarApi'

type CalendarAIImportModalProps = {
  open: boolean
  onClose: () => void
  onApply: (payload: {
    title: string
    startsAt: Date
    endsAt: Date
    isAllDay: boolean
    location?: string
    notes?: string
  }) => void
}

export function CalendarAIImportModal({ open, onClose, onApply }: CalendarAIImportModalProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const examples = useMemo(
    () => [
      '帮我创建一个 2.15 号下午两点到三点的日程、腾讯一面',
      '帮我创建一个 2.13 号早上 10 点的面试、我是快手一面、要面一个小时',
      '帮我创建一个 2.10 号早上 11 点的面试、我是字节一面、部门是机器审核平台',
    ],
    []
  )
  const tabSuggestion = useMemo(() => {
    const current = text.trim()
    if (!current) return examples[0]
    return examples.find((item) => item.startsWith(current) && item.length > current.length) || ''
  }, [examples, text])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-[680px] rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-2xl font-bold tracking-tight text-slate-900">AI 导入日程</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="space-y-2.5 px-5 py-4">
          <p className="text-base font-semibold leading-7 text-blue-700">
            一句话让 AI 帮你导入日程。例如：帮我创建一个 2.15 号下午两点到三点的日程，腾讯一面
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && tabSuggestion) {
                e.preventDefault()
                setText(tabSuggestion)
              }
            }}
            rows={4}
            placeholder="例如：帮我创建一个 2.13 号早上 10 点的面试，我是快手一面，要面一个小时"
            className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-[15px] leading-6 text-slate-900 outline-none focus:border-blue-400"
          />
          <p className="text-xs text-slate-500">提示：按 Tab 可自动补全示例句。</p>
          {errorMsg ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {errorMsg}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-5 py-3.5">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-5 py-2 text-base font-medium text-slate-700 hover:bg-slate-100">
            取消
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              const sentence = text.trim()
              if (!sentence) {
                setErrorMsg('请输入一句话描述')
                return
              }
              setLoading(true)
              setErrorMsg('')
              try {
                const parsed = await aiParseCalendarEvent(sentence, 'deepseek')
                const title = (parsed.title || '').trim()
                const startsAt = parsed.starts_at ? new Date(parsed.starts_at) : null
                const endsAt = parsed.ends_at ? new Date(parsed.ends_at) : null
                if (!title || !startsAt || Number.isNaN(startsAt.getTime()) || !endsAt || Number.isNaN(endsAt.getTime())) {
                  throw new Error('AI 未提取到完整时间，请补充日期和时间后重试')
                }
                onApply({
                  title,
                  startsAt,
                  endsAt,
                  isAllDay: parsed.is_all_day === true,
                  location: (parsed.location || '').trim() || undefined,
                  notes: (parsed.notes || '').trim() || undefined,
                })
                setText('')
                onClose()
              } catch (error: unknown) {
                const maybeAxios = error as { response?: { data?: { detail?: string } }; message?: string }
                const detail = maybeAxios.response?.data?.detail
                setErrorMsg(typeof detail === 'string' && detail.trim() ? detail : maybeAxios.message || 'AI 导入失败，请稍后重试')
              } finally {
                setLoading(false)
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? '导入中...' : '导入到表单'}
          </button>
        </div>
      </div>
    </div>
  )
}
