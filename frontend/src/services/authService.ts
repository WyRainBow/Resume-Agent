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
  const { data } = await authClient.post('/api/auth/register', { username, password })
  return data as TokenResponse
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  const { data } = await authClient.post('/api/auth/login', { username, password })
  return data as TokenResponse
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await authClient.get('/api/auth/me')
  return data as AuthUser
}
