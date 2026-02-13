import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import type { CalendarView } from '../types'

type CalendarShellProps = {
  view: CalendarView
  rangeTitle: string
  onChangeView: (view: CalendarView) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onOpenCreate: () => void
  onOpenAiImport: () => void
  left: ReactNode
  content: ReactNode
}

export function CalendarShell({
  view,
  rangeTitle,
  onChangeView,
  onPrev,
  onNext,
  onToday,
  onOpenCreate,
  onOpenAiImport,
  left,
  content,
}: CalendarShellProps) {
  const tabClass = 'flex items-center gap-2 border-b-2 px-3 py-3 text-lg font-semibold transition'
  const viewBtn = (target: CalendarView) =>
    `min-w-[86px] rounded-lg px-4 py-2 text-xl font-semibold transition ${
      view === target ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
    }`

  return (
    <div className="flex h-full flex-col bg-[#f3f5f8]">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between px-5">
          <div className="flex items-center gap-4">
            <button type="button" className={`${tabClass} border-blue-600 text-blue-700`}>
              <span className="text-xl leading-none">🗓</span> 面试日历
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenAiImport}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-lg font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Sparkles className="h-5 w-5 text-blue-600" />
              AI 导入日程
            </button>
            <button
              type="button"
              onClick={onOpenCreate}
              className="rounded-xl bg-blue-600 px-7 py-2.5 text-xl font-semibold text-white hover:bg-blue-700"
            >
              创建日程
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {left}

        <section className="min-w-0 flex-1 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={onToday} className="rounded-xl border border-slate-300 px-5 py-2 text-lg font-medium hover:bg-slate-100">今天</button>
              <button type="button" onClick={onPrev} className="rounded-lg p-2 hover:bg-slate-100"><ChevronLeft className="h-6 w-6 text-slate-500" /></button>
              <button type="button" onClick={onNext} className="rounded-lg p-2 hover:bg-slate-100"><ChevronRight className="h-6 w-6 text-slate-500" /></button>
              <span className="text-3xl font-bold text-slate-800">{rangeTitle}</span>
            </div>
            <div className="flex rounded-xl border border-slate-300 bg-white p-1">
              <button type="button" className={viewBtn('day')} onClick={() => onChangeView('day')}>日</button>
              <button type="button" className={viewBtn('week')} onClick={() => onChangeView('week')}>周</button>
              <button type="button" className={viewBtn('month')} onClick={() => onChangeView('month')}>月</button>
            </div>
          </div>
          <div className="h-[calc(100%-73px)] overflow-auto bg-white p-4">
            {content}
          </div>
        </section>
      </div>
    </div>
  )
}
