/**
 * Workspace v2 - 编辑区主入口
 * 使用 WorkspaceLayout 包裹，提供统一的侧边栏布局
 */
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, User, LogOut } from 'lucide-react'

// Hooks
import { useAIImport, usePDFOperations, useResumeData } from './hooks'
import { useAuth } from '@/contexts/AuthContext'

// 组件
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { Header } from './components'
import EditPreviewLayout from './EditPreviewLayout'
import AIImportModal from './shared/AIImportModal'

type EditMode = 'click' | 'scroll'

export default function WorkspaceV2() {
  // 认证状态
  const { isAuthenticated, user, logout, openModal } = useAuth()
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const logoutMenuRef = useRef<HTMLDivElement>(null)
  
  // 编辑模式状态
  const [editMode, setEditMode] = useState<EditMode>('click')
  
  // 跟踪编辑状态和保存状态
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [initialResumeData, setInitialResumeData] = useState<any>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  // 简历数据管理
  const {
    resumeData,
    setResumeData,
    activeSection,
    setActiveSection,
    currentResumeId,
    setCurrentId,
    updateBasicInfo,
    updateProject,
    deleteProject,
    reorderProjects,
    updateExperience,
    deleteExperience,
    reorderExperiences,
    updateEducation,
    deleteEducation,
    reorderEducations,
    updateOpenSource,
    deleteOpenSource,
    reorderOpenSources,
    updateAward,
    deleteAward,
    reorderAwards,
    updateSkillContent,
    updateMenuSections,
    reorderSections,
    toggleSectionVisibility,
    updateGlobalSettings,
    addCustomSection,
  } = useResumeData()

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

  // PDF 操作
  const {
    pdfBlob,
    loading,
    progress,
    saveSuccess,
    handleRender,
    handleDownload,
    handleSaveToDashboard,
  } = usePDFOperations({ resumeData, currentResumeId, setCurrentId })

  // AI 导入
  const {
    aiModalOpen,
    aiModalSection,
    aiModalTitle,
    setAiModalOpen,
    handleAIImport,
    handleGlobalAIImport,
    handleAISave,
  } = useAIImport({ setResumeData })


  // 文件输入引用（用于导入 JSON）
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 监听编辑状态：页面加载时保存初始状态
  useEffect(() => {
    if (!initialResumeData) {
      setInitialResumeData(JSON.stringify(resumeData))
    }
  }, [])

  // 监听简历数据变化，判断是否有未保存的修改
  useEffect(() => {
    if (initialResumeData && saveSuccess === false) {
      const currentData = JSON.stringify(resumeData)
      setHasUnsavedChanges(currentData !== initialResumeData)
    }
  }, [resumeData, initialResumeData, saveSuccess])

  // 保存成功时，更新初始状态
  useEffect(() => {
    if (saveSuccess) {
      setInitialResumeData(JSON.stringify(resumeData))
      setHasUnsavedChanges(false)
    }
  }, [saveSuccess, resumeData])

  // 页面卸载时提醒用户保存
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = '记得保存简历的修改'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // 页面加载时自动渲染 PDF（仅对 LaTeX 模板）
  useEffect(() => {
    // 延迟100ms，确保页面完全渲染
    const timer = setTimeout(() => {
      // 只有 LaTeX 模板时才自动渲染 PDF
      if (!loading && !pdfBlob && resumeData.templateType !== 'html') {
        handleRender()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // 导出 JSON
  const handleExportJSON = () => {
    try {
      const jsonString = JSON.stringify(resumeData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `resume-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('导出 JSON 失败:', error)
      alert('导出失败，请重试')
    }
  }

  // 导入 JSON
  const handleImportJSON = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const importedData = JSON.parse(text)

        // 验证数据格式（基本检查）
        if (typeof importedData === 'object' && importedData !== null) {
          setResumeData(importedData)
          alert('导入成功！')
        } else {
          throw new Error('无效的 JSON 格式')
        }
      } catch (error) {
        console.error('导入 JSON 失败:', error)
        alert('导入失败：文件格式不正确，请确保是有效的 JSON 文件')
      }
    }
    reader.onerror = () => {
      alert('读取文件失败，请重试')
    }
    reader.readAsText(file)

    // 清空 input，以便可以重复选择同一文件
    event.target.value = ''
  }

  return (
    <WorkspaceLayout>
      {/* 顶部导航栏 */}
      <Header
        saveSuccess={saveSuccess}
        onGlobalAIImport={handleGlobalAIImport}
        onSaveToDashboard={handleSaveToDashboard}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        resumeData={resumeData}
        resumeName={resumeData?.basic?.name || '我的简历'}
        pdfBlob={pdfBlob}
        onDownloadPDF={handleDownload}
        editMode={editMode}
        onEditModeChange={setEditMode}
      />

      {/* 编辑 + 预览三列布局 */}
      <EditPreviewLayout
        resumeData={resumeData}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        toggleSectionVisibility={toggleSectionVisibility}
        updateMenuSections={updateMenuSections}
        reorderSections={reorderSections}
        updateGlobalSettings={updateGlobalSettings}
        addCustomSection={addCustomSection}
        updateBasicInfo={updateBasicInfo}
        updateProject={updateProject}
        deleteProject={deleteProject}
        reorderProjects={reorderProjects}
        updateExperience={updateExperience}
        deleteExperience={deleteExperience}
        reorderExperiences={reorderExperiences}
        updateEducation={updateEducation}
        deleteEducation={deleteEducation}
        reorderEducations={reorderEducations}
        updateOpenSource={updateOpenSource}
        deleteOpenSource={deleteOpenSource}
        reorderOpenSources={reorderOpenSources}
        updateAward={updateAward}
        deleteAward={deleteAward}
        reorderAwards={reorderAwards}
        updateSkillContent={updateSkillContent}
        handleAIImport={handleAIImport}
        pdfBlob={pdfBlob}
        loading={loading}
        progress={progress}
        handleRender={handleRender}
        handleDownload={handleDownload}
        editMode={editMode}
      />

      {/* 隐藏的文件输入（用于导入 JSON） */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* AI 导入弹窗 */}
      <AIImportModal
        isOpen={aiModalOpen}
        sectionType={aiModalSection}
        sectionTitle={aiModalTitle}
        onClose={() => setAiModalOpen(false)}
        onSave={handleAISave}
      />

      {/* 未保存提醒对话框 */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              未保存的更改
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              记得保存简历！您的更改可能会丢失。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUnsavedDialog(false)
                  if (pendingNavigation) {
                    pendingNavigation()
                    setPendingNavigation(null)
                  }
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
              >
                继续离开
              </button>
              <button
                onClick={() => setShowUnsavedDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
              >
                留下保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 左下角登录按钮 */}
      <motion.div
        ref={logoutMenuRef}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-6 left-6 z-50"
      >
        {isAuthenticated ? (
          <div className="relative">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl shadow-lg border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group"
              onClick={() => setShowLogoutMenu(!showLogoutMenu)}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                <User className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 font-medium">已登录</span>
                <span className="text-sm font-bold text-slate-900">{user?.email}</span>
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white rounded-xl shadow-lg border border-red-200 hover:border-red-300 hover:bg-red-50 transition-all"
                  >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-bold text-red-600">退出登录</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              openModal('login')
            }}
            className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl shadow-lg border border-slate-200 hover:border-indigo-300 transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
              <LogIn className="w-4 h-4 text-indigo-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-bold text-slate-900">登录/注册</span>
          </motion.button>
        )}
      </motion.div>
    </WorkspaceLayout>
  )
}

