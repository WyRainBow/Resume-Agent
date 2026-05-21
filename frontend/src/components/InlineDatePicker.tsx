/**
 * 共享日期选择器（与投递进展表投递时间同款 UI，选中态为蓝色）
 */
import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function parseDateString(value: string | null | undefined): Date | null {
  if (!value) return null
  const raw = value.trim()
  // 支持 YYYY-MM 与 YYYY-MM-DD
  const ym = /^(\d{4})-(\d{2})$/.exec(raw)
  if (ym) {
    const y = Number(ym[1])
    const mo = Number(ym[2]) - 1
    const dt = new Date(y, mo, 1)
    if (dt.getFullYear() !== y || dt.getMonth() !== mo) return null
    return dt
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null
  return dt
}

function formatDateString(dt: Date): string {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export interface InlineDatePickerProps {
  value: string | null
  placeholder?: string
  onSelect: (value: string | null) => void
  /** 用于多实例时区分 portal 容器，不传则使用 useId */
  portalId?: string
}

export function InlineDatePicker({
  value,
  placeholder = '选择日期',
  onSelect,
  portalId: portalIdProp,
}: InlineDatePickerProps) {
  const reactId = useId()
  const portalId = portalIdProp ?? `date-picker-portal-${reactId.replace(/:/g, '')}`

  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 0 })
  const selectedDate = parseDateString(value)
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(selectedDate?.getMonth() ?? today.getMonth())
  const [view, setView] = useState<'month' | 'year'>('month')

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      const target = event.target as Node
      const portalRoot = document.getElementById(portalId)
      if (triggerRef.current?.contains(target)) return
      if (portalRoot?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, portalId])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPopupPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 280),
    })
  }, [open, currentYear, currentMonth, view])

  const selectedStr = selectedDate ? formatDateString(selectedDate) : ''
  const decadeStart = Math.floor(currentYear / 10) * 10

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full h-11 rounded-xl border px-4 text-left flex items-center justify-between gap-2 transition-colors',
          'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500'
        )}
      >
        <span className={cn('truncate text-[17px]', selectedDate ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-400')}>
          {selectedDate ? formatDateString(selectedDate) : placeholder}
        </span>
        <Calendar className="w-4 h-4 shrink-0 text-slate-500" />
      </button>
      {open && typeof document !== 'undefined' &&
        createPortal(
          <div id={portalId} className="fixed inset-0 z-[10000]" style={{ pointerEvents: 'none' }}>
            <div
              className="absolute rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3"
              style={{ top: popupPos.top, left: popupPos.left, width: popupPos.width, pointerEvents: 'auto' }}
            >
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    if (view === 'month') {
                      if (currentMonth === 0) {
                        setCurrentYear((y) => y - 1)
                        setCurrentMonth(11)
                      } else {
                        setCurrentMonth((m) => m - 1)
                      }
                      return
                    }
                    setCurrentYear((y) => y - 10)
                  }}
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  type="button"
                  className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-md"
                  onClick={() => setView((v) => (v === 'month' ? 'year' : 'month'))}
                  title="点击切换年份选择"
                >
                  {view === 'month'
                    ? `${currentYear}年`
                    : `${decadeStart} - ${decadeStart + 9}`}
                </button>
                <button
                  type="button"
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    if (view === 'month') {
                      if (currentMonth === 11) {
                        setCurrentYear((y) => y + 1)
                        setCurrentMonth(0)
                      } else {
                        setCurrentMonth((m) => m + 1)
                      }
                      return
                    }
                    setCurrentYear((y) => y + 10)
                  }}
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              {view === 'month' ? (
                <div className="grid grid-cols-4 gap-2 py-2">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const m = i + 1
                    const valueStr = `${currentYear}-${String(m).padStart(2, '0')}`
                    const active = valueStr === selectedStr
                    return (
                      <button
                        key={valueStr}
                        type="button"
                        className={cn(
                          'h-10 rounded-lg text-sm font-medium transition-colors',
                          active
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        )}
                        onClick={() => {
                          onSelect(valueStr)
                          setOpen(false)
                        }}
                      >
                        {m}月
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 py-2">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const y = decadeStart - 1 + i
                    const isInDecade = y >= decadeStart && y <= decadeStart + 9
                    const active = selectedDate ? selectedDate.getFullYear() === y : false
                    return (
                      <button
                        key={y}
                        type="button"
                        className={cn(
                          'h-10 rounded-lg text-sm font-medium transition-colors',
                          active
                            ? 'bg-blue-600 text-white'
                            : isInDecade
                              ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              : 'text-slate-300 dark:text-slate-600 hover:bg-slate-100/60'
                        )}
                        onClick={() => {
                          setCurrentYear(y)
                          setView('month')
                        }}
                      >
                        {y}
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="mt-3 flex justify-between gap-2">
                <button
                  type="button"
                  className="h-8 px-3 rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    onSelect(null)
                    setOpen(false)
                  }}
                >
                  清空
                </button>
                <button
                  type="button"
                  className="h-8 px-3 rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    const now = new Date()
                    onSelect(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
                    setOpen(false)
                  }}
                >
                  今天
                </button>
                <button
                  type="button"
                  className="h-8 px-3 rounded-md text-sm text-slate-500 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export default InlineDatePicker
