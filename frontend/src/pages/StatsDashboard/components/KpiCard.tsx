import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

export function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  index,
}: {
  title: string
  value: number
  hint: string
  icon: LucideIcon
  index: number
}) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let rafId = 0
    const start = performance.now()
    const duration = 550

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayValue(Math.round(value * eased))
      if (p < 1) rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [value])

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.06)]"
    >
      <div className="absolute -top-20 -right-12 h-32 w-32 rounded-full bg-sky-100/70 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-4xl font-black tracking-tight text-slate-900">{displayValue}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{hint}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  )
}
