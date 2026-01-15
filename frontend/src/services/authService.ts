import axios from 'axios'

// 处理 API_BASE，确保有协议前缀
const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || ''
let API_BASE = ''
if (rawApiBase) {
  API_BASE = rawApiBase.startsWith('http') ? rawApiBase : `https://${rawApiBase}`
} else {
  if (import.meta.env.PROD) {
    API_BASE = ''
  } else {
    API_BASE = 'http://localhost:9000'
  }
}

const authClient = axios.create({
  baseURL: API_BASE
})

export type AuthUser = {
  id: number
  email: string
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

export async function register(email: string, password: string): Promise<TokenResponse> {
  const { data } = await authClient.post('/api/auth/register', { email, password })
  return data as TokenResponse
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await authClient.post('/api/auth/login', { email, password })
  return data as TokenResponse
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await authClient.get('/api/auth/me')
  return data as AuthUser
}
