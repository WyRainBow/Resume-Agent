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
 * 经 Next 代理调用 legacy /api/auth/me，换取当前 BetterAuth 用户对应的真实
 * legacy User.id。代理会注入 trusted headers，后端 resolve_legacy_user 据此返回
 * 真实记录。仅在 API 走 Next 代理（VITE_API_VIA_AUTH_WEB）时可用。
 */
export async function fetchLegacyUserId(): Promise<number | null> {
  const proxyBase = getAuthWebApiProxyBaseUrl()
  if (!proxyBase) return null

  try {
    const response = await fetchWithTimeout(
      `${proxyBase}/api/auth/me`,
      { credentials: 'include', cache: 'no-store' },
      AUTH_SESSION_TIMEOUT_MS,
    )
    if (!response.ok) return null

    const data = (await response.json()) as { id?: number }
    return typeof data.id === 'number' && data.id > 0 ? data.id : null
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      console.warn('[Auth] legacy user 回填请求超时，保留 BetterAuth 身份')
      return null
    }
    console.warn('[Auth] legacy user 回填请求失败，保留 BetterAuth 身份', error)
    return null
  }
}