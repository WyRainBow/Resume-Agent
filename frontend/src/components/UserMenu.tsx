import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function UserMenu() {
  const { user, isAuthenticated, logout, openModal } = useAuth()

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => openModal('login')}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        登录/注册
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700">{user?.username || user?.email}</span>
      <button
        className="text-sm text-gray-600 hover:text-gray-900"
        onClick={logout}
      >
        退出登录
      </button>
    </div>
  )
}
