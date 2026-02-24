import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, formatMonthTitle, getMonthGridRange, isSameChinaDay, startOfDay } from '../dateUtils'
import type { CalendarEvent } from '../types'

type MiniMonthPanelProps = {
  currentDate: Date
  events: CalendarEvent[]
  onPickDate: (date: Date) => void
  onNavigateMonth: (delta: number) => void
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function MiniMonthPanel({ currentDate, events, onPickDate, onNavigateMonth }: MiniMonthPanelProps) {
  const { start } = getMonthGridRange(currentDate)
  const today = startOfDay(new Date())
  const hasEventOnDay = (day: Date) =>
    events.some((ev) => isSameChinaDay(new Date(ev.starts_at), day))

  return (
    <div className="rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="mb-6 flex items-center justify-between">
        <button
          className="text-lg font-black tracking-tight text-slate-900 hover:text-blue-600 transition-colors"
          type="button"
        >
          {formatMonthTitle(currentDate)}
        </button>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button type="button" className="rounded-lg p-1.5 hover:bg-white hover:shadow-sm transition-all active:scale-90" onClick={() => onNavigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <button type="button" className="rounded-lg p-1.5 hover:bg-white hover:shadow-sm transition-all active:scale-90" onClick={() => onNavigateMonth(1)}>
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-7 text-center">
        {WEEK_LABELS.map((label) => (
          <div key={label} className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-2">{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }).map((_, idx) => {
          const day = addDays(start, idx)
          const isCurrentMonth = day.getMonth() === currentDate.getMonth()
          const isToday = startOfDay(day).getTime() === today.getTime()
          const isSelected = startOfDay(day).getTime() === startOfDay(currentDate).getTime()
          const hasEvent = hasEventOnDay(day)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPickDate(day)}
              className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 scale-110 z-10'
                  : isToday
                    ? 'bg-blue-50 text-blue-600'
                    : isCurrentMonth
                      ? 'text-slate-700 hover:bg-slate-50 hover:scale-105'
                      : 'text-slate-300 hover:text-slate-400'
              }`}
            >
              <span className="relative z-10">{day.getDate()}</span>
              {hasEvent && !isSelected && (
                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
