import axios from 'axios'
import { getAuthWebBaseUrl, isAuthWebEnabled } from '@/lib/runtimeEnv'

let configured = false

export function configureAuthWebRequests(): void {
  if (configured || !isAuthWebEnabled()) return
  configured = true

  const authWebOrigin = new URL(getAuthWebBaseUrl()).origin
  axios.interceptors.request.use((config) => {
    const requestUrl = new URL(
      `${config.baseURL || ''}${config.url || ''}`,
      window.location.origin,
    )

    if (requestUrl.origin === authWebOrigin) {
      config.withCredentials = true
    }

    return config
  })

  const nativeFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const requestUrl =
      typeof input === 'string' || input instanceof URL
        ? new URL(input, window.location.origin)
        : new URL(input.url, window.location.origin)

    if (requestUrl.origin !== authWebOrigin) {
      return nativeFetch(input, init)
    }

    return nativeFetch(input, {
      ...init,
      credentials: init.credentials || 'include',
    })
  }
}
