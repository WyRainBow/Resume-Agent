import type { ReactNode } from 'react'

export function Panel({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#dde3ec] bg-[#f8fafc] p-5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold text-slate-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}
