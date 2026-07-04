/**
 * 轻量应用内 toast：替代原生 alert()。
 * 用法：import { toast } from '@/lib/toast'；toast('消息') / toast.success('已保存') / toast.error('失败')。
 * <Toaster /> 挂在 App 根部；模块级单例，无需 Provider。
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastKind = 'info' | 'success' | 'error'
interface ToastAction { label: string; onClick: () => void }
interface ToastOptions { action?: ToastAction; duration?: number }
interface ToastItem { id: number; kind: ToastKind; text: string; action?: ToastAction; duration: number }

let seq = 0
let listener: ((t: ToastItem) => void) | null = null

function push(kind: ToastKind, text: string, opts?: ToastOptions) {
  listener?.({
    id: ++seq,
    kind,
    text: String(text),
    action: opts?.action,
    duration: opts?.duration ?? (opts?.action ? 6000 : 4000),
  })
}

export function toast(text: string, opts?: ToastOptions) { push('info', text, opts) }
toast.info = (text: string, opts?: ToastOptions) => push('info', text, opts)
toast.success = (text: string, opts?: ToastOptions) => push('success', text, opts)
toast.error = (text: string, opts?: ToastOptions) => push('error', text, opts)

const KIND_STYLE: Record<ToastKind, string> = {
  info: 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200',
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    listener = (t) => {
      setItems((prev) => [...prev.slice(-3), t])
      window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== t.id)), t.duration)
    }
    return () => { listener = null }
  }, [])
  if (items.length === 0) return null
  return (
    <div className="fixed left-1/2 top-4 z-[9999] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 ${KIND_STYLE[t.kind]}`}
        >
          {t.kind === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : t.kind === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 break-words">{t.text}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.onClick()
                setItems((prev) => prev.filter((i) => i.id !== t.id))
              }}
              className="shrink-0 rounded-md border border-current/30 px-2 py-0.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="关闭提示"
            onClick={() => setItems((prev) => prev.filter((i) => i.id !== t.id))}
            className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
