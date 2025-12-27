/**
 * 顶部导航栏组件（仅包含右侧操作按钮）
 */
import { motion } from 'framer-motion'
import { Check, Sparkles, BookmarkPlus, Settings, Upload, LayoutGrid, List } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { ExportButton } from './ExportButton'

type EditMode = 'click' | 'scroll'

interface HeaderProps {
  saveSuccess: boolean
  onGlobalAIImport: () => void
  onSaveToDashboard: () => void
  onAPISettings?: () => void
  onExportJSON?: () => void
  onImportJSON?: () => void
  resumeData?: Record<string, any>
  resumeName?: string
  pdfBlob?: Blob | null
  onDownloadPDF?: () => void
  editMode?: EditMode
  onEditModeChange?: (mode: EditMode) => void
}

export function Header({ saveSuccess, onGlobalAIImport, onSaveToDashboard, onAPISettings, onExportJSON, onImportJSON, resumeData, resumeName, pdfBlob, onDownloadPDF, editMode, onEditModeChange }: HeaderProps) {
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'relative z-20 h-16 flex items-center justify-between px-4 shrink-0',
        'bg-white dark:bg-slate-900',
        'border-b border-slate-200 dark:border-slate-800'
      )}
    >
      {/* 左侧：编辑模式切换 */}
      {editMode !== undefined && onEditModeChange && (
      <motion.div 
          className="flex items-center gap-2"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
          <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">编辑模式：</span>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => onEditModeChange('click')}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                "flex items-center gap-2",
                editMode === 'click'
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <List className="w-4 h-4" />
              点击编辑
            </button>
            <button
              onClick={() => onEditModeChange('scroll')}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                "flex items-center gap-2",
                editMode === 'scroll'
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              滚动编辑
            </button>
        </div>
      </motion.div>
      )}

      {/* 右侧：Action Buttons */}
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
        
        {/* 导出按钮（PDF/JSON/分享链接） */}
        {resumeData && (
          <ExportButton
            resumeData={resumeData}
            resumeName={resumeName}
            onExportJSON={onExportJSON}
            pdfBlob={pdfBlob}
            onDownloadPDF={onDownloadPDF}
          />
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

