import { motion } from 'framer-motion'
import type { DailyTrendPoint } from '../utils/metrics'

export function MiniLineChart({ data }: { data: DailyTrendPoint[] }) {
  const width = 760
  const height = 330
  const paddingX = 36
  const paddingY = 26
  const innerW = width - paddingX * 2
  const innerH = height - paddingY * 2
  const maxVal = Math.max(1, ...data.map((d) => d.value))

  const points = data.map((d, idx) => {
    const x = paddingX + (idx * innerW) / Math.max(1, data.length - 1)
    const y = paddingY + innerH - (d.value / maxVal) * innerH
    return { x, y, ...d }
  })

  const linePath =
    points.length > 0
      ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
      : ''

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
      : ''

  const last = points[points.length - 1]

  return (
    <motion.div
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900">近7天投递趋势</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">application_date</span>
      </div>
      {data.length === 0 ? (
        <div className="flex h-[330px] items-center justify-center rounded-xl bg-slate-50 text-lg text-slate-500">暂无趋势数据</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[330px] w-full">
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F7CFF" stopOpacity="0.36" />
              <stop offset="100%" stopColor="#4F7CFF" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {Array.from({ length: 5 }).map((_, i) => {
            const y = paddingY + (innerH * i) / 4
            return <line key={i} x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 4" />
          })}
          {Array.from({ length: 5 }).map((_, i) => {
            const val = Math.round(maxVal - (maxVal * i) / 4)
            const y = paddingY + (innerH * i) / 4 + 4
            return (
              <text key={`y-${i}`} x={8} y={y} className="fill-slate-400 text-[12px] font-semibold">
                {val}
              </text>
            )
          })}

          <motion.path
            d={areaPath}
            fill="url(#trend-fill)"
            initial={{ opacity: 0, scaleY: 0.94 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.45 }}
            style={{ transformOrigin: `${width / 2}px ${height - paddingY}px` }}
          />
          <motion.path
            d={linePath}
            fill="none"
            stroke="#4F7CFF"
            strokeWidth="3.8"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          />

          {points.map((p, idx) => (
            <motion.g
              key={idx}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.16 + idx * 0.05 }}
            >
              <circle cx={p.x} cy={p.y} r="4.8" fill="#FFFFFF" stroke="#4F7CFF" strokeWidth="2.2" />
            </motion.g>
          ))}

          {last && (
            <motion.circle
              cx={last.x}
              cy={last.y}
              r="8.5"
              fill="#4F7CFF"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.25, 0, 0.25], scale: [0.95, 1.5, 0.95] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {points.map((p, idx) => (
            <text
              key={`label-${idx}`}
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-500 text-[13px] font-semibold"
            >
              {p.label}
            </text>
          ))}
        </svg>
      )}
    </motion.div>
  )
}
