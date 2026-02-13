import type { CalendarEvent } from '../types'
import { addDays, formatChinaTime, formatDateLabel, getMonthGridRange, isSameChinaDay, startOfDay } from '../dateUtils'

type MonthGridViewProps = {
  currentDate: Date
  events: CalendarEvent[]
  onSelectDate: (date: Date) => void
  onEventClick: (event: CalendarEvent, anchorRect: DOMRect) => void
}

const WEEK_HEADER = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function MonthGridView({ currentDate, events, onSelectDate, onEventClick }: MonthGridViewProps) {
  const { start } = getMonthGridRange(currentDate)
  const today = startOfDay(new Date())

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
        {WEEK_HEADER.map((w) => (
          <div key={w} className="px-3 py-2.5 text-lg font-semibold text-slate-500">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 42 }).map((_, idx) => {
          const day = addDays(start, idx)
          const dayEvents = events.filter((event) => isSameChinaDay(new Date(event.starts_at), day))
          const dateEvents = dayEvents.slice(0, 4)
          const remainingCount = Math.max(0, dayEvents.length - dateEvents.length)
          const isCurrentMonth = day.getMonth() === currentDate.getMonth()
          const isToday = isSameChinaDay(day, today)

          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className="group min-h-[132px] cursor-pointer border-b border-r border-slate-200 px-2.5 py-2 text-left align-top"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`text-xl font-semibold ${isCurrentMonth ? 'text-slate-800' : 'text-slate-400'}`}>
                  {idx < 7 ? formatDateLabel(day) : day.getDate()}
                </span>
                {isToday ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">今天</span> : null}
              </div>
              <div className="space-y-1.5">
                {dateEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(event, (e.currentTarget as HTMLButtonElement).getBoundingClientRect())
                    }}
                    className="w-full rounded-md px-1 py-0.5 text-left hover:bg-blue-50/50"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      <span className="shrink-0 text-[13px] font-medium text-slate-500">
                        {formatChinaTime(new Date(event.starts_at))}
                      </span>
                      <span className="truncate text-[13px] font-medium text-slate-700">
                        {event.title}
                      </span>
                    </div>
                  </button>
                ))}
                {remainingCount > 0 ? (
                  <div className="pl-3 text-[13px] font-medium text-slate-500">
                    还有 {remainingCount} 项
                  </div>
                ) : null}
                {dateEvents.length === 0 ? <div className="text-sm text-slate-300">&nbsp;</div> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
