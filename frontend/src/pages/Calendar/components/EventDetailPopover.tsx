import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, MapPin, PencilLine, Trash2, X } from 'lucide-react'
import type { CalendarEvent } from '../types'

type EventDetailPopoverProps = {
  open: boolean
  event: CalendarEvent | null
  anchorRect: DOMRect | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
}

export function EventDetailPopover({ open, event, anchorRect, onClose, onEdit, onDelete }: EventDetailPopoverProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (cardRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, onClose])

  const position = useMemo(() => {
    if (!anchorRect) return { top: 0, left: 0 }
    const width = 760
    const gap = 12
    const top = Math.max(12, Math.min(window.innerHeight - 520, anchorRect.top - 8))
    const preferRight = anchorRect.right + gap
    const left = preferRight + width <= window.innerWidth - 12
      ? preferRight
      : Math.max(12, anchorRect.left - width - gap)
    return { top, left }
  }, [anchorRect])

  if (!open || !event || !anchorRect || typeof document === 'undefined') return null

  const start = new Date(event.starts_at)
  const end = new Date(event.ends_at)
  const timeLabel = `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 ${start.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} - ${end.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} (GMT+8)`

  return createPortal(
    <div className="fixed inset-0 z-[100000] pointer-events-none">
      <div
        ref={cardRef}
        className="pointer-events-auto absolute w-full max-w-[760px] rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex items-center justify-end gap-2 border-b border-slate-200 px-4 py-3">
          <button type="button" onClick={onEdit} title="编辑日程" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100">
            <PencilLine className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => void onDelete()} title="删除日程" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100">
            <Trash2 className="h-5 w-5" />
          </button>
          <button type="button" onClick={onClose} title="关闭" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-7 w-7 rounded-lg bg-blue-500/90" />
            <div>
              <h3 className="text-4xl font-bold text-blue-700">{event.title}</h3>
              <p className="mt-1 text-xl font-medium text-blue-600">{timeLabel}</p>
            </div>
          </div>

          <div className="space-y-3 text-lg text-slate-700">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-slate-400" />
              <span>提醒 5 分钟（默认）</span>
            </div>
            {event.location ? (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-slate-400" />
                <span>{event.location}</span>
              </div>
            ) : null}
            {event.notes ? <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{event.notes}</p> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
