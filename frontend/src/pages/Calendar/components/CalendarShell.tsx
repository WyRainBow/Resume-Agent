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
  const tabClass = 'flex items-center gap-2 border-b-2 px-4 py-3 text-xl font-bold transition'
  const viewBtn = (target: CalendarView) =>
    `min-w-[80px] rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
      view === target 
        ? 'bg-blue-600 text-white shadow-sm' 
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC]">
      <header className="border-b border-slate-200 bg-white shadow-sm z-10">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-6">
            <div className={`${tabClass} border-blue-600 text-slate-900`}>
              <span className="text-2xl">📅</span>
              <span className="tracking-tight">面试日历</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenAiImport}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
            >
              <Sparkles className="h-4.5 w-4.5 text-blue-600 animate-pulse" />
              AI 智能导入
            </button>
            <button
              type="button"
              onClick={onOpenCreate}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
            >
              创建日程
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 border-r border-slate-200 bg-slate-50/50 overflow-y-auto">
          {left}
        </aside>

        <section className="min-w-0 flex-1 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-8 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <button 
                type="button" 
                onClick={onToday}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 bg-white shadow-sm hover:bg-slate-50 transition-all active:scale-95"
              >
                今天
              </button>
              <div className="flex items-center gap-1">
                <button type="button" onClick={onPrev} className="rounded-full p-2 hover:bg-slate-100 transition-colors"><ChevronLeft className="h-6 w-6 text-slate-600" /></button>
                <button type="button" onClick={onNext} className="rounded-full p-2 hover:bg-slate-100 transition-colors"><ChevronRight className="h-6 w-6 text-slate-600" /></button>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight ml-2">{rangeTitle}</h1>
            </div>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-inner">
              <button type="button" className={viewBtn('day')} onClick={() => onChangeView('day')}>日</button>
              <button type="button" className={viewBtn('week')} onClick={() => onChangeView('week')}>周</button>
              <button type="button" className={viewBtn('month')} onClick={() => onChangeView('month')}>月</button>
              <button type="button" className={viewBtn('interviews')} onClick={() => onChangeView('interviews')}>有面试</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-white p-6">
            <div className="h-full rounded-2xl border border-slate-100 shadow-sm bg-slate-50/30">
              {content}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
