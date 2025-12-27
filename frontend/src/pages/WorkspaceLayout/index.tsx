/**
 * 工作区布局容器
 * 左侧固定边栏（工作区切换），右侧动态内容区
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Edit, Sparkles, LayoutGrid, FileText, Save, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

// 工作区类型
type WorkspaceType = 'edit' | 'conversation' | 'dashboard' | 'templates'

interface WorkspaceLayoutProps {
  children: React.ReactNode
  onSave?: () => void
  onDownload?: () => void
}

export default function WorkspaceLayout({ children, onSave, onDownload }: WorkspaceLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // 根据路径确定当前工作区
  const getCurrentWorkspace = (): WorkspaceType => {
    if (location.pathname === '/conversation') {
      return 'conversation'
    }
    if (location.pathname === '/dashboard') {
      return 'dashboard'
    }
    if (location.pathname === '/templates') {
      return 'templates'
    }
    return 'edit'
  }

  const currentWorkspace = getCurrentWorkspace()

  const handleWorkspaceChange = (workspace: WorkspaceType) => {
    if (workspace === 'conversation') {
      navigate('/conversation')
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

            {/* AI 对话区 */}
            <button
              onClick={() => handleWorkspaceChange('conversation')}
              className={cn(
                "w-full flex flex-col items-center gap-1 px-1 py-2 rounded-lg transition-all duration-200",
                currentWorkspace === 'conversation'
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
              title="AI对话区"
            >
              <Sparkles className="w-5 h-5 shrink-0" />
              <span className="text-[10px] leading-tight">对话</span>
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

        {/* 底部 */}
        <div className="px-1 py-2 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[9px] text-slate-400 dark:text-slate-600 text-center leading-tight">
            v2.0
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
