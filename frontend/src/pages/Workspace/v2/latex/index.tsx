/**
 * LaTeX 模板工作区
 * 专门用于 LaTeX 模板的编辑和 PDF 渲染
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '../../../../lib/utils'

// Hooks
import { useResumeData, usePDFOperations, useAIImport } from '../hooks'
import { saveResume, setCurrentResumeId } from '@/services/resumeStorage'

// 组件
import { Header } from '../components'
import EditPreviewLayout from '../EditPreviewLayout'
import AIImportModal from '../shared/AIImportModal'
import WorkspaceLayout from '@/pages/WorkspaceLayout'

type EditMode = 'click' | 'scroll'

export default function LaTeXWorkspace() {
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
    isDataLoaded,
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

  // PDF 操作 - LaTeX 模板核心功能
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
  
  // 防抖保存定时器
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedDataRef = useRef<string>('')
  
  // 防抖渲染定时器
  const renderTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastRenderedDataRef = useRef<string>('')
  const initialRenderTriggeredRef = useRef(false)
  const resumeDataRef = useRef(resumeData)
  resumeDataRef.current = resumeData

  // 自动保存函数（防抖）
  const autoSave = useCallback(() => {
    // 清除之前的定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    
    // 设置新的定时器，500ms 后保存
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const currentDataStr = JSON.stringify(resumeData)
          // 只有当数据真正变化时才保存
          if (currentDataStr !== lastSavedDataRef.current) {
            const saved = await saveResume(resumeData as any, currentResumeId || undefined)
            // 如果保存后获得了新的 ID，更新 currentResumeId
            if (!currentResumeId && saved.id) {
              setCurrentId(saved.id)
              setCurrentResumeId(saved.id)
            }
            lastSavedDataRef.current = currentDataStr
            console.log('自动保存成功', saved.id)
          }
        } catch (error) {
          console.error('自动保存失败:', error)
        }
      })()
    }, 500)
  }, [resumeData, currentResumeId, setCurrentId])

  // 自动渲染函数（防抖）：timeout 内用 ref 取最新 resumeData，避免闭包旧数据
  const autoRender = useCallback(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    renderTimerRef.current = setTimeout(() => {
      const currentDataStr = JSON.stringify(resumeDataRef.current)
      if (currentDataStr !== lastRenderedDataRef.current && !loading) {
        lastRenderedDataRef.current = currentDataStr
        handleRender()
      }
    }, 800)
  }, [loading, handleRender])

  // 监听简历数据变化，自动保存（防抖）
  useEffect(() => {
    if (resumeData) {
      autoSave()
    }
    
    // 清理定时器
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [resumeData, autoSave])

  // 监听简历数据变化，自动渲染（防抖）
  useEffect(() => {
    // 只有数据加载完成后才启用自动渲染
    if (isDataLoaded && resumeData) {
      autoRender()
    }
    
    // 清理定时器
    return () => {
      if (renderTimerRef.current) {
        clearTimeout(renderTimerRef.current)
      }
    }
  }, [resumeData, isDataLoaded, autoRender])

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

  // 🎯 LaTeX 模板特有：数据加载完成后立即渲染 PDF（首次，确保不漏触发）
  useEffect(() => {
    if (!isDataLoaded || loading || pdfBlob || initialRenderTriggeredRef.current) return

    initialRenderTriggeredRef.current = true
    // 首次加载时，初始化 lastRenderedDataRef 并立即渲染
    lastRenderedDataRef.current = JSON.stringify(resumeDataRef.current)
    const timer = setTimeout(() => {
      handleRender()
    }, 100)
    return () => clearTimeout(timer)
  }, [isDataLoaded, loading, pdfBlob, handleRender])

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

    event.target.value = ''
  }

  return (
    <WorkspaceLayout onSave={handleSaveToDashboard} onDownload={pdfBlob ? handleDownload : undefined}>
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
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 max-w-sm">
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
    </WorkspaceLayout>
  )
}

