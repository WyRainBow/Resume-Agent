import { useEffect, useMemo, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { InlineDatePicker } from '@/components/InlineDatePicker'
import { parseDateTimeInput, toDateInputValue, toTimeInputValue } from '../dateUtils'

type CreateScheduleModalProps = {
  open: boolean
  defaultStart: Date
  defaultEnd: Date
  mode?: 'create' | 'edit'
  initialTitle?: string
  initialLocation?: string
  initialNotes?: string
  initialIsAllDay?: boolean
  onClose: () => void
  onSubmit: (payload: {
    title: string
    startsAt: Date
    endsAt: Date
    isAllDay: boolean
    location?: string
    notes?: string
  }) => Promise<void>
}

export function CreateScheduleModal({
  open,
  defaultStart,
  defaultEnd,
  mode = 'create',
  initialTitle = '',
  initialLocation = '',
  initialNotes = '',
  initialIsAllDay = false,
  onClose,
  onSubmit,
}: CreateScheduleModalProps) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [isAllDay, setIsAllDay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [aiInputOpen, setAiInputOpen] = useState(false)
  const [aiInputText, setAiInputText] = useState('')

  const parseChineseHour = (text: string): number | null => {
    const normalized = text
      .replace(/两/g, '2')
      .replace(/一/g, '1')
      .replace(/二/g, '2')
      .replace(/三/g, '3')
      .replace(/四/g, '4')
      .replace(/五/g, '5')
      .replace(/六/g, '6')
      .replace(/七/g, '7')
      .replace(/八/g, '8')
      .replace(/九/g, '9')
      .replace(/十/g, '10')
    const n = Number(normalized)
    if (Number.isNaN(n)) return null
    return n
  }

  const applyAiSentence = () => {
    const text = aiInputText.trim()
    if (!text) {
      setErrorMsg('请输入一句话描述')
      return
    }
    const now = new Date()
    let parsedYear = now.getFullYear()
    let parsedMonth = now.getMonth() + 1
    let parsedDay = now.getDate()
    let parsedStartHour = 9
    let parsedStartMinute = 0
    let parsedEndHour = 10
    let parsedEndMinute = 0

    const md = text.match(/(\d{1,2})[月\./-](\d{1,2})(?:[日号])?/)
    if (md) {
      parsedMonth = Number(md[1])
      parsedDay = Number(md[2])
    }
    const ymd = text.match(/(\d{4})[年\./-](\d{1,2})[月\./-](\d{1,2})(?:[日号])?/)
    if (ymd) {
      parsedYear = Number(ymd[1])
      parsedMonth = Number(ymd[2])
      parsedDay = Number(ymd[3])
    }

    const hm = text.match(/(\d{1,2})(?::|点)(\d{1,2})?\s*(?:分)?\s*(?:到|-|—|~|～)\s*(\d{1,2})(?::|点)(\d{1,2})?\s*(?:分)?/)
    if (hm) {
      parsedStartHour = Number(hm[1])
      parsedStartMinute = hm[2] ? Number(hm[2]) : 0
      parsedEndHour = Number(hm[3])
      parsedEndMinute = hm[4] ? Number(hm[4]) : 0
    } else {
      const chineseTime = text.match(/(上午|中午|下午|晚上)?\s*([一二三四五六七八九十两\d]{1,2})点\s*(?:到|-|—|~|～)\s*(?:([一二三四五六七八九十两\d]{1,2})点)?/)
      if (chineseTime) {
        const period = chineseTime[1] || ''
        const startHourRaw = parseChineseHour(chineseTime[2] || '')
        const endHourRaw = parseChineseHour(chineseTime[3] || '') ?? (startHourRaw !== null ? startHourRaw + 1 : null)
        if (startHourRaw !== null && endHourRaw !== null) {
          parsedStartHour = startHourRaw
          parsedEndHour = endHourRaw
          if ((period === '下午' || period === '晚上') && parsedStartHour < 12) parsedStartHour += 12
          if ((period === '下午' || period === '晚上') && parsedEndHour <= 12) parsedEndHour += 12
        }
      }
    }

    const titleRaw =
      text
        .replace(/帮我创建(一个)?/g, '')
        .replace(/日程/g, '')
        .replace(/时间为/g, '')
        .replace(/(\d{4})[年\./-](\d{1,2})[月\./-](\d{1,2})(?:[日号])?/g, '')
        .replace(/(\d{1,2})[月\./-](\d{1,2})(?:[日号])?/g, '')
        .replace(/(上午|中午|下午|晚上)?\s*([一二三四五六七八九十两\d]{1,2})点.*?(到|-|—|~|～).*?([一二三四五六七八九十两\d]{1,2})点?/g, '')
        .replace(/(\d{1,2})(?::|点)(\d{1,2})?\s*(?:分)?\s*(?:到|-|—|~|～)\s*(\d{1,2})(?::|点)(\d{1,2})?\s*(?:分)?/g, '')
        .replace(/[，,。]/g, ' ')
        .trim() || '面试安排'

    const start = new Date(parsedYear, parsedMonth - 1, parsedDay, parsedStartHour, parsedStartMinute, 0, 0)
    const end = new Date(parsedYear, parsedMonth - 1, parsedDay, parsedEndHour, parsedEndMinute, 0, 0)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setErrorMsg('AI 导入失败，请改成例如：2.15 下午两点到三点 腾讯一面')
      return
    }

    setTitle(titleRaw)
    setStartDate(toDateInputValue(start))
    setEndDate(toDateInputValue(end))
    setStartTime(toTimeInputValue(start))
    setEndTime(toTimeInputValue(end))
    setIsAllDay(false)
    setErrorMsg('')
    setAiInputOpen(false)
  }

  useEffect(() => {
    if (!open) return
    setStartDate(toDateInputValue(defaultStart))
    setStartTime(toTimeInputValue(defaultStart))
    setEndDate(toDateInputValue(defaultEnd))
    setEndTime(toTimeInputValue(defaultEnd))
    setTitle(initialTitle)
    setLocation(initialLocation)
    setNotes(initialNotes)
    setIsAllDay(initialIsAllDay)
    setSaving(false)
    setErrorMsg('')
    setAiInputOpen(false)
    setAiInputText('')
  }, [open, defaultStart, defaultEnd, initialTitle, initialLocation, initialNotes, initialIsAllDay])

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false
    if (!startDate || !endDate) return false
    if (!isAllDay && (!startTime || !endTime)) return false
    return true
  }, [title, startDate, endDate, startTime, endTime, isAllDay])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-[760px] rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-2xl font-bold text-slate-900">{mode === 'edit' ? '编辑日程' : '创建日程'}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="添加主题"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg outline-none focus:border-blue-400"
          />

          <div className="grid grid-cols-2 gap-3">
            <InlineDatePicker
              value={startDate || null}
              placeholder="开始日期"
              portalId="calendar-create-start-date"
              onSelect={(value) => setStartDate(value || '')}
            />
            <InlineDatePicker
              value={endDate || null}
              placeholder="结束日期"
              portalId="calendar-create-end-date"
              onSelect={(value) => setEndDate(value || '')}
            />
            <input disabled={isAllDay} value={startTime} onChange={(e) => setStartTime(e.target.value)} type="time" className="rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
            <input disabled={isAllDay} value={endTime} onChange={(e) => setEndTime(e.target.value)} type="time" className="rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
          </div>

          <label className="flex items-center gap-2 text-base text-slate-700">
            <input checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} type="checkbox" /> 全天
          </label>

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="添加地点"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="备注"
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
          />
          {aiInputOpen ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
              <p className="mb-2 text-sm font-medium text-blue-700">
                一句话让 AI 帮你导入日程。例如：帮我创建一个 2.15 号下午两点到三点的日程、腾讯一面
              </p>
              <textarea
                value={aiInputText}
                onChange={(e) => setAiInputText(e.target.value)}
                rows={3}
                placeholder="粘贴一句话描述..."
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAiInputOpen(false)
                    setAiInputText('')
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={applyAiSentence}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  导入到表单
                </button>
              </div>
            </div>
          ) : null}
          {errorMsg ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMsg}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={() => {
              setErrorMsg('')
              setAiInputOpen((v) => !v)
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            AI 导入日程
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-6 py-2.5 text-lg text-slate-700 hover:bg-slate-100">取消</button>
            <button
              type="button"
              disabled={!canSubmit || saving}
              onClick={async () => {
                if (!canSubmit || saving) return
                setErrorMsg('')
                const startsAt = parseDateTimeInput(startDate, isAllDay ? '00:00' : startTime)
                const endsAt = parseDateTimeInput(endDate, isAllDay ? '23:59' : endTime)
                if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
                  setErrorMsg('日期或时间格式无效，请重新选择')
                  return
                }
                if (endsAt <= startsAt) {
                  setErrorMsg('结束时间必须晚于开始时间')
                  return
                }
                setSaving(true)
                try {
                  await onSubmit({
                    title: title.trim(),
                    startsAt,
                    endsAt,
                    isAllDay,
                    location: location.trim() || undefined,
                    notes: notes.trim() || undefined,
                  })
                } catch (error) {
                  const message = error instanceof Error ? error.message : ''
                  setErrorMsg(message || '保存失败，请稍后重试')
                } finally {
                  setSaving(false)
                }
              }}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-lg font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
