/**
 * 应用内确认弹窗：替代原生 window.confirm()。
 * 用法：import { confirmDialog } from '@/lib/confirm'
 *   if (!(await confirmDialog({ title: '确定删除？', description: '不可恢复', danger: true }))) return
 * <ConfirmHost /> 挂在 App 根部；模块级单例，无需 Provider。
 */
import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  /** 危险操作：确认按钮红色 */
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

let listener: ((p: PendingConfirm) => void) | null = null

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      // Host 未挂载时兜底原生 confirm，保证行为不丢
      resolve(window.confirm(options.title))
      return
    }
    listener({ ...options, resolve })
  })
}

export function ConfirmHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  useEffect(() => {
    listener = (p) => setPending(p)
    return () => {
      listener = null
    }
  }, [])

  if (!pending) return null

  const close = (ok: boolean) => {
    pending.resolve(ok)
    setPending(null)
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && close(false)}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          {pending.danger && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/50">
              <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {pending.title}
            </p>
            {pending.description && (
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {pending.description}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {pending.cancelText || '取消'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-colors ${
              pending.danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {pending.confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
