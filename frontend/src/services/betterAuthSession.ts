import { FetchTimeoutError, fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { buildAuthWebUrl, getAuthWebBaseUrl, isAuthWebEnabled } from '@/lib/runtimeEnv'

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