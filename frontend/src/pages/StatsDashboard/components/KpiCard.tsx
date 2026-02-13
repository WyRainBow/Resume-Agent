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
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_30px_rgba(15,23,42,0.07)]"
    >
      <div className="absolute -top-24 -right-14 h-36 w-36 rounded-full bg-sky-100/70 blur-2xl" />
      <motion.div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500"
        initial={{ scaleX: 0, transformOrigin: 'left center' }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.45, delay: 0.1 + index * 0.07 }}
      />
      <motion.div
        className="pointer-events-none absolute inset-y-0 left-[-45%] w-[36%] bg-gradient-to-r from-transparent via-white/50 to-transparent"
        animate={{ x: ['0%', '240%'] }}
        transition={{ duration: 1.35, delay: 0.25 + index * 0.09, ease: 'easeInOut' }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-base font-semibold tracking-wide text-slate-500">{title}</p>
          <p className="mt-2.5 text-5xl font-black tracking-tight text-slate-900">{displayValue}</p>
          <p className="mt-1.5 text-sm font-medium text-slate-500">{hint}</p>
        </div>
        <motion.div
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
          initial={{ rotate: -8, opacity: 0.7 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.14 + index * 0.06 }}
        >
          <Icon className="h-5.5 w-5.5" />
        </motion.div>
      </div>
    </motion.div>
  )
}
