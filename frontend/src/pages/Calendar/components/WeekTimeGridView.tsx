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

export function WeekTimeGridView({ currentDate, events, mode, onPickSlot, onEventClick }: WeekTimeGridViewProps) {
  const weekStart = startOfWeek(currentDate)
  const dayDates = mode === 'day' ? [startOfDay(currentDate)] : Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))
  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT
  const todayDate = new Date()

  return (
    <div className="overflow-hidden bg-white">
      <div className="flex border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="w-24 shrink-0 px-4 py-6 text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">Time</div>
          <div className="text-[10px] font-bold text-slate-300">GMT+8</div>
        </div>
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${dayDates.length}, minmax(0, 1fr))` }}>
          {dayDates.map((day) => {
            const isToday = isSameChinaDay(day, todayDate)
            return (
              <div
                key={day.toISOString()}
                className={`border-l border-slate-100 px-4 py-4 transition-colors ${isToday ? 'bg-slate-50/50' : ''}`}
              >
                <div className={`text-xs font-black uppercase tracking-widest mb-1 ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()]}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-black tracking-tighter ${isToday ? 'text-slate-900' : 'text-slate-700'}`}>
                    {Number(toDateInputValue(day).slice(-2))}
                  </span>
                  {isToday && (
                    <span className="h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] animate-pulse" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex relative">
        <div className="w-24 shrink-0 border-r border-slate-100 bg-white/50">
          {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
            <div key={i} className="h-[80px] px-4 pt-2 text-right">
              <span className="text-sm font-black text-slate-300 tabular-nums tracking-tighter">
                {formatHour(START_HOUR + i)}
              </span>
            </div>
          ))}
        </div>

        <div className="relative flex-1 isolate" style={{ height: `${(END_HOUR - START_HOUR + 1) * 80}px` }}>
          {/* 槽位网格 */}
          <div className="absolute inset-0 grid z-0" style={{ gridTemplateColumns: `repeat(${dayDates.length}, minmax(0, 1fr))` }}>
            {dayDates.map((day) => {
              const isToday = isSameChinaDay(day, todayDate)
              return (
                <div
                  key={`${day.toISOString()}-col`}
                  className={`relative border-l border-slate-100 ${isToday ? 'bg-slate-50/30' : ''}`}
                >
                  {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
                    const hour = START_HOUR + i
                    return (
                      <button
                        key={`${day.toISOString()}-${hour}`}
                        type="button"
                        className="group block h-[80px] w-full border-b border-slate-50 transition-colors hover:bg-slate-50/80 relative"
                        onClick={() => {
                          const start = new Date(day)
                          start.setHours(hour, 0, 0, 0)
                          const end = new Date(start)
                          end.setMinutes(end.getMinutes() + 30)
                          onPickSlot(start, end)
                        }}
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="h-8 w-8 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400">
                            <span className="text-xl font-light">+</span>
                          </div>
                        </div>
                      </button>
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
                    const hourHeight = 80
                    const top = Math.max(0, (startMinutes / 60) * hourHeight)
                    const durationMinutes = endMinutes - startMinutes
                    const height = Math.max(60, (durationMinutes / 60) * hourHeight)
                    
                    return (
                      <motion.button
                        key={event.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02, zIndex: 30 }}
                        type="button"
                        onClick={(e) => onEventClick(event, (e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
                        className="pointer-events-auto absolute left-2 right-2 z-10 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] text-left group"
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-900 group-hover:bg-blue-600 transition-colors" />
                        <div className="flex flex-col h-full justify-between pl-1">
                          <div>
                            <div className="truncate text-sm font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                              {event.title}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              {formatChinaTime(start)} - {formatChinaTime(end)}
                            </div>
                          </div>
                          {event.location && (
                            <div className="truncate text-[10px] font-medium text-slate-400 flex items-center gap-1">
                              <span className="opacity-50">📍</span> {event.location}
                            </div>
                          )}
                        </div>
                      </motion.button>
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
