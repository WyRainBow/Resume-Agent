import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ActionMenuItem = {
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

type ActionMenuProps = {
  items: ActionMenuItem[]
  /** 自定义触发图标，默认竖向三点 ⋮ */
  triggerIcon?: ReactNode
  triggerClassName?: string
  /** tooltip 与无障碍标签 */
  triggerTitle?: string
  /** 菜单相对触发按钮的水平对齐：start=左对齐 end=右对齐（默认 end，避免溢出右侧） */
  align?: 'start' | 'end'
  menuWidthPx?: number
  onOpenChange?: (open: boolean) => void
  portalId?: string
}

/**
 * 轻量上下文操作菜单：⋮ 触发，点击弹出动作列表（重命名/删除等）。
 * 与选择型的 PortalDropdown 区分——这里每一项是「执行动作」而非「选中值」。
 * 菜单 Portal 到 body，避免被侧栏 overflow 裁剪。
 */
export default function ActionMenu({
  items,
  triggerIcon,
  triggerClassName,
  triggerTitle = '更多操作',
  align = 'end',
  menuWidthPx = 160,
  onOpenChange,
  portalId = 'action-menu-root',
}: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: menuWidthPx })

  const setOpenAndNotify = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (document.getElementById(portalId)?.contains(target)) return
      setOpenAndNotify(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenAndNotify(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portalId])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.max(menuWidthPx, rect.width)
    const rawLeft = align === 'end' ? rect.right - width : rect.left
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - width - 8))
    setPos({ top: rect.bottom + 4, left, width })
  }, [open, align, menuWidthPx, items.length])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        title={triggerTitle}
        aria-label={triggerTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpenAndNotify(!open)
        }}
        className={cn(
          'p-1 rounded-md transition-colors text-gray-400 hover:text-gray-700 hover:bg-gray-100/70',
          'dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-700/60',
          open && 'bg-gray-100/70 text-gray-700 dark:bg-slate-700/60 dark:text-slate-200',
          triggerClassName,
        )}
      >
        {triggerIcon ?? <MoreVertical className="w-3.5 h-3.5" />}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div id={portalId} className="fixed inset-0 z-[1200]" style={{ pointerEvents: 'none' }}>
            <div
              role="menu"
              className="absolute rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
              style={{ top: pos.top, left: pos.left, width: pos.width, pointerEvents: 'auto' }}
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    item.onSelect()
                    setOpenAndNotify(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    item.danger
                      ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70',
                  )}
                >
                  {item.icon && (
                    <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
