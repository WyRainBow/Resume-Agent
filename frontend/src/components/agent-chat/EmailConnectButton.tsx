/**
 * 对话输入框「连接邮箱」入口(仅管理员可见)。
 * 参考 Manus 的 Connect an app:图标按钮 + 弹层面板,当前只有 QQ 邮箱一种应用。
 * 弹层样式对齐 PortalDropdown(border-2 硬阴影直角),按钮样式对齐 Composer 的 Plus 按钮。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mail } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { canUseAdminFeature } from '@/lib/runtimeEnv'
import {
  deleteEmailCredential,
  getEmailCredentialStatus,
  saveEmailCredential,
  type EmailCredentialStatus,
} from '@/services/emailCredentialService'

const PORTAL_ID = 'email-connect-portal'

export default function EmailConnectButton() {
  const { isAuthenticated, token } = useAuth()
  const canUse = isAuthenticated && canUseAdminFeature()

  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<EmailCredentialStatus | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [authCodeInput, setAuthCodeInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })

  const refreshStatus = useCallback(() => {
    if (!canUse || !token) return
    getEmailCredentialStatus(token)
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [canUse, token])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  // 点击面板外收起
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const portalRoot = document.getElementById(PORTAL_ID)
      if (rootRef.current?.contains(target)) return
      if (portalRoot?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  if (!canUse) return null

  const toggleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const width = 300
      setPopupPos({
        top: rect.top - 8, // 面板显示在按钮上方(输入框在页面底部)
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      })
    }
    setError('')
    setOpen((prev) => !prev)
  }

  const handleSave = async () => {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const next = await saveEmailCredential(token, emailInput.trim(), authCodeInput.trim())
      setStatus(next)
      setEmailInput('')
      setAuthCodeInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const next = await deleteEmailCredential(token)
      setStatus(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '断开失败')
    } finally {
      setBusy(false)
    }
  }

  const configured = status?.configured === true

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="relative size-8 rounded-none border-2 border-black text-chat-ink-muted shadow-[2px_2px_0px_0px_#000000] flex items-center justify-center transition-all hover:text-chat-accent-deep hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff]"
        title={configured ? `邮箱已连接:${status?.masked_email ?? ''}` : '连接 QQ 邮箱'}
        aria-label="连接邮箱"
      >
        <Mail className="size-4" />
        {configured && (
          <span className="absolute -right-1 -top-1 size-2.5 rounded-full border border-black bg-green-500 dark:border-white" />
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div id={PORTAL_ID} className="fixed inset-0 z-[1200]" style={{ pointerEvents: 'none' }}>
            <div
              className="absolute w-[300px] -translate-y-full rounded-none border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000000] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[3px_3px_0px_0px_#ffffff]"
              style={{ top: popupPos.top, left: popupPos.left, pointerEvents: 'auto' }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  连接应用
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                    configured ? 'text-green-600 dark:text-green-400' : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${configured ? 'bg-green-500' : 'bg-slate-300'}`}
                  />
                  {configured ? '已连接' : '未连接'}
                </span>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                <Mail className="size-4 shrink-0 text-chat-accent-deep dark:text-amber-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">QQ 邮箱</div>
                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {configured ? status?.masked_email : '连接后可在对话里让 Coco 帮你发简历'}
                  </div>
                </div>
                {configured && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={busy}
                    className="h-7 shrink-0 rounded-none border border-black px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    断开
                  </button>
                )}
              </div>

              {!configured && (
                <div className="mt-2 space-y-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="QQ 邮箱地址,如 12345@qq.com"
                    className="h-8 w-full rounded-none border border-black bg-white px-2 text-xs outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-100"
                  />
                  <input
                    type="password"
                    value={authCodeInput}
                    onChange={(e) => setAuthCodeInput(e.target.value)}
                    placeholder="SMTP 授权码(非 QQ 密码)"
                    className="h-8 w-full rounded-none border border-black bg-white px-2 text-xs outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-100"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href="https://service.mail.qq.com/detail/0/75"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-slate-500 underline hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      如何获取授权码?
                    </a>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={busy || !emailInput.trim() || !authCodeInput.trim()}
                      className="h-7 rounded-none border border-black bg-slate-900 px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                    >
                      {busy ? '保存中…' : '连接'}
                    </button>
                  </div>
                </div>
              )}

              {error && <div className="mt-2 text-[11px] text-red-600 dark:text-red-400">{error}</div>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
