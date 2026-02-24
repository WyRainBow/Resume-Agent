import type { CalendarEvent } from '../types'
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
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <p className="text-lg font-medium">暂无面试日程</p>
        <p className="mt-1 text-sm">在日/周/月视图中创建日程后，有面试的日期会显示在这里</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {dateKeys.map((key) => {
        const [y, m, d] = key.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const dayEvents = byDate.get(key)!
        return (
          <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="mb-3 text-base font-bold text-slate-700">
              {formatDateLabel(date)} {['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]}
            </div>
            <ul className="space-y-2">
              {dayEvents.map((event) => {
                const start = new Date(event.starts_at)
                const end = new Date(event.ends_at)
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={(e) => onEventClick(event, (e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/50"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800">{event.title}</div>
                        <div className="text-sm text-slate-500">
                          {formatChinaTime(start)} - {formatChinaTime(end)}
                          {event.location ? ` · ${event.location}` : ''}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
