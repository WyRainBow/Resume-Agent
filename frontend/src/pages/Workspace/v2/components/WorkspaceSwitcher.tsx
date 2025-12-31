/**
 * 工作区切换器
 * 在编辑区和 AI 对话生成区之间切换
 */
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Edit, Sparkles } from 'lucide-react'
import { cn } from '../../../../lib/utils'

type WorkspaceMode = 'edit' | 'conversation'

interface WorkspaceSwitcherProps {
  currentMode?: WorkspaceMode
}

export function WorkspaceSwitcher({ currentMode = 'edit' }: WorkspaceSwitcherProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // 根据当前路径确定模式
  const getMode = (): WorkspaceMode => {
    if (location.pathname === '/resume-chat' || location.pathname.startsWith('/resume-chat')) {
      return 'conversation'
    }
    return 'edit'
  }

  const mode = getMode()

  const handleModeChange = (newMode: WorkspaceMode) => {
    if (newMode === 'conversation') {
      navigate('/resume-chat')
    } else {
      navigate('/workspace')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2"
    >
      {/* 切换按钮组 */}
      <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200/80 dark:border-slate-700/80">
        {/* 编辑区按钮 */}
        <button
          onClick={() => handleModeChange('edit')}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300",
            mode === 'edit'
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <Edit className="w-4 h-4" />
          编辑区
        </button>

        {/* AI 对话区按钮 */}
        <button
          onClick={() => handleModeChange('conversation')}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300",
            mode === 'conversation'
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <Sparkles className="w-4 h-4" />
          AI 对话区
        </button>
      </div>
    </motion.div>
  )
}
