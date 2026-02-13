import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { addDays, formatMonthTitle, getMonthGridRange, startOfDay } from '../dateUtils'

type MiniMonthPanelProps = {
  currentDate: Date
  onPickDate: (date: Date) => void
  onNavigateMonth: (delta: number) => void
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function MiniMonthPanel({ currentDate, onPickDate, onNavigateMonth }: MiniMonthPanelProps) {
  const { start } = getMonthGridRange(currentDate)
  const today = startOfDay(new Date())

  return (
    <aside className="w-[340px] shrink-0 border-r border-slate-200 bg-[#f8fafc] p-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <button
            className="rounded-md px-2 py-1 text-[34px] font-bold text-slate-700 hover:bg-slate-100"
            type="button"
          >
            {formatMonthTitle(currentDate)}
          </button>
          <div className="flex gap-1">
            <button type="button" className="rounded-md p-1.5 hover:bg-slate-100" onClick={() => onNavigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            </button>
            <button type="button" className="rounded-md p-1.5 hover:bg-slate-100" onClick={() => onNavigateMonth(1)}>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
          {WEEK_LABELS.map((label) => (
            <div key={label} className="py-1">{label}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: 42 }).map((_, idx) => {
            const day = addDays(start, idx)
            const isCurrentMonth = day.getMonth() === currentDate.getMonth()
            const isToday = startOfDay(day).getTime() === today.getTime()
            const isSelected = startOfDay(day).getTime() === startOfDay(currentDate).getTime()
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onPickDate(day)}
                className={`mx-auto h-10 w-10 rounded-full text-base transition ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isToday
                      ? 'bg-blue-100 text-blue-700'
                      : isCurrentMonth
                        ? 'text-slate-700 hover:bg-slate-100'
                        : 'text-slate-300 hover:bg-slate-50'
                }`}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          <Search className="h-4 w-4" />
          搜索联系人、公共日历
        </div>
        <div className="space-y-2 text-sm">
          <div className="font-semibold text-slate-500">我管理的</div>
          <label className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked readOnly /> 求职日历</label>
          <label className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked readOnly /> 我的任务</label>
        </div>
      </div>
    </aside>
  )
}
