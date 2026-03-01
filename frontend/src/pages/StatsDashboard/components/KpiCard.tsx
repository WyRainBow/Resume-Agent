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
      className="relative overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    >
      <div className="absolute -top-24 -right-14 h-36 w-36 rounded-full bg-slate-50 blur-2xl" />
      <motion.div
        className="absolute inset-x-0 top-0 h-1 bg-blue-500"
        initial={{ scaleX: 0, transformOrigin: 'left center' }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.45, delay: 0.1 + index * 0.07 }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{title}</p>
          <p className="text-5xl font-black tracking-tighter text-slate-900">{displayValue}</p>
          <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{hint}</p>
        </div>
        <motion.div
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-500 shadow-lg shadow-blue-100 border border-blue-50"
          initial={{ rotate: -8, opacity: 0.7 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.14 + index * 0.06 }}
        >
          <Icon className="h-5 w-5" />
        </motion.div>
      </div>
    </motion.div>
  )
}
