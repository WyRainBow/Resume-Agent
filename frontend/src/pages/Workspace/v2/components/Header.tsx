/**
 * 顶部导航栏组件
 */
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Check, Sparkles, FileText, BookmarkPlus, LayoutGrid, Settings, Download, Upload } from 'lucide-react'
import { cn } from '../../../../lib/utils'

interface HeaderProps {
  saveSuccess: boolean
  onGlobalAIImport: () => void
  onSaveToDashboard: () => void
  onAPISettings?: () => void
  onExportJSON?: () => void
  onImportJSON?: () => void
}

export function Header({ saveSuccess, onGlobalAIImport, onSaveToDashboard, onAPISettings, onExportJSON, onImportJSON }: HeaderProps) {
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
      <motion.div 
        className="flex items-center gap-3 cursor-pointer group"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        onClick={() => navigate('/')}
      >
        <div className="relative">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:rotate-12 transition-all duration-300">
            <span className="text-white font-black text-sm italic tracking-tighter">RA</span>
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-black tracking-tighter text-slate-900 dark:text-white leading-tight">
            Resume Agent
          </h1>
          <span className="text-[9px] text-indigo-500 dark:text-indigo-400 font-bold tracking-[0.15em] uppercase">
            Workspace
          </span>
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
        
        {/* 导入 JSON 按钮 */}
        {onImportJSON && (
          <button
            onClick={onImportJSON}
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
            <Upload className="w-4 h-4 text-blue-500" />
            导入 JSON
          </button>
        )}
        
        {/* 导出 JSON 按钮 */}
        {onExportJSON && (
          <button
            onClick={onExportJSON}
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
            <Download className="w-4 h-4 text-green-500" />
            导出 JSON
          </button>
        )}
        
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

