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
    <div className="bg-white">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        {WEEK_HEADER.map((w) => (
          <div key={w} className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{w}</div>
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
              className={`group min-h-[160px] cursor-pointer border-b border-r border-slate-50 p-4 transition-colors hover:bg-slate-50/50 ${
                !isCurrentMonth ? 'bg-slate-50/20' : ''
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className={`text-2xl font-black tracking-tighter transition-transform group-hover:scale-110 ${
                  isToday ? 'text-blue-600' : isCurrentMonth ? 'text-slate-900' : 'text-slate-300'
                }`}>
                  {idx < 7 ? formatDateLabel(day).split('月')[1].replace('日', '') : day.getDate()}
                </span>
                {isToday && (
                  <span className="h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] animate-pulse" />
                )}
              </div>
              <div className="space-y-2">
                {dateEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(event, (e.currentTarget as HTMLButtonElement).getBoundingClientRect())
                    }}
                    className="w-full rounded-xl bg-slate-50 p-2 text-left transition-all hover:bg-white hover:shadow-md hover:-translate-y-0.5 border border-transparent hover:border-slate-100 group/item"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="truncate text-[11px] font-black text-slate-900 group-hover/item:text-blue-600 transition-colors">
                        {event.title}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        {formatChinaTime(new Date(event.starts_at))}
                      </div>
                    </div>
                  </button>
                ))}
                {remainingCount > 0 ? (
                  <div className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    + {remainingCount} more
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
