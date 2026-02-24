import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
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
    `min-w-[80px] rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
      view === target 
        ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 scale-105' 
        : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'
    }`

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA] font-sans selection:bg-blue-100 selection:text-blue-900">
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-xl z-20 sticky top-0">
        <div className="flex items-center justify-between px-8 h-20">
          <div className="flex items-center gap-8">
            <div className="flex flex-col group cursor-default">
              <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase leading-none">面试日历</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenAiImport}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 transition-all hover:border-blue-200 hover:text-blue-600 active:scale-95"
            >
              <div className="absolute inset-0 translate-y-full bg-blue-50/50 transition-transform group-hover:translate-y-0" />
              <Sparkles className="relative h-4.5 w-4.5 text-blue-500 transition-transform group-hover:rotate-12" />
              <span className="relative">AI 智能导入</span>
            </button>
            <button
              type="button"
              onClick={onOpenCreate}
              className="rounded-2xl bg-slate-900 px-8 py-3 text-sm font-black text-white shadow-2xl shadow-slate-200 transition-all hover:bg-slate-800 hover:-translate-y-0.5 active:scale-95 active:translate-y-0"
            >
              创建日程
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 border-r border-slate-200/60 bg-white/50 overflow-y-auto px-4 py-8">
          {left}
        </aside>

        <section className="min-w-0 flex-1 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-100/80 px-10 py-6 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl">
                <button 
                  type="button" 
                  onClick={onToday}
                  className="rounded-xl px-5 py-2 text-sm font-black text-slate-700 hover:bg-white hover:shadow-sm transition-all active:scale-95"
                >
                  今天
                </button>
                <div className="h-4 w-px bg-slate-200 mx-1" />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={onPrev} className="rounded-xl p-2 hover:bg-white hover:shadow-sm transition-all active:scale-95"><ChevronLeft className="h-5 w-5 text-slate-600" /></button>
                  <button type="button" onClick={onNext} className="rounded-xl p-2 hover:bg-white hover:shadow-sm transition-all active:scale-95"><ChevronRight className="h-5 w-5 text-slate-600" /></button>
                </div>
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">{rangeTitle}</h1>
            </div>
            <div className="flex rounded-2xl bg-slate-100/80 p-1.5">
              <button type="button" className={viewBtn('day')} onClick={() => onChangeView('day')}>日</button>
              <button type="button" className={viewBtn('week')} onClick={() => onChangeView('week')}>周</button>
              <button type="button" className={viewBtn('month')} onClick={() => onChangeView('month')}>月</button>
              <button type="button" className={viewBtn('interviews')} onClick={() => onChangeView('interviews')}>有面试</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-[#FAFAFA] p-8">
            <motion.div 
              layout
              className="h-full rounded-[2.5rem] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden"
            >
              {content}
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}
