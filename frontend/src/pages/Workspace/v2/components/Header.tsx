/**
 * 顶部导航栏组件
 */
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Check, Sparkles, FileText, BookmarkPlus, LayoutGrid, Settings } from 'lucide-react'
import { cn } from '../../../../lib/utils'

interface HeaderProps {
  saveSuccess: boolean
  onGlobalAIImport: () => void
  onSaveToDashboard: () => void
  onAPISettings?: () => void
}

export function Header({ saveSuccess, onGlobalAIImport, onSaveToDashboard, onAPISettings }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'relative z-20 h-16 flex items-center justify-between px-6',
        'bg-white/70 dark:bg-slate-900/70',
        'backdrop-blur-xl backdrop-saturate-150',
        'border-b border-white/50 dark:border-slate-700/50',
        'shadow-[0_4px_30px_rgba(0,0,0,0.05)]'
      )}
    >
      {/* Logo & Title - 点击跳转主页 */}
      <motion.div 
        className="flex items-center gap-3 cursor-pointer group"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        onClick={() => navigate('/')}
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:shadow-xl group-hover:shadow-purple-500/35 transition-shadow">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">✓</span>
          </div>
        </div>
        <div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-slate-800 via-indigo-700 to-purple-700 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent tracking-tight group-hover:from-indigo-600 group-hover:via-purple-600 group-hover:to-pink-600 transition-all">
            简历工作台
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5 tracking-wide">
            专业 LaTeX 渲染
          </p>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div 
        className="flex items-center gap-3"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        {/* AI 全局导入按钮 */}
        <button
          onClick={onGlobalAIImport}
          className={cn(
            "group relative px-5 py-2.5 rounded-xl overflow-hidden",
            "bg-gradient-to-r from-rose-400 via-fuchsia-400 to-indigo-400",
            "hover:from-rose-300 hover:via-fuchsia-300 hover:to-indigo-300",
            "text-white text-sm font-semibold",
            "shadow-lg shadow-fuchsia-300/40 hover:shadow-xl hover:shadow-fuchsia-300/50",
            "transition-all duration-300 ease-out",
            "hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <span className="relative flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI 智能导入
          </span>
        </button>
        
        {/* 保存按钮 */}
        <button
          onClick={onSaveToDashboard}
          disabled={saveSuccess}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2",
            "hover:scale-[1.02] active:scale-[0.98]",
            saveSuccess 
              ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-green-500/30" 
              : "bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm hover:shadow-md"
          )}
        >
          {saveSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <BookmarkPlus className="w-4 h-4 text-indigo-500" />
          )}
          {saveSuccess ? '已保存' : '保存'}
        </button>
        
        {/* 我的简历按钮 */}
        <button
          onClick={() => navigate('/dashboard')}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2",
            "bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm",
            "border border-slate-200/80 dark:border-slate-700/80",
            "text-slate-700 dark:text-slate-200",
            "hover:bg-white dark:hover:bg-slate-800",
            "hover:border-slate-300 dark:hover:border-slate-600",
            "shadow-sm hover:shadow-md",
            "hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          <LayoutGrid className="w-4 h-4 text-purple-500" />
          我的简历
        </button>
        
        {/* API设置按钮 */}
        <button
          onClick={onAPISettings}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2",
            "bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm",
            "border border-slate-200/80 dark:border-slate-700/80",
            "text-slate-700 dark:text-slate-200",
            "hover:bg-white dark:hover:bg-slate-800",
            "hover:border-slate-300 dark:hover:border-slate-600",
            "shadow-sm hover:shadow-md",
            "hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          <Settings className="w-4 h-4 text-blue-500" />
          API设置
        </button>
      </motion.div>
    </motion.header>
  )
}

