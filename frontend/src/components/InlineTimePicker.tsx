import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock3, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export interface InlineTimePickerProps {
  value: string | null
  placeholder?: string
  onSelect: (value: string | null) => void
  portalId?: string
  disabled?: boolean
}

export function InlineTimePicker({
  value,
  placeholder = '选择时间',
  onSelect,
  portalId: portalIdProp,
  disabled = false,
}: InlineTimePickerProps) {
  const reactId = useId()
  const portalId = portalIdProp ?? `time-picker-portal-${reactId.replace(/:/g, '')}`

  const [open, setOpen] = useState(false)
  const [draftHour, setDraftHour] = useState<number>(9)
  const [draftMinute, setDraftMinute] = useState<number>(0)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 0 })

  const normalized = normalizeTime(value)
  const hour = normalized ? Number(normalized.slice(0, 2)) : null
  const minute = normalized ? Number(normalized.slice(3, 5)) : null

  const minuteOptions = useMemo(() => [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], [])

  useEffect(() => {
    if (hour !== null && minute !== null) {
      setDraftHour(hour)
      setDraftMinute(Math.floor(minute / 5) * 5)
    }
  }, [hour, minute])

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
      width: Math.max(rect.width, 260),
    })
  }, [open, draftHour, draftMinute])

  const commit = () => {
    onSelect(`${String(draftHour).padStart(2, '0')}:${String(draftMinute).padStart(2, '0')}`)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-11 w-full rounded-xl border px-4 text-left transition-colors',
          'flex items-center justify-between gap-2',
          disabled
            ? 'cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
            : 'bg-white border-slate-300 hover:border-blue-400'
        )}
      >
        <span className={cn('truncate text-[17px]', normalized ? 'font-medium text-slate-800' : 'text-slate-400')}>
          {normalized || placeholder}
        </span>
        <Clock3 className="h-4 w-4 shrink-0 text-slate-500" />
      </button>

      {open && !disabled && typeof document !== 'undefined' &&
        createPortal(
          <div id={portalId} className="fixed inset-0 z-[10000]" style={{ pointerEvents: 'none' }}>
            <div
              className="absolute rounded-xl border border-slate-200 bg-white shadow-xl p-3"
              style={{ top: popupPos.top, left: popupPos.left, width: popupPos.width, pointerEvents: 'auto' }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">选择时间（24 小时）</div>
                <button
                  type="button"
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200 p-1">
                  <div className="px-2 pb-1 text-xs text-slate-400">小时</div>
                  <div className="max-h-40 overflow-auto space-y-1">
                    {Array.from({ length: 24 }).map((_, h) => {
                      const active = draftHour === h
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setDraftHour(h)}
                          className={cn(
                            'w-full rounded-md px-2 py-1 text-left text-sm',
                            active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                          )}
                        >
                          {String(h).padStart(2, '0')}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-1">
                  <div className="px-2 pb-1 text-xs text-slate-400">分钟</div>
                  <div className="max-h-40 overflow-auto space-y-1">
                    {minuteOptions.map((m) => {
                      const active = draftMinute === m
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDraftMinute(m)}
                          className={cn(
                            'w-full rounded-md px-2 py-1 text-left text-sm',
                            active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                          )}
                        >
                          {String(m).padStart(2, '0')}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="h-8 rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    onSelect(null)
                    setOpen(false)
                  }}
                >
                  清空
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={commit}
                >
                  <Check className="h-4 w-4" />
                  确定
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export default InlineTimePicker
