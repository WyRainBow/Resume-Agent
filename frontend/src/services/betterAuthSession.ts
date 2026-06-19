import { buildAuthWebUrl, getAuthWebBaseUrl, isAuthWebEnabled } from '@/lib/runtimeEnv'

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

  const response = await fetch(authBridgeUrl('/api/auth-bridge/session'), {
    credentials: 'include',
    cache: 'no-store',
  })

  if (!response.ok) return null

  const data = (await response.json()) as BetterAuthSessionResponse
  if (!data.user?.id || !data.user.email) return null
  return data.user
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