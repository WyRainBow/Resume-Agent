import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, MapPin, PencilLine, Trash2, X } from 'lucide-react'
import type { CalendarEvent } from '../types'
import { formatChinaTime } from '../dateUtils'

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
    const width = 640
    const gap = 12
    const top = Math.max(12, Math.min(window.innerHeight - 420, anchorRect.top - 8))
    const preferRight = anchorRect.right + gap
    const left = preferRight + width <= window.innerWidth - 12
      ? preferRight
      : Math.max(12, anchorRect.left - width - gap)
    return { top, left }
  }, [anchorRect])

  if (!open || !event || !anchorRect || typeof document === 'undefined') return null

  const start = new Date(event.starts_at)
  const end = new Date(event.ends_at)
  const startDateLabel = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(start)
  const timeLabel = `${startDateLabel} ${formatChinaTime(start)} - ${formatChinaTime(end)} (GMT+8)`

  return createPortal(
    <div className="fixed inset-0 z-[100000] pointer-events-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        ref={cardRef}
        className="pointer-events-auto absolute w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-xl"
        style={{ top: position.top, left: position.left }}
      >
        <div className="relative h-32 bg-slate-900 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
          <div className="absolute top-6 right-6 flex gap-2">
            <button type="button" onClick={onEdit} title="编辑日程" className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-90">
              <PencilLine className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => void onDelete()} title="删除日程" className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-md transition-all hover:bg-red-500/40 active:scale-90">
              <Trash2 className="h-5 w-5" />
            </button>
            <button type="button" onClick={onClose} title="关闭" className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-90">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="absolute bottom-6 left-8">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Interview Session</span>
            </div>
            <h3 className="mt-1 text-3xl font-black text-white tracking-tight">{event.title}</h3>
          </div>
        </div>

        <div className="px-8 py-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Time</span>
              <div className="flex items-start gap-2">
                <Calendar className="mt-1 h-4 w-4 text-slate-900" />
                <div className="text-sm font-bold text-slate-700 leading-relaxed">
                  <div>{startDateLabel}</div>
                  <div className="text-slate-400">{formatChinaTime(start)} - {formatChinaTime(end)}</div>
                </div>
              </div>
            </div>
            {event.location && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</span>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-1 h-4 w-4 text-slate-900" />
                  <div className="text-sm font-bold text-slate-700 leading-relaxed truncate">
                    {event.location}
                  </div>
                </div>
              </div>
            )}
          </div>

          {event.notes && (
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes & Preparation</span>
              <div className="rounded-2xl bg-slate-50 p-5 text-sm font-medium text-slate-600 leading-relaxed border border-slate-100">
                {event.notes}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                  AI
                </div>
              ))}
              <div className="h-8 px-3 rounded-full border-2 border-white bg-blue-50 flex items-center justify-center text-[10px] font-black text-blue-600 uppercase">
                +2 Tools
              </div>
            </div>
            <button 
              type="button"
              className="text-xs font-black text-slate-900 uppercase tracking-widest hover:text-blue-600 transition-colors"
            >
              View Full Details →
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
