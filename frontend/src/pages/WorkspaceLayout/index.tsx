/**
 * 工作区布局容器
 * 左侧固定边栏（工作区切换），右侧动态内容区
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Edit, LayoutGrid, FileText, Save, Download, LogIn, User, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { getCurrentResumeId } from '@/services/resumeStorage'

// 工作区类型
type WorkspaceType = 'edit' | 'agent' | 'dashboard' | 'templates'

/** 复刻参考图：圆角矩形 + 内竖线（左窄右宽），细描边 */
function SidebarToggleIcon({ expand = false, className }: { expand?: boolean; className?: string }) {
  const lineX = expand ? 17 : 7 // 展开态：线偏右；收起态：线偏左
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="4" width="20" height="16" rx="3" ry="3" />
      <line x1={lineX} y1="6" x2={lineX} y2="18" />
    </svg>
  )
}

/** Agent 按钮图标：对话气泡轮廓 + 气泡内三点（参考图样式） */
function AgentIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* 气泡轮廓：圆角矩形 */}
      <rect x="3" y="3" width="18" height="14" rx="2.5" />
      {/* 气泡内三点（省略号） */}
      <circle cx="8.5" cy="10" r="1.2" fill="currentColor" />
      <circle cx="12" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.2" fill="currentColor" />
    </svg>
  )
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('workspace-sidebar-collapsed') === '1'
    } catch {
      return false
    }
  })

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('workspace-sidebar-collapsed', next ? '1' : '0')
      } catch {}
      return next
    })
  }

  // 根据路径确定当前工作区
  const getCurrentWorkspace = (): WorkspaceType => {
    // 检测是否是简历创建页面（保留 resume-creator）
    if (
      location.pathname === '/resume-creator' || 
      location.pathname.startsWith('/workspace/agent') ||
      location.pathname.startsWith('/agent')
    ) {
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
        navigate(`/agent/${currentResumeId}`)
      } else {
        navigate('/agent/new')
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
      {/* 左侧固定边栏：aside 始终 150px 占位，内部 div 实际收缩，确保 main 宽度不变 */}
      <aside className="w-[150px] shrink-0 flex">
        <div
          className={cn(
            'h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 overflow-hidden transition-[width] duration-200',
            sidebarCollapsed ? 'w-24' : 'w-[150px]'
          )}
        >
        {/* Logo + 收缩按钮：始终同一行，RA 左、按钮右 */}
        <div className="border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 p-2 gap-1">
          <div
            className="cursor-pointer group shrink-0"
            onClick={() => navigate('/')}
          >
            {/* 收缩时只收窄侧栏宽度，Logo 尺寸保持不变 */}
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <span className="text-white font-black text-xs italic">RA</span>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              'rounded-lg transition-colors shrink-0',
              'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300',
              'p-1.5'
            )}
            title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {/* 收缩/展开图标尺寸一致，仅方向不同 */}
            {sidebarCollapsed ? (
              <SidebarToggleIcon expand className="w-5 h-5" />
            ) : (
              <SidebarToggleIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* 工作区切换：收缩时仅隐藏文字，图标与 padding 不变 */}
        <div className="flex-1 py-3 px-2">
          <nav className={cn('space-y-0.5 flex flex-col', sidebarCollapsed ? 'items-center' : '')}>
            {/* 编辑区 */}
            <button
              onClick={() => handleWorkspaceChange('edit')}
              className={cn(
                'w-full rounded-lg transition-all duration-200',
                sidebarCollapsed ? 'flex flex-col items-center justify-center gap-1 py-2.5' : 'flex items-center gap-2.5 py-2.5 px-2.5',
                currentWorkspace === 'edit'
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
              title="编辑区"
            >
              <Edit className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="text-sm font-medium">编辑</span>}
            </button>

            {/* AI 对话区 */}
            <button
              onClick={() => handleWorkspaceChange('agent')}
              className={cn(
                'w-full rounded-lg transition-all duration-200',
                sidebarCollapsed ? 'flex flex-col items-center justify-center gap-1 py-2.5' : 'flex items-center gap-2.5 py-2.5 px-2.5',
                currentWorkspace === 'agent'
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
              title="AI 对话"
            >
              <AgentIcon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="text-sm font-medium">AI</span>}
            </button>

            {/* 简历区 */}
            <button
              onClick={() => handleWorkspaceChange('dashboard')}
              className={cn(
                'w-full rounded-lg transition-all duration-200',
                sidebarCollapsed ? 'flex flex-col items-center justify-center gap-1 py-2.5' : 'flex items-center gap-2.5 py-2.5 px-2.5',
                currentWorkspace === 'dashboard'
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
              title="我的简历"
            >
              <FileText className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="text-sm font-medium">简历</span>}
            </button>

            {/* 简历模板区 */}
            <button
              onClick={() => handleWorkspaceChange('templates')}
              className={cn(
                'w-full rounded-lg transition-all duration-200',
                sidebarCollapsed ? 'flex flex-col items-center justify-center gap-1 py-2.5' : 'flex items-center gap-2.5 py-2.5 px-2.5',
                currentWorkspace === 'templates'
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
              title="简历模板区"
            >
              <LayoutGrid className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="text-sm font-medium">模板</span>}
            </button>
          </nav>

          {/* 分隔线 */}
          <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

          {/* 其他导航 */}
          <nav className={cn('space-y-0.5 flex flex-col', sidebarCollapsed ? 'items-center' : '')}>
            {/* 保存按钮 - 仅在编辑区显示 */}
            {currentWorkspace === 'edit' && onSave && (
              <button
                onClick={onSave}
                className={cn(
                  'w-full rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all',
                  sidebarCollapsed ? 'flex flex-col items-center justify-center gap-1 py-2.5' : 'flex items-center gap-2.5 py-2.5 px-2.5'
                )}
                title="保存简历"
              >
                <Save className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="text-sm font-medium">保存</span>}
              </button>
            )}

            {/* 下载按钮 - 仅在编辑区显示 */}
            {currentWorkspace === 'edit' && onDownload && (
              <button
                onClick={onDownload}
                className={cn(
                  'w-full rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all',
                  sidebarCollapsed ? 'flex flex-col items-center justify-center gap-1 py-2.5' : 'flex items-center gap-2.5 py-2.5 px-2.5'
                )}
                title="下载PDF"
              >
                <Download className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="text-sm font-medium">下载</span>}
              </button>
            )}

            <button
              onClick={() => navigate('/create-new')}
              className={cn(
                'w-full rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all',
                sidebarCollapsed ? 'flex flex-col items-center justify-center gap-1 py-2.5' : 'flex items-center gap-2.5 py-2.5 px-2.5'
              )}
              title="新建简历"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {!sidebarCollapsed && <span className="text-sm font-medium">新建</span>}
            </button>
          </nav>
        </div>

        {/* 底部：登录组件（与导航风格统一，图标+用户名一行） */}
        <div className="py-2 px-2 border-t border-slate-100 dark:border-slate-800">
          <div ref={logoutMenuRef} className="relative">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                  className={cn(
                    'w-full rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                    sidebarCollapsed ? 'flex flex-col items-center justify-center gap-1 py-2.5' : 'flex items-center gap-2.5 py-2.5 px-2.5'
                  )}
                  title={user?.username || user?.email}
                >
                  <User className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="text-sm font-medium truncate text-left">
                      {user?.username || user?.email}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {showLogoutMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full left-0 right-0 mb-1"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowLogoutMenu(false)
                          logout()
                        }}
                        className={cn(
                          'w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg',
                          'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
                          'text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/20 text-[10px] font-medium transition-colors'
                        )}
                      >
                        <LogOut className="w-3.5 h-3.5 shrink-0" />
                        退出登录
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openModal('login')}
                className={cn(
                  'w-full rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                  sidebarCollapsed ? 'flex flex-col items-center justify-center gap-1 py-2.5' : 'flex items-center gap-2.5 py-2.5 px-2.5'
                )}
                title="登录 / 注册"
              >
                <LogIn className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="text-sm font-medium">登录</span>}
              </button>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="text-xs text-slate-400 dark:text-slate-500 text-center leading-tight mt-1.5 px-1">
              v2.0
            </div>
          )}
        </div>
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
