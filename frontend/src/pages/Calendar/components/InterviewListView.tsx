import type { CalendarEvent } from '../types'
import { motion } from 'framer-motion'
import { formatChinaTime, formatDateLabel } from '../dateUtils'

type InterviewListViewProps = {
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent, anchorRect: DOMRect) => void
}

export function InterviewListView({ events, onEventClick }: InterviewListViewProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  )
  const byDate = new Map<string, CalendarEvent[]>()
  for (const event of sorted) {
    const d = new Date(event.starts_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(event)
  }
  const dateKeys = Array.from(byDate.keys()).sort()

  if (dateKeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="mb-6 h-20 w-20 rounded-[2rem] bg-slate-50 flex items-center justify-center text-4xl">
          📭
        </div>
        <p className="text-xl font-black tracking-tight text-slate-900">暂无面试日程</p>
        <p className="mt-2 text-sm font-medium">在日/周/月视图中创建日程后，有面试的日期会显示在这里</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-12">
      {dateKeys.map((key, idx) => {
        const [y, m, d] = key.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const dayEvents = byDate.get(key)!
        return (
          <motion.div 
            key={key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="relative pl-12"
          >
            <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-100">
              <div className="absolute top-2 -left-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-900 shadow-sm" />
            </div>
            
            <div className="mb-6">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()]}
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {formatDateLabel(date)}
              </div>
            </div>

            <ul className="space-y-4">
              {dayEvents.map((event) => {
                const start = new Date(event.starts_at)
                const end = new Date(event.ends_at)
                return (
                  <motion.li 
                    key={event.id}
                    whileHover={{ x: 8 }}
                    className="group"
                  >
                    <button
                      type="button"
                      onClick={(e) => onEventClick(event, (e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
                      className="flex w-full items-center gap-6 rounded-[1.5rem] border border-slate-100 bg-white p-6 text-left shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all hover:border-blue-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
                    >
                      <div className="flex flex-col items-center justify-center w-20 shrink-0 border-r border-slate-100 pr-6">
                        <span className="text-sm font-black text-slate-900 tracking-tighter">{formatChinaTime(start)}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{formatChinaTime(end)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">{event.title}</div>
                        {event.location && (
                          <div className="mt-1 text-sm font-medium text-slate-400 flex items-center gap-1.5">
                            <span className="opacity-50 text-xs">📍</span> {event.location}
                          </div>
                        )}
                      </div>
                      <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-slate-400">→</span>
                      </div>
                    </button>
                  </motion.li>
                )
              })}
            </ul>
          </motion.div>
        )
      })}
    </div>
  )
}
