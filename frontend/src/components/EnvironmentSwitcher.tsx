import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Server, Wifi } from 'lucide-react'
import { useEnvironment } from '@/contexts/EnvironmentContext'
import type { RuntimeEnv } from '@/lib/runtimeEnv'
import { getApiBaseUrl } from '@/lib/runtimeEnv'

function getRoleFromToken(): string {
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) return ''
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return ''
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    return String(payload?.role || '').toLowerCase()
  } catch {
    return ''
  }
}

export default function EnvironmentSwitcher() {
  const { env, setEnv, apiBaseUrl, options } = useEnvironment()
  const [checking, setChecking] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let mounted = true
    const role = getRoleFromToken()
    if (role === 'admin' || role === 'member') {
      setHasAccess(true)
      setChecked(true)
      return () => {
        mounted = false
      }
    }

    const token = localStorage.getItem('auth_token')
    if (!token) {
      setChecked(true)
      setHasAccess(false)
      return
    }
    void fetch(`${getApiBaseUrl()}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((resp) => {
        if (!mounted) return
        setHasAccess(resp.ok)
      })
      .catch(() => {
        if (!mounted) return
        setHasAccess(false)
      })
      .finally(() => {
        if (!mounted) return
        setChecked(true)
      })
    return () => {
      mounted = false
    }
  }, [env])

  if (!checked || !hasAccess) {
    return null
  }

  const onEnvChange = (nextEnv: RuntimeEnv) => {
    if (nextEnv === env) return
    setEnv(nextEnv)
    const label = nextEnv === 'local' ? '本地环境' : '远程开发环境'
    alert(`已切换到${label}`)
  }

  const testConnection = async () => {
    setChecking(true)
    const currentBase = getApiBaseUrl(env)
    try {
      const resp = await fetch(`${currentBase}/api/health`, { method: 'GET' })
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`)
      }
      alert(`连接成功：${currentBase}`)
    } catch (err: any) {
      alert(`连接失败：${currentBase}\n${err?.message || '请检查网络或后端服务'}`)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Server className="h-4.5 w-4.5" />
      </span>
      <select
        value={env}
        onChange={(e) => onEnvChange(e.target.value as RuntimeEnv)}
        className="h-9 min-w-[112px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        title="切换环境"
      >
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void testConnection()}
        disabled={checking}
        className="inline-flex h-9 min-w-[118px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100 disabled:cursor-wait disabled:opacity-80 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-800"
        title="测试连接"
      >
        {checking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-slate-500 dark:text-slate-300" />
            检测中
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4 text-slate-500 dark:text-slate-300" />
            测试连接
          </>
        )}
      </button>
      {!checking && (
        <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 lg:inline-flex dark:bg-emerald-900/30 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          在线
        </span>
      )}
    </div>
  )
}
