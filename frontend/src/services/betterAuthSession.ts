import { FetchTimeoutError, fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { buildAuthWebUrl, getAuthWebApiProxyBaseUrl, getAuthWebBaseUrl, isAuthWebEnabled } from '@/lib/runtimeEnv'

const AUTH_SESSION_TIMEOUT_MS = 8_000

export type BetterAuthSessionUser = {
  id: string
  email: string
  name: string | null
  image: string | null
}

type BetterAuthSessionResponse = {
  user?: BetterAuthSessionUser | null
  session?: unknown
}

function authBridgeUrl(path: string) {
  const base = getAuthWebBaseUrl()
  if (!base) return ''
  return `${base}${path}`
}

export async function fetchBetterAuthSession(): Promise<BetterAuthSessionUser | null> {
  if (!isAuthWebEnabled()) return null

  const url = authBridgeUrl('/api/auth-bridge/session')
  if (!url) return null

  try {
    const response = await fetchWithTimeout(
      url,
      {
        credentials: 'include',
        cache: 'no-store',
      },
      AUTH_SESSION_TIMEOUT_MS,
    )

    if (!response.ok) return null

    const data = (await response.json()) as BetterAuthSessionResponse
    if (!data.user?.id || !data.user.email) return null
    return data.user
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      console.warn('[Auth] BetterAuth session 请求超时，按未登录处理')
      return null
    }
    console.warn('[Auth] BetterAuth session 请求失败，按未登录处理', error)
    return null
  }
}

export async function signOutBetterAuth(): Promise<void> {
  if (!isAuthWebEnabled()) return

  await fetch(authBridgeUrl('/api/auth-bridge/sign-out'), {
    method: 'POST',
    credentials: 'include',
  })
}

export function redirectToAuthWebLogin(returnTo = window.location.href) {
  const url = buildAuthWebUrl('/account', returnTo)
  if (url) window.location.assign(url)
}

/**
 * 经 Next 代理调用 /api/auth/me，换取当前用户的 id 与角色。
 * 2026-07-17 身份统一：id 即 BetterAuth "user".id（字符串原样透传，
 * 不再是旧 users 整数 id）；role 实时来自后端 entitlements。
 */
export async function fetchLegacyUserInfo(): Promise<{ id: string | null; role: string | null }> {
  const proxyBase = getAuthWebApiProxyBaseUrl()
  if (!proxyBase) return { id: null, role: null }

  try {
    const response = await fetchWithTimeout(
      `${proxyBase}/api/auth/me`,
      { credentials: 'include', cache: 'no-store' },
      AUTH_SESSION_TIMEOUT_MS,
    )
    if (!response.ok) return { id: null, role: null }

    const data = (await response.json()) as { id?: string; role?: string }
    return {
      id: typeof data.id === 'string' && data.id.trim() ? data.id : null,
      role: typeof data.role === 'string' && data.role ? data.role : null,
    }
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      console.warn('[Auth] 用户信息回填请求超时，保留 BetterAuth 身份')
      return { id: null, role: null }
    }
    console.warn('[Auth] 用户信息回填请求失败，保留 BetterAuth 身份', error)
    return { id: null, role: null }
  }
}
