import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'login' | 'register'>('login')

  useEffect(() => {
    const init = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY)
      if (savedToken) {
        setAuthToken(savedToken)
        try {
          const currentUser = await getCurrentUser()
          setUser(currentUser)
          setToken(savedToken)
        } catch {
          localStorage.removeItem(TOKEN_KEY)
          setAuthToken(null)
          setUser(null)
          setToken(null)
        }
      }
      setLoading(false)
    }

    init()
  }, [])

  const login = async (username: string, password: string) => {
    const result = await loginApi(username, password)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    setAuthToken(result.access_token)
    setUser(result.user)
    setToken(result.access_token)
    try {
      await syncLocalToDatabase()
    } catch {
      // 同步失败不影响登录流程
    }
  }

  const register = async (username: string, password: string) => {
    const result = await registerApi(username, password)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    setAuthToken(result.access_token)
    setUser(result.user)
    setToken(result.access_token)
    try {
      await syncLocalToDatabase()
    } catch {
      // 同步失败不影响注册流程
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setAuthToken(null)
    setUser(null)
    setToken(null)
  }

  const openModal = (mode: 'login' | 'register' = 'login') => {
    setModalMode(mode)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

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
    [user, token, loading, isModalOpen, modalMode]
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
