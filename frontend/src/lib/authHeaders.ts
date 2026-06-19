export const BETTER_AUTH_SESSION_TOKEN = 'better-auth-session'

export function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  try {
    const token = localStorage.getItem('auth_token')
    if (!token || token === BETTER_AUTH_SESSION_TOKEN) {
      return { ...extra }
    }
    return { Authorization: `Bearer ${token}`, ...extra }
  } catch {
    return { ...extra }
  }
}

export function hasAuthenticatedSession(): boolean {
  try {
    const token = localStorage.getItem('auth_token')
    return Boolean(token)
  } catch {
    return false
  }
}