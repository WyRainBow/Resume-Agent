import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isAuthWebEnabled } from '@/lib/runtimeEnv'
import { getCurrentUser, login as loginApi, register as registerApi, setAuthToken } from '@/services/authService'
import {
  fetchBetterAuthSession,
  fetchLegacyUserId,
  redirectToAuthWebLogin,
  signOutBetterAuth,
  type BetterAuthSessionUser,
} from '@/services/betterAuthSession'
import { syncLocalToDatabase } from '@/services/syncService'

type User = {
  id: number
  username: string
  email?: string
  image?: string | null
  betterAuthUserId?: string
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
const BETTER_AUTH_TOKEN = 'better-auth-session'
const LOGIN_SYNC_DELAY_MS = 2500

function mapBetterAuthUser(sessionUser: BetterAuthSessionUser): User {
  return {
    id: 0,
    username: sessionUser.name || sessionUser.email.split('@')[0],
    email: sessionUser.email,
    image: sessionUser.image,
    betterAuthUserId: sessionUser.id,
  }
}

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
      try {
        if (isAuthWebEnabled()) {
          const sessionUser = await fetchBetterAuthSession()
          if (sessionUser) {
            setUser(mapBetterAuthUser(sessionUser))
            setToken(BETTER_AUTH_TOKEN)
            // 异步回填真实 legacy user.id（经 proxy + trusted headers），不阻塞首屏；
            // 失败时保留 betterAuthUserId，id 维持 0，不影响登录态判断。
            void fetchLegacyUserId().then((legacyId) => {
              if (legacyId) {
                setUser((prev) => (prev ? { ...prev, id: legacyId } : prev))
              }
            })
            return
          }

          // BetterAuth 已启用时不再走 legacy JWT /api/auth/me，避免代理层查远程 DB 卡死首屏
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
          setAuthToken(null)
          setUser(null)
          setToken(null)
          return
        }

        const savedToken = localStorage.getItem(TOKEN_KEY)
        const savedUserRaw = localStorage.getItem(USER_KEY)
        if (!savedToken) return

        setAuthToken(savedToken)

        // 优先使用本地缓存用户信息完成首屏鉴权态，避免刷新等待 /api/auth/me
        if (savedUserRaw) {
          try {
            const parsed = JSON.parse(savedUserRaw) as User
            if (parsed && typeof parsed.id === 'number' && typeof parsed.username === 'string') {
              setUser(parsed)
              setToken(savedToken)
              return
            }
          } catch {
            localStorage.removeItem(USER_KEY)
          }
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
      } finally {
        setLoading(false)
      }
    }

    void init()
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
    void (async () => {
      if (user?.betterAuthUserId) {
        await signOutBetterAuth()
      }
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setAuthToken(null)
      setUser(null)
      setToken(null)
    })()
  }, [user?.betterAuthUserId])

  const openModal = useCallback((mode: 'login' | 'register' = 'login') => {
    if (isAuthWebEnabled()) {
      redirectToAuthWebLogin()
      return
    }
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
      isAuthenticated: Boolean(user && (token || user.betterAuthUserId)),
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
