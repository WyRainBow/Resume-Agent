/**
 * 顶部导航栏组件（仅包含右侧操作按钮）
 */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, ChevronRight, Sparkles, Palette } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { getSkinOrDefault, setStoredSkin, SKIN_EVENT, type WorkspaceSkin } from '@/lib/skin'
import { ExportButton } from './ExportButton'
import { SaveStatusIndicator } from './SaveStatusIndicator'
import type { AutoSaveStatus } from '../hooks/useAutoSaveResume'

interface HeaderProps {
  saveStatus?: AutoSaveStatus
  saveError?: string | null
  onGlobalAIImport: () => void
  onExportJSON?: () => void
  onImportJSON?: () => void
  resumeData?: Record<string, any>
  resumeName?: string
  pdfBlob?: Blob | null
  onDownloadPDF?: () => void | Promise<void>
}

export function Header({ saveStatus, saveError, onGlobalAIImport, onExportJSON, onImportJSON, resumeData, resumeName, pdfBlob, onDownloadPDF }: HeaderProps) {
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const importMenuRef = useRef<HTMLDivElement>(null)
  const [skin, setSkin] = useState<WorkspaceSkin>(getSkinOrDefault)

  useEffect(() => {
    const onSkinChange = () => setSkin(getSkinOrDefault())
    window.addEventListener(SKIN_EVENT, onSkinChange)
    return () => window.removeEventListener(SKIN_EVENT, onSkinChange)
  }, [])

  const toggleSkin = () => setStoredSkin(skin === 'neo' ? 'fresh' : 'neo')

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
        'border-b border-black fresh:border-slate-200 dark:border-white'
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

        {/* 皮肤切换:Neo(新野兽派) ↔ 清新 */}
        <button
          onClick={toggleSkin}
          title={skin === 'neo' ? '当前:Neo 风格,点击换清新风格' : '当前:清新风格,点击换 Neo 风格'}
          aria-label="切换皮肤"
          className={cn(
            'px-3 py-2.5 rounded-none fresh:rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-2',
            'bg-white dark:bg-[#1C1C1C] border border-black fresh:border-slate-200 dark:border-white',
            'text-slate-700 dark:text-slate-300 hover:bg-[#F1F2F5] fresh:hover:bg-slate-50 dark:hover:bg-slate-700',
            'active:scale-95 shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm dark:shadow-[2px_2px_0px_0px_#ffffff]'
          )}
        >
          <Palette className="w-4 h-4 text-blue-500" />
          {skin === 'neo' ? 'NEO' : '清新'}
        </button>

        {/* 统一导入下拉：AI 导入 / JSON 导入 */}
        {(onGlobalAIImport || onImportJSON) && (
          <div className="relative" ref={importMenuRef}>
            <button
              onClick={() => setImportMenuOpen((v) => !v)}
              className={cn(
                "px-5 py-2.5 rounded-none fresh:rounded-md text-sm font-bold transition-all duration-300 flex items-center gap-2",
                "bg-white dark:bg-[#1C1C1C] border border-black fresh:border-slate-200 dark:border-white",
                "text-slate-700 dark:text-slate-300 hover:bg-[#F1F2F5] hover:border-black fresh:hover:border-slate-300 dark:hover:bg-slate-700",
                "active:scale-95 shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm dark:shadow-[2px_2px_0px_0px_#ffffff]"
              )}
            >
              <Upload className="w-4 h-4 text-blue-500" />
              导入
            </button>

            {importMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-[#2A2A2A] rounded-none fresh:rounded-md shadow-[4px_4px_0px_0px_#000000] fresh:shadow-md dark:shadow-[4px_4px_0px_0px_#ffffff] border border-slate-200/80 dark:border-slate-700/80 overflow-hidden z-50">
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
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-[#F1F2F5] dark:hover:bg-slate-700/50 flex items-center gap-2 border-t border-black fresh:border-slate-200 dark:border-slate-700/50"
                  >
                    <Upload className="w-4 h-4 text-blue-500" />
                    JSON 导入
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* 手动保存按钮已移除：自动保存(useAutoSaveResume)与其调用同一 saveResume，
            双指示造成"两个已保存"歧义；保存状态统一由左侧 SaveStatusIndicator 呈现 */}

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
