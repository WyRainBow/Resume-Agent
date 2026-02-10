/**
 * 起止时间选择器：两个输入框（开始 / 结束），点击分别弹出月份选择器
 * 左侧框：年+月网格（图3）；右侧框：年+月网格 +「至今」选项（图4）
 */
import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../../../lib/utils'

const MONTHS = ['01月', '02月', '03月', '04月', '05月', '06月', '07月', '08月', '09月', '10月', '11月', '12月']

/** 解析 date 字符串为 { start: 'YYYY-MM', end: 'YYYY-MM' | '至今' } */
function parseDateRange(dateStr: string): { start: string; end: string } {
  if (!dateStr || !dateStr.trim()) return { start: '', end: '' }
  const normalized = dateStr.replace(/\s*-\s*/, ' - ').trim()
  const parts = normalized.split(/\s+-\s+/)
  if (parts.length >= 2) {
    const s = parts[0].trim().replace(/\./g, '-')
    const e = parts[1].trim()
    if (e === '至今') return { start: toYYYYMM(s), end: '至今' }
    return { start: toYYYYMM(s), end: toYYYYMM(e.replace(/\./g, '-')) }
  }
  if (parts.length === 1 && parts[0]) {
    const single = toYYYYMM(parts[0].trim().replace(/\./g, '-'))
    return { start: single, end: '' }
  }
  return { start: '', end: '' }
}

function toYYYYMM(s: string): string {
  if (!s) return ''
  const num = s.replace(/\D/g, '')
  if (num.length >= 6) {
    const y = num.slice(0, 4)
    const m = num.slice(4, 6)
    return `${y}-${m}`
  }
  if (num.length >= 4) return `${num.slice(0, 4)}-01`
  return ''
}

interface MonthYearRangePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

export function MonthYearRangePicker({ value, onChange, label = '起止时间', className }: MonthYearRangePickerProps) {
  const { start, end } = parseDateRange(value || '')
  const [startOpen, setStartOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [yearStart, setYearStart] = useState(() => (start ? parseInt(start.slice(0, 4), 10) : new Date().getFullYear()))
  const [yearEnd, setYearEnd] = useState(() => (end && end !== '至今' ? parseInt(end.slice(0, 4), 10) : new Date().getFullYear()))
  const startRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (start) setYearStart(parseInt(start.slice(0, 4), 10))
  }, [start])
  useEffect(() => {
    if (end && end !== '至今') setYearEnd(parseInt(end.slice(0, 4), 10))
  }, [end])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (startRef.current?.contains(e.target as Node) || endRef.current?.contains(e.target as Node)) return
      setStartOpen(false)
      setEndOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const commit = (newStart: string, newEnd: string) => {
    if (!newStart && !newEnd) onChange('')
    else if (newEnd === '至今') onChange(`${newStart} - 至今`)
    else if (newStart && newEnd) onChange(`${newStart} - ${newEnd}`)
    else if (newStart) onChange(newStart)
  }

  const handleSelectStart = (month: number) => {
    const m = month.toString().padStart(2, '0')
    const newStart = `${yearStart}-${m}`
    commit(newStart, end)
    setStartOpen(false)
  }

  const handleSelectEnd = (month: number | '至今') => {
    if (month === '至今') {
      commit(start, '至今')
      setEndOpen(false)
      return
    }
    const m = month.toString().padStart(2, '0')
    const newEnd = `${yearEnd}-${m}`
    commit(start, newEnd)
    setEndOpen(false)
  }

  const clearStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    commit('', end)
  }
  const clearEnd = (e: React.MouseEvent) => {
    e.stopPropagation()
    commit(start, '')
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-xs font-medium text-gray-500 dark:text-neutral-400">
          {label}
          <span className="text-red-400 ml-0.5">*</span>
        </label>
      )}
      <div className="flex items-center gap-2">
        {/* 左侧：开始时间 */}
        <div className="relative flex-1" ref={startRef}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setEndOpen(false); setStartOpen((o) => !o) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStartOpen((o) => !o) } }}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border text-sm flex items-center justify-between transition-colors',
              startOpen
                ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30'
                : 'border-gray-200 dark:border-neutral-600 hover:border-gray-300 dark:hover:border-neutral-500',
              'bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 cursor-pointer'
            )}
          >
            <span className={cn(!start && 'text-gray-400 dark:text-neutral-500')}>
              {start || '选择开始'}
            </span>
            {start && (
              <button type="button" onClick={clearStart} className="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-400">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {startOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={() => setYearStart((y) => y - 1)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700">
                    <ChevronLeft className="w-5 h-5 text-gray-500" />
                  </button>
                  <span className="font-medium text-gray-800 dark:text-neutral-200">{yearStart}年</span>
                  <button type="button" onClick={() => setYearStart((y) => y + 1)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700">
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MONTHS.map((label, i) => {
                    const month = i + 1
                    const isSelected = start === `${yearStart}-${month.toString().padStart(2, '0')}`
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => handleSelectStart(month)}
                        className={cn(
                          'py-2 rounded-lg text-sm font-medium transition-all',
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400'
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <span className="text-gray-400 shrink-0">-</span>

        {/* 右侧：结束时间（含至今） */}
        <div className="relative flex-1" ref={endRef}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setStartOpen(false); setEndOpen((o) => !o) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEndOpen((o) => !o) } }}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border text-sm flex items-center justify-between transition-colors',
              endOpen
                ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30'
                : 'border-gray-200 dark:border-neutral-600 hover:border-gray-300 dark:hover:border-neutral-500',
              'bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 cursor-pointer'
            )}
          >
            <span className={cn((!end) && 'text-gray-400 dark:text-neutral-500')}>
              {end || '选择结束'}
            </span>
            {end && (
              <button type="button" onClick={clearEnd} className="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-400">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {endOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={() => setYearEnd((y) => y - 1)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700">
                    <ChevronLeft className="w-5 h-5 text-gray-500" />
                  </button>
                  <span className="font-medium text-gray-800 dark:text-neutral-200">{yearEnd}年</span>
                  <button type="button" onClick={() => setYearEnd((y) => y + 1)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700">
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MONTHS.map((label, i) => {
                    const month = i + 1
                    const val = end === '至今' ? '' : end
                    const isSelected = val === `${yearEnd}-${month.toString().padStart(2, '0')}`
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => handleSelectEnd(month)}
                        className={cn(
                          'py-2 rounded-lg text-sm font-medium transition-all',
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400'
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectEnd('至今')}
                  className={cn(
                    'w-full mt-3 py-2.5 rounded-lg text-sm font-medium border transition-all',
                    end === '至今'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 dark:border-neutral-600 text-gray-600 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:border-blue-300'
                  )}
                >
                  至今
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default MonthYearRangePicker
