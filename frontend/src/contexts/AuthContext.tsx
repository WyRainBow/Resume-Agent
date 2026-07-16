import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { buildAuthWebUrl, isAuthWebEnabled } from '@/lib/runtimeEnv'
import { getCurrentUser, login as loginApi, register as registerApi, setAuthToken } from '@/services/authService'
import { fetchUserEntitlement } from '@/services/api'
import {
  fetchBetterAuthSession,
  fetchLegacyUserInfo,
  signOutBetterAuth,
  type BetterAuthSessionUser,
} from '@/services/betterAuthSession'
import {
  setResumeStorageSession,
  syncLocalResumesToCurrentAccount,
} from '@/services/resumeStorage'

type User = {
  id: number
  username: string
  email?: string
  image?: string | null
  betterAuthUserId?: string
  role?: string
  credits?: number
  plan?: string
}

type AuthContextValue = {
  user: User | null
  token: string | null
  loading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshEntitlement: () => Promise<void>
  isModalOpen: boolean
  openModal: (mode?: 'login' | 'register') => void
  closeModal: () => void
  modalMode: 'login' | 'register'
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'
/** BetterAuth 登录态的占位 token（非真实凭证）。
 * 把它当 Bearer 发出去会触发 auth-web 的 bearer 插件校验失败、连带 cookie session 一起判空，
 * 所以手动附 Authorization 头前必须用它判断“跳过 Bearer、纯走 cookie”。 */
export const BETTER_AUTH_TOKEN = 'better-auth-session'
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

function isLegacyUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<User>
  return typeof candidate.id === 'number'
    && candidate.id > 0
    && typeof candidate.username === 'string'
    && Boolean(candidate.username.trim())
}

function resumeStorageIdentity(user: User | null): string | null {
  if (!user) return null
  if (user.betterAuthUserId) return `better-auth:${user.betterAuthUserId}`
  return user.id > 0 ? `legacy:${user.id}` : null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'login' | 'register'>('login')

  const applyAuthState = useCallback((nextUser: User | null, nextToken: string | null) => {
    setResumeStorageSession(resumeStorageIdentity(nextUser))
    setUser(nextUser)
    setToken(nextToken)
  }, [])

  useEffect(() => {
    const init = async () => {
      applyAuthState(null, null)
      try {
        // 检查 URL 中是否携带 Legacy JWT token（从 Next.js 认证页回跳）
        const urlParams = new URLSearchParams(window.location.search)
        const legacyToken = urlParams.get('legacy_token')
        if (legacyToken) {
          localStorage.setItem(TOKEN_KEY, legacyToken)
          setAuthToken(legacyToken)
          let resolvedUser: User | null = null
          try {
            // 回跳参数不作为认证事实，始终用后端验证 token 并返回真实用户。
            resolvedUser = await getCurrentUser()
          } catch {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(USER_KEY)
            setAuthToken(null)
          }
          if (resolvedUser) {
            localStorage.setItem(USER_KEY, JSON.stringify(resolvedUser))
            applyAuthState(resolvedUser, legacyToken)
          }
          // 清理地址栏参数
          urlParams.delete('legacy_token')
          urlParams.delete('legacy_user')
          const cleanSearch = urlParams.toString()
          const cleanUrl = cleanSearch
            ? `${window.location.pathname}?${cleanSearch}`
            : window.location.pathname
          window.history.replaceState({}, '', cleanUrl)
          return
        }

        if (isAuthWebEnabled()) {
          const sessionUser = await fetchBetterAuthSession()
          if (sessionUser) {
            applyAuthState(mapBetterAuthUser(sessionUser), BETTER_AUTH_TOKEN)
            // 异步回填真实 legacy user.id 与角色（经 proxy + trusted headers），不阻塞首屏；
            // 失败时保留 betterAuthUserId，id 维持 0，不影响登录态判断。
            void fetchLegacyUserInfo().then(({ id: legacyId, role }) => {
              setUser((prev) => {
                if (!prev) return prev
                const next: User = { ...prev }
                if (legacyId) next.id = legacyId
                if (role) next.role = role
                // BetterAuth 模式无 legacy JWT，将角色落到 auth_user，
                // 供 getStoredAuthRole / canUseAdminFeature 同步读取，恢复管理员功能门控。
                try {
                  localStorage.setItem(USER_KEY, JSON.stringify(next))
                } catch {
                  // 持久化失败不影响登录态
                }
                return next
              })
            })
            // 异步拉取额度，不阻塞首屏
            void fetchUserEntitlement().then((ent) => {
              setUser((prev) =>
                prev ? { ...prev, credits: ent.credits, plan: ent.plan } : prev,
              )
            }).catch(() => {/* 拉取失败不影响登录态 */})
            return
          }

          // BetterAuth session 不存在时，回退到 legacy JWT（用户名/密码登录），
          // 不再强制清除 legacy token，确保两套登录方式可以共存。
        }

        const savedToken = localStorage.getItem(TOKEN_KEY)
        const savedUserRaw = localStorage.getItem(USER_KEY)
        if (!savedToken) return

        setAuthToken(savedToken)

        // 缓存只做格式清理，不能作为认证事实；云端存储必须等 /api/auth/me 验证。
        if (savedUserRaw) {
          try {
            const parsed = JSON.parse(savedUserRaw) as unknown
            if (!isLegacyUser(parsed)) localStorage.removeItem(USER_KEY)
          } catch {
            localStorage.removeItem(USER_KEY)
          }
        }

        try {
          const currentUser = await getCurrentUser()
          applyAuthState(currentUser, savedToken)
          localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
        } catch (err) {
          if (isUnauthorizedError(err)) {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(USER_KEY)
            setAuthToken(null)
            applyAuthState(null, null)
          }
        }
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [applyAuthState])

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginApi(username, password)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(result.user))
    setAuthToken(result.access_token)
    applyAuthState(result.user, result.access_token)
    const storageIdentity = resumeStorageIdentity(result.user)
    // 登录成功后延迟同步本地数据，避免与仪表盘首屏请求抢占资源
    window.setTimeout(() => {
      void syncLocalResumesToCurrentAccount(storageIdentity).catch(() => {
        // 同步失败不影响登录流程
      })
    }, LOGIN_SYNC_DELAY_MS)
  }, [applyAuthState])

  const register = useCallback(async (username: string, password: string) => {
    const result = await registerApi(username, password)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(result.user))
    setAuthToken(result.access_token)
    applyAuthState(result.user, result.access_token)
    const storageIdentity = resumeStorageIdentity(result.user)
    // 注册后同样延迟同步，降低首次进入页面时的并发压力
    window.setTimeout(() => {
      void syncLocalResumesToCurrentAccount(storageIdentity).catch(() => {
        // 同步失败不影响注册流程
      })
    }, LOGIN_SYNC_DELAY_MS)
  }, [applyAuthState])

  const refreshEntitlement = useCallback(async () => {
    try {
      const ent = await fetchUserEntitlement()
      setUser((prev) => (prev ? { ...prev, credits: ent.credits, plan: ent.plan } : prev))
    } catch {
      // ignore
    }
  }, [])

  const logout = useCallback(() => {
    void (async () => {
      const shouldSignOutBetterAuth = Boolean(user?.betterAuthUserId)
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setAuthToken(null)
      // 先关闭本地会话并中止在途简历请求，避免退出请求清 Cookie 的窗口里继续写云端。
      applyAuthState(null, null)
      if (shouldSignOutBetterAuth) {
        await signOutBetterAuth()
      }
    })()
  }, [applyAuthState, user?.betterAuthUserId])

  const openModal = useCallback((mode: 'login' | 'register' = 'login') => {
    // BetterAuth 启用时，直接重定向到 Next.js 认证页（统一登录入口）
    if (isAuthWebEnabled()) {
      const url = buildAuthWebUrl('/account', `${window.location.origin}${window.location.pathname}${window.location.search}`)
      if (url) {
        window.location.assign(url)
        return
      }
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
      refreshEntitlement,
      isModalOpen,
      openModal,
      closeModal,
      modalMode
    }),
    [user, token, loading, login, register, logout, refreshEntitlement, isModalOpen, openModal, closeModal, modalMode]
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
