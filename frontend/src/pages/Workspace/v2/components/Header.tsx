/**
 * 顶部导航栏组件（仅包含右侧操作按钮）
 */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, BookmarkPlus, Upload, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { ExportButton } from './ExportButton'
import { SaveStatusIndicator } from './SaveStatusIndicator'
import type { AutoSaveStatus } from '../hooks/useAutoSaveResume'

interface HeaderProps {
  saveSuccess: boolean
  saveStatus?: AutoSaveStatus
  saveError?: string | null
  onGlobalAIImport: () => void
  onSaveToDashboard: () => void
  onExportJSON?: () => void
  onImportJSON?: () => void
  resumeData?: Record<string, any>
  resumeName?: string
  pdfBlob?: Blob | null
  onDownloadPDF?: () => void | Promise<void>
}

export function Header({ saveSuccess, saveStatus, saveError, onGlobalAIImport, onSaveToDashboard, onExportJSON, onImportJSON, resumeData, resumeName, pdfBlob, onDownloadPDF }: HeaderProps) {
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const importMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setImportMenuOpen(false)
      }
    }
    if (importMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [importMenuOpen])

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'relative z-20 h-16 flex items-center justify-between px-4 shrink-0',
        'bg-white dark:bg-[#1C1C1C]',
        'border-b border-black dark:border-white'
      )}
    >
      {/* 左侧留白（原编辑模式切换已移除，点击编辑为唯一模式） */}
      <div />

      {/* 右侧：Action Buttons */}
      <motion.div 
        className="flex items-center gap-3"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        {/* 自动保存常驻状态 */}
        {saveStatus !== undefined && <SaveStatusIndicator status={saveStatus} error={saveError} />}

        {/* 统一导入下拉：AI 导入 / JSON 导入 */}
        {(onGlobalAIImport || onImportJSON) && (
          <div className="relative" ref={importMenuRef}>
            <button
              onClick={() => setImportMenuOpen((v) => !v)}
              className={cn(
                "px-5 py-2.5 rounded-none text-sm font-bold transition-all duration-300 flex items-center gap-2",
                "bg-white dark:bg-[#1C1C1C] border border-black dark:border-white",
                "text-slate-700 dark:text-slate-300 hover:bg-[#F1F2F5] hover:border-black dark:hover:bg-slate-700",
                "active:scale-95 shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff]"
              )}
            >
              <Upload className="w-4 h-4 text-blue-500" />
              导入
            </button>

            {importMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-[#2A2A2A] rounded-none shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#ffffff] border border-slate-200/80 dark:border-slate-700/80 overflow-hidden z-50">
                <button
                  onClick={() => {
                    setImportMenuOpen(false)
                    onGlobalAIImport()
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-[#F1F2F5] dark:hover:bg-slate-700/50 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-slate-900 dark:text-slate-100" />
                  AI 智能上传
                </button>
                {onImportJSON && (
                  <button
                    onClick={() => {
                      setImportMenuOpen(false)
                      onImportJSON()
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-[#F1F2F5] dark:hover:bg-slate-700/50 flex items-center gap-2 border-t border-black dark:border-slate-700/50"
                  >
                    <Upload className="w-4 h-4 text-blue-500" />
                    JSON 导入
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* 保存按钮 */}
              <button
                onClick={onSaveToDashboard}
                disabled={saveSuccess}
                className={cn(
                  'inline-flex items-center justify-center gap-2',
                  'whitespace-nowrap text-sm font-medium font-mono uppercase tracking-wide',
                  'transition-[transform,box-shadow,background-color] duration-100 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2',
                  'disabled:opacity-50',
                  'rounded-none h-9 px-5',
                  'border border-black dark:border-white',
                  'shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff]',
                  saveSuccess
                    ? 'bg-green-700 text-white hover:bg-green-800 hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none dark:bg-green-700 dark:text-white dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff]'
                    : 'bg-[#F0F0E8] text-black dark:bg-[#2A2A2A] dark:text-white dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff] hover:bg-[#E5E5E0] dark:hover:bg-[#3A3A3A] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none'
                )}
              >
          {saveSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <BookmarkPlus className="w-4 h-4" />
          )}
          {saveSuccess ? '已保存' : '保存'}
        </button>
        
        {/* 导出按钮（PDF/JSON） */}
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
