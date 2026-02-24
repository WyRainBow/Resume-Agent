import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { ProgressDistributionItem } from '../utils/metrics'

function toArcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  }
  const end = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  }
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
}

export function DonutChart({ data, title = '进展状态分布' }: { data: ProgressDistributionItem[]; title?: string }) {
  const size = 320
  const cx = size / 2
  const cy = size / 2
  const radius = 98
  const stroke = 34
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0))
  const [displayTotal, setDisplayTotal] = useState(0)

  useEffect(() => {
    let rafId = 0
    const start = performance.now()
    const duration = 520
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayTotal(Math.round(total * eased))
      if (p < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [total])

  let angle = -Math.PI / 2
  const arcs = data.map((item) => {
    const delta = (item.value / total) * Math.PI * 2
    const start = angle
    const end = angle + delta
    angle = end
    return { ...item, path: toArcPath(cx, cy, radius, start, end) }
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
      <h3 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">{title}</h3>
      {data.length === 0 ? (
        <div className="flex h-[330px] items-center justify-center rounded-xl bg-slate-50 text-lg text-slate-500">暂无分布数据</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[300px_1fr] md:items-center">
          <motion.svg
            viewBox={`0 0 ${size} ${size}`}
            className="mx-auto h-[320px] w-[320px]"
            initial={{ opacity: 0, rotate: -10, scale: 0.94 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            transition={{ duration: 0.45 }}
          >
            <circle cx={cx} cy={cy} r={radius} stroke="#E2E8F0" strokeWidth={stroke} fill="none" />
            <circle cx={cx} cy={cy} r={radius - stroke / 2 - 8} fill="#F8FAFF" />
            {arcs.map((arc, idx) => (
              <motion.path
                key={arc.label}
                d={arc.path}
                stroke={arc.color}
                strokeWidth={stroke}
                strokeLinecap="butt"
                fill="none"
                initial={{ pathLength: 0, opacity: 0.6 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.42, delay: 0.08 + idx * 0.06 }}
              />
            ))}
            <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-900 text-[32px] font-black">
              {displayTotal}
            </text>
            <text x={cx} y={cy + 20} textAnchor="middle" className="fill-slate-500 text-[14px] font-semibold">
              {data.some((d) => d.label === '面试') ? '合计' : '总投递'}
            </text>
          </motion.svg>
          <div className="justify-self-start space-y-2.5">
            {data.map((item, idx) => (
              <motion.div
                key={item.label}
                className="flex items-center rounded-xl border border-slate-200 px-3.5 py-2.5"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.25, delay: 0.14 + idx * 0.04 }}
                title={item.label === '面试' ? '从面试日历统计' : undefined}
              >
                <div className="inline-flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-base font-semibold text-slate-700">{item.label}</span>
                </div>
                <span className="min-w-[2rem] text-right text-lg font-black tabular-nums text-slate-900">
                  {item.value}
                  {item.label === '面试' ? ' 场' : ''}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
