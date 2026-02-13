import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { InlineDatePicker } from '@/components/InlineDatePicker'
import { InlineTimePicker } from '@/components/InlineTimePicker'
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
            <InlineTimePicker
              value={startTime || null}
              placeholder="开始时间"
              disabled={isAllDay}
              portalId="calendar-create-start-time"
              onSelect={(value) => setStartTime(value || '')}
            />
            <InlineTimePicker
              value={endTime || null}
              placeholder="结束时间"
              disabled={isAllDay}
              portalId="calendar-create-end-time"
              onSelect={(value) => setEndTime(value || '')}
            />
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
          {errorMsg ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMsg}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
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
  )
}
