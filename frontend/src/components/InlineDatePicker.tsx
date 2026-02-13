/**
 * 共享日期选择器（与投递进展表投递时间同款 UI，选中态为蓝色）
 */
import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function parseDateString(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
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
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
  }, [open, currentYear, currentMonth])

  const firstDay = new Date(currentYear, currentMonth, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const prevDays = new Date(currentYear, currentMonth, 0).getDate()

  const dayCells: Array<{ day: number; inMonth: boolean; date: Date }> = []
  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const day = prevDays - i
    dayCells.push({ day, inMonth: false, date: new Date(currentYear, currentMonth - 1, day) })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    dayCells.push({ day, inMonth: true, date: new Date(currentYear, currentMonth, day) })
  }
  while (dayCells.length < 42) {
    const day = dayCells.length - (startWeekday + daysInMonth) + 1
    dayCells.push({ day, inMonth: false, date: new Date(currentYear, currentMonth + 1, day) })
  }

  const selectedStr = selectedDate ? formatDateString(selectedDate) : ''

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
                    if (currentMonth === 0) {
                      setCurrentYear((y) => y - 1)
                      setCurrentMonth(11)
                    } else {
                      setCurrentMonth((m) => m - 1)
                    }
                  }}
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {currentYear}年 {String(currentMonth + 1).padStart(2, '0')}月
                </div>
                <button
                  type="button"
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    if (currentMonth === 11) {
                      setCurrentYear((y) => y + 1)
                      setCurrentMonth(0)
                    } else {
                      setCurrentMonth((m) => m + 1)
                    }
                  }}
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              <div className="grid grid-cols-7 text-xs text-slate-500 px-1 mb-1">
                {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
                  <span key={w} className="text-center py-1">{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dayCells.map((cell, idx) => {
                  const dateStr = formatDateString(cell.date)
                  const active = dateStr === selectedStr
                  return (
                    <button
                      key={`${dateStr}-${idx}`}
                      type="button"
                      className={cn(
                        'h-8 rounded-md text-sm transition-colors',
                        active
                          ? 'bg-blue-600 text-white'
                          : cell.inMonth
                            ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            : 'text-slate-300 dark:text-slate-600 hover:bg-slate-100/60'
                      )}
                      onClick={() => {
                        onSelect(dateStr)
                        setOpen(false)
                      }}
                    >
                      {cell.day}
                    </button>
                  )
                })}
              </div>
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
                    onSelect(formatDateString(new Date()))
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
