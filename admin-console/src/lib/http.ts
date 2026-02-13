import axios from 'axios'
import { clearToken, getToken } from './auth'

const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || ''
const API_BASE = rawApiBase
  ? (rawApiBase.startsWith('http') ? rawApiBase : `https://${rawApiBase}`)
  : (import.meta.env.PROD ? '' : 'http://localhost:9000')

export const http = axios.create({
  baseURL: API_BASE,
})

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken()
    }
    return Promise.reject(error)
  },
)
