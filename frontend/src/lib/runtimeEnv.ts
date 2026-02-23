export type RuntimeEnv = 'local' | 'remote-dev'

const ENV_STORAGE_KEY = 'resume_agent_env'
const DEFAULT_LOCAL_API_BASE = 'http://127.0.0.1:9000'
const DEFAULT_REMOTE_API_BASE = 'https://resumegenkk.xyz'

function normalizeBaseUrl(url: string): string {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `https://${raw}`
}

function envBaseMap(): Record<RuntimeEnv, string> {
  const legacyApiBase = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '')
  const localDefault = import.meta.env.PROD ? '' : DEFAULT_LOCAL_API_BASE
  const localBase =
    normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL_LOCAL || '') ||
    legacyApiBase ||
    localDefault
  const remoteBase =
    normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL_REMOTE_DEV || '') ||
    normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL_REMOTE || '') ||
    DEFAULT_REMOTE_API_BASE
  return {
    local: localBase,
    'remote-dev': remoteBase,
  }
}

function isRuntimeEnv(value: string): value is RuntimeEnv {
  return value === 'local' || value === 'remote-dev'
}

export function getDefaultRuntimeEnv(): RuntimeEnv {
  const configured = String(import.meta.env.VITE_ENV_DEFAULT || '').trim()
  return configured === 'remote-dev' ? 'remote-dev' : 'local'
}

export function getRuntimeEnv(): RuntimeEnv {
  try {
    const saved = localStorage.getItem(ENV_STORAGE_KEY)
    if (saved && isRuntimeEnv(saved)) return saved
  } catch {
    // no-op
  }
  return getDefaultRuntimeEnv()
}

export function setRuntimeEnv(env: RuntimeEnv): void {
  localStorage.setItem(ENV_STORAGE_KEY, env)
}

/**
 * 开发环境下返回空字符串，使请求走同源（localhost:5173）并由 Vite 代理转发，避免跨域 CORS。
 * 代理目标在 vite.config 中由 VITE_API_BASE_URL 等决定，需与当前要用的后端一致（改 .env 后需重启 dev）。
 */
export function getApiBaseUrl(env: RuntimeEnv = getRuntimeEnv()): string {
  if (import.meta.env.DEV) return ''
  const baseMap = envBaseMap()
  return env === 'remote-dev' ? baseMap['remote-dev'] : baseMap.local
}

export function getRuntimeEnvOptions() {
  const baseMap = envBaseMap()
  return [
    { key: 'local' as const, label: '本地环境', baseUrl: baseMap.local },
    { key: 'remote-dev' as const, label: '远程开发', baseUrl: baseMap['remote-dev'] },
  ]
}
