export class FetchTimeoutError extends Error {
  constructor(message = '请求超时') {
    super(message)
    this.name = 'FetchTimeoutError'
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new FetchTimeoutError()
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}