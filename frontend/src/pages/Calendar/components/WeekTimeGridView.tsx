import type { CalendarEvent } from '../types'
import { motion } from 'framer-motion'
import { addDays, formatChinaTime, getChinaHourMinute, isSameChinaDay, startOfDay, startOfWeek, toDateInputValue } from '../dateUtils'

type WeekTimeGridViewProps = {
  currentDate: Date
  events: CalendarEvent[]
  mode: 'week' | 'day'
  onPickSlot: (start: Date, end: Date) => void
  onEventClick: (event: CalendarEvent, anchorRect: DOMRect) => void
}

const START_HOUR = 7
const END_HOUR = 23
const HOUR_HEIGHT = 66

function formatHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

const WEEK_LABELS = [
  { cn: '周日', en: 'SUN' },
  { cn: '周一', en: 'MON' },
  { cn: '周二', en: 'TUE' },
  { cn: '周三', en: 'WED' },
  { cn: '周四', en: 'THU' },
  { cn: '周五', en: 'FRI' },
  { cn: '周六', en: 'SAT' },
]

export function WeekTimeGridView({ currentDate, events, mode, onPickSlot, onEventClick }: WeekTimeGridViewProps) {
  const weekStart = startOfWeek(currentDate)
  const dayDates = mode === 'day' ? [startOfDay(currentDate)] : Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))
  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT
  const todayDate = new Date()

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex border-b border-slate-200 bg-white">
        <div className="w-20 shrink-0 px-2 py-2 text-center text-[10px] font-bold text-slate-400 flex flex-col justify-center leading-tight">
          <div>TIME</div>
          <div className="text-[9px] opacity-70 font-medium">GMT+8</div>
        </div>
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${dayDates.length}, minmax(0, 1fr))` }}>
          {dayDates.map((day) => {
            const isToday = isSameChinaDay(day, todayDate)
            const label = WEEK_LABELS[day.getDay()]
            return (
              <div
                key={day.toISOString()}
                className={`border-l border-slate-200 px-3 py-2 ${isToday ? 'bg-blue-50/50' : ''}`}
              >
                <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-slate-900' : 'text-slate-400'}`}>
                  {label.en}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xl font-bold tracking-tighter ${isToday ? 'text-slate-900' : 'text-slate-800'}`}>
                    {Number(toDateInputValue(day).slice(-2))}
                  </span>
                  {isToday && (
                    <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white scale-90 origin-left">今天</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex">
        <div className="w-20 shrink-0 border-r border-slate-200 bg-white">
          {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
            <div key={i} className="h-[66px] px-2 pt-1 text-center text-[22px] text-slate-400">
              {formatHour(START_HOUR + i)}
            </div>
          ))}
        </div>

        <div className="relative flex-1 isolate" style={{ height: `${totalHeight}px` }}>
          {/* 槽位网格 */}
          <div className="absolute inset-0 grid z-0" style={{ gridTemplateColumns: `repeat(${dayDates.length}, minmax(0, 1fr))` }}>
            {dayDates.map((day) => {
              const isToday = isSameChinaDay(day, todayDate)
              return (
              <div
                key={`${day.toISOString()}-col`}
                className={`relative border-l border-slate-200 ${isToday ? 'bg-blue-50/30' : ''}`}
              >
                {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
                  const hour = START_HOUR + i
                  return (
                    <button
                      key={`${day.toISOString()}-${hour}`}
                      type="button"
                      className="block h-[66px] w-full border-b border-slate-200 hover:bg-slate-50"
                      onClick={() => {
                        const start = new Date(day)
                        start.setHours(hour, 0, 0, 0)
                        const end = new Date(start)
                        end.setMinutes(end.getMinutes() + 30)
                        onPickSlot(start, end)
                      }}
                    />
                  )
                })}
              </div>
            )
            })}
          </div>

          {/* 事件层 */}
          <div className="absolute inset-0 grid pointer-events-none z-20 isolate" style={{ gridTemplateColumns: `repeat(${dayDates.length}, minmax(0, 1fr))` }}>
            {dayDates.map((day) => {
              const dayEvents = events.filter((event) => isSameChinaDay(new Date(event.starts_at), day))
              return (
                <div key={`${day.toISOString()}-events`} className="relative border-l border-transparent pointer-events-none">
                  {dayEvents.map((event) => {
                    const start = new Date(event.starts_at)
                    const end = new Date(event.ends_at)
                    const startChina = getChinaHourMinute(start)
                    const endChina = getChinaHourMinute(end)
                    const startMinutes = (startChina.hour - START_HOUR) * 60 + startChina.minute
                    const endMinutes = (endChina.hour - START_HOUR) * 60 + endChina.minute
                    const top = Math.max(0, (startMinutes / 60) * HOUR_HEIGHT)
                    const durationMinutes = endMinutes - startMinutes
                    const height = Math.max(48, (durationMinutes / 60) * HOUR_HEIGHT)
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={(e) => onEventClick(event, (e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
                        className="pointer-events-auto absolute left-1 right-1 z-10 min-h-[48px] overflow-visible rounded-md border-l-4 border-slate-900 bg-slate-100 p-2 text-sm text-slate-900 shadow-sm text-left"
                        style={{ top: `${top}px`, height: `${height}px`, minHeight: '48px' }}
                      >
                        <div className="truncate font-semibold leading-tight">{event.title}</div>
                        <div className="text-xs text-slate-500 leading-tight whitespace-nowrap">
                          {formatChinaTime(start)}
                          {' - '}
                          {formatChinaTime(end)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
