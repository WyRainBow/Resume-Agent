import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getCurrentUser, login as loginApi, register as registerApi, setAuthToken } from '@/services/authService'
import { syncLocalToDatabase } from '@/services/syncService'

type User = {
  id: number
  username: string
  email?: string
}

type AuthContextValue = {
  user: User | null
  token: string | null
  loading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  isModalOpen: boolean
  openModal: (mode?: 'login' | 'register') => void
  closeModal: () => void
  modalMode: 'login' | 'register'
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'
const LOGIN_SYNC_DELAY_MS = 2500

function isUnauthorizedError(err: unknown): boolean {
  const status = (err as any)?.response?.status
  return status === 401 || status === 403
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'login' | 'register'>('login')

  useEffect(() => {
    const init = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY)
      const savedUserRaw = localStorage.getItem(USER_KEY)
      if (savedToken) {
        setAuthToken(savedToken)
        let hasHydratedLocalUser = false

        // 优先使用本地缓存用户信息完成首屏鉴权态，避免刷新等待 /api/auth/me
        if (savedUserRaw) {
          try {
            const parsed = JSON.parse(savedUserRaw) as User
            if (parsed && typeof parsed.id === 'number' && typeof parsed.username === 'string') {
              setUser(parsed)
              setToken(savedToken)
              hasHydratedLocalUser = true
            }
          } catch {
            localStorage.removeItem(USER_KEY)
          }
        }

        if (hasHydratedLocalUser) {
          // 本地已存在登录态时直接放行，避免进入仪表盘时额外触发 /api/auth/me 慢查询
          setLoading(false)
          return
        }

        try {
          const currentUser = await getCurrentUser()
          setUser(currentUser)
          setToken(savedToken)
          localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
        } catch (err) {
          if (isUnauthorizedError(err)) {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(USER_KEY)
            setAuthToken(null)
            setUser(null)
            setToken(null)
          }
        }
      }
      setLoading(false)
    }

    init()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginApi(username, password)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(result.user))
    setAuthToken(result.access_token)
    setUser(result.user)
    setToken(result.access_token)
    // 登录成功后延迟同步本地数据，避免与仪表盘首屏请求抢占资源
    window.setTimeout(() => {
      void syncLocalToDatabase().catch(() => {
        // 同步失败不影响登录流程
      })
    }, LOGIN_SYNC_DELAY_MS)
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const result = await registerApi(username, password)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(result.user))
    setAuthToken(result.access_token)
    setUser(result.user)
    setToken(result.access_token)
    // 注册后同样延迟同步，降低首次进入页面时的并发压力
    window.setTimeout(() => {
      void syncLocalToDatabase().catch(() => {
        // 同步失败不影响注册流程
      })
    }, LOGIN_SYNC_DELAY_MS)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setAuthToken(null)
    setUser(null)
    setToken(null)
  }, [])

  const openModal = useCallback((mode: 'login' | 'register' = 'login') => {
    setModalMode(mode)
    setIsModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
      isModalOpen,
      openModal,
      closeModal,
      modalMode
    }),
    [user, token, loading, login, register, logout, isModalOpen, openModal, closeModal, modalMode]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
