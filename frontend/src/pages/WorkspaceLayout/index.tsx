/**
 * 工作区布局容器
 * 左侧固定边栏（工作区切换），右侧动态内容区
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Edit, Bot, LayoutGrid, FileText, Save, Download, LogIn, User, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { getCurrentResumeId } from '@/services/resumeStorage'

// 工作区类型
type WorkspaceType = 'edit' | 'agent' | 'dashboard' | 'templates'

interface WorkspaceLayoutProps {
  children: React.ReactNode
  onSave?: () => void
  onDownload?: () => void
}

export default function WorkspaceLayout({ children, onSave, onDownload }: WorkspaceLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, logout, openModal } = useAuth()
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const logoutMenuRef = useRef<HTMLDivElement>(null)

  // 根据路径确定当前工作区
  const getCurrentWorkspace = (): WorkspaceType => {
    // 检测是否是简历创建页面（保留 resume-creator）
    if (location.pathname === '/resume-creator' || location.pathname.startsWith('/workspace/agent')) {
      return 'agent'
    }
    if (location.pathname === '/dashboard') {
      return 'dashboard'
    }
    if (location.pathname === '/templates') {
      return 'templates'
    }
    // workspace/html 或 workspace/latex 都算编辑区
    if (location.pathname.startsWith('/workspace')) {
      return 'edit'
    }
    return 'edit'
  }

  const currentWorkspace = getCurrentWorkspace()

  // 点击外部区域关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (logoutMenuRef.current && !logoutMenuRef.current.contains(event.target as Node)) {
        setShowLogoutMenu(false)
      }
    }

    if (showLogoutMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showLogoutMenu])

  const handleWorkspaceChange = (workspace: WorkspaceType) => {
    if (workspace === 'agent') {
      const currentResumeId = getCurrentResumeId()
      if (currentResumeId) {
        navigate(`/workspace/agent/${currentResumeId}`)
      } else {
        navigate('/workspace/agent/new')
      }
    } else if (workspace === 'dashboard') {
      navigate('/dashboard')
    } else if (workspace === 'templates') {
      navigate('/templates')
    } else {
      navigate('/workspace')
    }
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#F8F9FA] dark:bg-slate-950">
      {/* 左侧固定边栏 */}
      <aside className="w-[100px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex justify-center">
          <div
            className="cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <span className="text-white font-black text-xs italic">RA</span>
            </div>
          </div>
        </div>

        {/* 工作区切换 */}
        <div className="flex-1 px-1 py-3">
          <nav className="space-y-1 flex flex-col items-center">
            {/* 编辑区 */}
            <button
              onClick={() => handleWorkspaceChange('edit')}
              className={cn(
                "w-full flex flex-col items-center gap-1 px-1 py-2 rounded-lg transition-all duration-200",
                currentWorkspace === 'edit'
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
              title="编辑区"
            >
              <Edit className="w-5 h-5 shrink-0" />
              <span className="text-[10px] leading-tight">编辑</span>
            </button>

            {/* Agent 对话区 */}
            <button
              onClick={() => handleWorkspaceChange('agent')}
              className={cn(
                "w-full flex flex-col items-center gap-1 px-1 py-2 rounded-lg transition-all duration-200",
                currentWorkspace === 'agent'
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
              title="Agent 对话"
            >
              <Bot className="w-5 h-5 shrink-0" />
              <span className="text-[10px] leading-tight">Agent</span>
            </button>

            {/* 简历区 */}
            <button
              onClick={() => handleWorkspaceChange('dashboard')}
              className={cn(
                "w-full flex flex-col items-center gap-1 px-1 py-2 rounded-lg transition-all duration-200",
                currentWorkspace === 'dashboard'
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
              title="我的简历"
            >
              <FileText className="w-5 h-5 shrink-0" />
              <span className="text-[10px] leading-tight">简历</span>
            </button>

            {/* 简历模板区 */}
            <button
              onClick={() => handleWorkspaceChange('templates')}
              className={cn(
                "w-full flex flex-col items-center gap-1 px-1 py-2 rounded-lg transition-all duration-200",
                currentWorkspace === 'templates'
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
              title="简历模板区"
            >
              <LayoutGrid className="w-5 h-5 shrink-0" />
              <span className="text-[10px] leading-tight">模板</span>
            </button>
          </nav>

          {/* 分隔线 */}
          <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

          {/* 其他导航 */}
          <nav className="space-y-1 flex flex-col items-center">
            {/* 保存按钮 - 仅在编辑区显示 */}
            {currentWorkspace === 'edit' && onSave && (
              <button
                onClick={onSave}
                className="w-full flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                title="保存简历"
              >
                <Save className="w-5 h-5 shrink-0" />
                <span className="text-[10px] leading-tight">保存</span>
              </button>
            )}

            {/* 下载按钮 - 仅在编辑区显示 */}
            {currentWorkspace === 'edit' && onDownload && (
            <button
                onClick={onDownload}
                className="w-full flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                title="下载PDF"
            >
                <Download className="w-5 h-5 shrink-0" />
                <span className="text-[10px] leading-tight">下载</span>
            </button>
            )}

            <button
              onClick={() => navigate('/create-new')}
              className="w-full flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              title="新建简历"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[10px] leading-tight">新建</span>
            </button>
          </nav>
        </div>

        {/* 底部：登录组件（仅在 dashboard 页面显示）或版本号 */}
        <div className="px-1 py-2 border-t border-slate-100 dark:border-slate-800">
          {currentWorkspace === 'dashboard' ? (
            <div ref={logoutMenuRef} className="px-2 py-2 relative">
              {isAuthenticated ? (
                <div className="relative">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                    className="flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60 transition-colors">
                      <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex flex-col items-center w-full">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium leading-tight">已登录</span>
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight truncate w-full text-center" title={user?.email}>
                        {user?.email?.split('@')[0] || user?.email}
                      </span>
                    </div>
                  </motion.div>
                  
                  {/* 退出按钮下拉菜单 */}
                  <AnimatePresence>
                    {showLogoutMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full left-0 mb-2 w-full"
                      >
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setShowLogoutMenu(false)
                            logout()
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-all shadow-md"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-medium">退出登录</span>
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openModal('login')}
                  className="w-full flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center group-hover:bg-indigo-600 dark:group-hover:bg-indigo-700 transition-colors">
                    <LogIn className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-[10px] font-bold leading-tight">登录/注册</span>
                </motion.button>
              )}
            </div>
          ) : (
            <div className="text-[9px] text-slate-400 dark:text-slate-600 text-center leading-tight">
              v2.0
            </div>
          )}
        </div>
      </aside>

      {/* 右侧内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentWorkspace}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
