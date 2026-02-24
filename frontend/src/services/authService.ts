import axios from 'axios'
import { getApiBaseUrl } from '@/lib/runtimeEnv'

const authClient = axios.create({
  baseURL: getApiBaseUrl(),
})

export type AuthUser = {
  id: number
  username: string
  email?: string
}

export type TokenResponse = {
  access_token: string
  token_type: string
  user: AuthUser
}

type ApiErrorPayload = {
  detail?: unknown
  message?: unknown
  error?: unknown
}

function normalizeMessage(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    // 避免把整页 HTML 错误页直接展示给用户
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) return ''
    return trimmed
  }
  if (Array.isArray(value)) {
    const first = value.find(Boolean)
    return normalizeMessage(first)
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return (
      normalizeMessage(obj.detail) ||
      normalizeMessage(obj.message) ||
      normalizeMessage(obj.error) ||
      normalizeMessage(obj.msg)
    )
  }
  return ''
}

function buildAuthError(error: unknown, action: '登录' | '注册'): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data as ApiErrorPayload | string | undefined

    const backendMessage =
      normalizeMessage((data as ApiErrorPayload)?.detail) ||
      normalizeMessage((data as ApiErrorPayload)?.message) ||
      normalizeMessage((data as ApiErrorPayload)?.error) ||
      normalizeMessage(data)

    if (backendMessage) return new Error(backendMessage)

    if (!status) {
      return new Error(`${action}失败：无法连接服务器，请检查后端服务或网络`)
    }

    const statusFallback: Record<number, string> = {
      400: `${action}失败：请求参数不正确`,
      401: `${action}失败：账号或密码错误，或登录状态已失效`,
      403: `${action}失败：当前账号无权限`,
      404: `${action}失败：接口不存在`,
      409: `${action}失败：资源冲突，请检查账号是否已存在`,
      422: `${action}失败：输入校验未通过，请检查账号和密码格式`,
      429: `${action}失败：请求过于频繁，请稍后重试`,
      500: `${action}失败：服务器内部错误`,
      501: `${action}失败：服务器暂不支持该操作`,
      502: `${action}失败：网关错误，请稍后重试`,
      503: `${action}失败：服务暂时不可用，请稍后重试`,
      504: `${action}失败：服务响应超时，请稍后重试`,
    }

    return new Error(statusFallback[status] || `${action}失败：HTTP ${status}`)
  }
  return new Error(`${action}失败，请稍后重试`)
}

export function setAuthToken(token: string | null) {
  if (token) {
    authClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete authClient.defaults.headers.common['Authorization']
  }
}

authClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()
  return config
})

authClient.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('auth_token')
      setAuthToken(null)
    }
    return Promise.reject(error)
  }
)

export async function register(username: string, password: string): Promise<TokenResponse> {
  try {
    const { data } = await authClient.post('/api/auth/register', { username, password })
    return data as TokenResponse
  } catch (error) {
    throw buildAuthError(error, '注册')
  }
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  try {
    const { data } = await authClient.post('/api/auth/login', { username, password })
    return data as TokenResponse
  } catch (error) {
    throw buildAuthError(error, '登录')
  }
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await authClient.get('/api/auth/me')
  return data as AuthUser
}
