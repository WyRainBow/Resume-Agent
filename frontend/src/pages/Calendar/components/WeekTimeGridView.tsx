import type { CalendarEvent } from '../types'
import { addDays, startOfDay, startOfWeek } from '../dateUtils'

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

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

export function WeekTimeGridView({ currentDate, events, mode, onPickSlot, onEventClick }: WeekTimeGridViewProps) {
  const weekStart = startOfWeek(currentDate)
  const dayDates = mode === 'day' ? [startOfDay(currentDate)] : Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))
  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex border-b border-slate-200 bg-white">
        <div className="w-20 shrink-0 px-2 py-2 text-center text-sm font-semibold text-slate-400">GMT+8</div>
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${dayDates.length}, minmax(0, 1fr))` }}>
          {dayDates.map((day) => (
            <div key={day.toISOString()} className="border-l border-slate-200 px-3 py-2">
              <div className="text-sm text-slate-400">{['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day.getDay()]}</div>
              <div className="text-[34px] font-semibold text-slate-800">{day.getDate()}</div>
            </div>
          ))}
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
          {/* 槽位网格：仅背景与点击，置于底层 */}
          <div className="absolute inset-0 grid z-0" style={{ gridTemplateColumns: `repeat(${dayDates.length}, minmax(0, 1fr))` }}>
            {dayDates.map((day) => (
              <div key={`${day.toISOString()}-col`} className="relative border-l border-slate-200">
                {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
                  const hour = START_HOUR + i
                  return (
                    <button
                      key={`${day.toISOString()}-${hour}`}
                      type="button"
                      className="block h-[66px] w-full border-b border-slate-200 hover:bg-blue-50/40"
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
            ))}
          </div>

          {/* 事件层：独立叠放上下文，保证盖在槽位之上 */}
          <div className="absolute inset-0 grid pointer-events-none z-20 isolate" style={{ gridTemplateColumns: `repeat(${dayDates.length}, minmax(0, 1fr))` }}>
            {dayDates.map((day) => {
              const dayEvents = events.filter((event) => sameDay(new Date(event.starts_at), day))
              return (
                <div key={`${day.toISOString()}-events`} className="relative border-l border-transparent pointer-events-none">
                  {dayEvents.map((event) => {
                    const start = new Date(event.starts_at)
                    const end = new Date(event.ends_at)
                    const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes()
                    const endMinutes = (end.getHours() - START_HOUR) * 60 + end.getMinutes()
                    const top = Math.max(0, (startMinutes / 60) * HOUR_HEIGHT)
                    const durationMinutes = endMinutes - startMinutes
                    const height = Math.max(48, (durationMinutes / 60) * HOUR_HEIGHT)
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={(e) => onEventClick(event, (e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
                        className="pointer-events-auto absolute left-1 right-1 z-10 min-h-[48px] overflow-visible rounded-md border-l-4 border-blue-400 bg-blue-100/70 p-2 text-sm text-blue-800 shadow-sm text-left"
                        style={{ top: `${top}px`, height: `${height}px`, minHeight: '48px' }}
                      >
                        <div className="truncate font-semibold leading-tight">{event.title}</div>
                        <div className="text-xs text-blue-700 leading-tight whitespace-nowrap">
                          {start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          {' - '}
                          {end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
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
