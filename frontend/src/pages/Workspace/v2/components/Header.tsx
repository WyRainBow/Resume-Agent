/**
 * 顶部导航栏组件（仅包含右侧操作按钮）
 */
import { motion } from 'framer-motion'
import { Check, BookmarkPlus, Upload, LayoutGrid, List, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { ExportButton } from './ExportButton'
import EnvironmentSwitcher from '@/components/EnvironmentSwitcher'

type EditMode = 'click' | 'scroll'

interface HeaderProps {
  saveSuccess: boolean
  onGlobalAIImport: () => void
  onSaveToDashboard: () => void
  onExportJSON?: () => void
  onImportJSON?: () => void
  resumeData?: Record<string, any>
  resumeName?: string
  pdfBlob?: Blob | null
  onDownloadPDF?: () => void
  editMode?: EditMode
  onEditModeChange?: (mode: EditMode) => void
}

export function Header({ saveSuccess, onGlobalAIImport, onSaveToDashboard, onExportJSON, onImportJSON, resumeData, resumeName, pdfBlob, onDownloadPDF, editMode, onEditModeChange }: HeaderProps) {
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
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-1 border border-slate-200/60">
            <button
              onClick={() => onEditModeChange('click')}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                "flex items-center gap-2",
                editMode === 'click'
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
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
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
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
        <EnvironmentSwitcher />

        {/* AI 全局导入按钮 */}
        <button
          onClick={onGlobalAIImport}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2",
            "bg-white border border-slate-200/60",
            "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800",
            "shadow-sm hover:shadow-md",
            "hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          <Sparkles className="w-4 h-4 text-slate-900" />
          AI 智能导入
        </button>
        
        {/* 保存按钮 */}
        <button
          onClick={onSaveToDashboard}
          disabled={saveSuccess}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2",
            "hover:scale-[1.02] active:scale-[0.98]",
            saveSuccess 
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" 
              : "bg-slate-900 text-white shadow-lg shadow-slate-200 hover:bg-slate-800"
          )}
        >
          {saveSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <BookmarkPlus className="w-4 h-4" />
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
      </motion.div>
    </motion.header>
  )
}
