/**
 * Workspace v2 - 编辑区主入口
 * 使用 WorkspaceLayout 包裹，提供统一的侧边栏布局
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Hooks
import { useAIImport, usePDFOperations, useResumeData } from './hooks'

// 组件
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { Header } from './components'
import EditPreviewLayout from './EditPreviewLayout'
import AIImportModal from './shared/AIImportModal'
import JdOptimizeDialog from './shared/JdOptimizeDialog'
import AiCopilotDock from './shared/AiCopilotDock'
import { ScoreCard } from '@/components/ScoreCard'
import { scoreResume, type JdOptimizeField } from '@/services/api'
import { stripHtmlTags } from './utils/textUtils'

type EditMode = 'click' | 'scroll' | 'json'
const PDF_RENDER_DEBOUNCE_MS = 2000

export default function WorkspaceV2() {
  // 编辑模式状态
  const [editMode, setEditMode] = useState<EditMode>('click')
  
  // 跟踪编辑状态和保存状态
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [initialResumeData, setInitialResumeData] = useState<any>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  const [isAutoRenderPending, setIsAutoRenderPending] = useState(false)
  // 评分状态
  const [jdText, setJdText] = useState('')
  const [scoreData, setScoreData] = useState<any>(null)
  const [showJdOptimize, setShowJdOptimize] = useState(false)
  const jdTextareaRef = useRef<HTMLTextAreaElement>(null)
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
    addCustomItem,
    updateCustomItem,
    deleteCustomItem,
    updateSelfEvaluation,
    updateSkillContent,
    applyTextReplacement,
    updateMenuSections,
    reorderSections,
    toggleSectionVisibility,
    updateGlobalSettings,
    addCustomSection,
  } = useResumeData()

  // 构建 JD 优化的可改写字段列表（自我评价 / 技能 / 各实习·项目·开源的正文）
  const jdFields = useMemo<JdOptimizeField[]>(() => {
    const fields: JdOptimizeField[] = []
    if (resumeData.selfEvaluation?.trim()) {
      fields.push({ key: 'selfEvaluation', label: '自我评价', content: resumeData.selfEvaluation })
    }
    if (resumeData.skillContent?.trim()) {
      fields.push({ key: 'skillContent', label: '专业技能', content: resumeData.skillContent })
    }
    resumeData.experience?.forEach((e) => {
      if (e.details?.trim()) fields.push({ key: `experience:${e.id}`, label: `实习·${stripHtmlTags(e.company) || '经历'}`, content: e.details })
    })
    resumeData.projects?.forEach((p) => {
      if (p.description?.trim()) fields.push({ key: `project:${p.id}`, label: `项目·${stripHtmlTags(p.name) || ''}`, content: p.description })
    })
    resumeData.openSource?.forEach((o) => {
      if (o.description?.trim()) fields.push({ key: `openSource:${o.id}`, label: `开源·${stripHtmlTags(o.name) || ''}`, content: o.description })
    })
    return fields
  }, [resumeData])

  // 点击外部区域关闭下拉菜单
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

  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPendingRenderRef = useRef(false)
  const loadingRef = useRef(loading)
  const autoRenderInitializedRef = useRef(false)

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  const scheduleRender = useCallback((delayMs: number) => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    renderTimerRef.current = setTimeout(() => {
      if (loadingRef.current) return
      if (!hasPendingRenderRef.current) return
      hasPendingRenderRef.current = false
      setIsAutoRenderPending(false)
      handleRender()
    }, delayMs)
  }, [handleRender])

  // 简历数据变化时自动触发 PDF 渲染（仅 LaTeX）
  // 策略：编辑空闲一段时间后统一渲染，避免每次输入都刷新 PDF
  useEffect(() => {
    if (!isDataLoaded) return
    if (resumeData.templateType === 'html') return
    if (!autoRenderInitializedRef.current) {
      autoRenderInitializedRef.current = true
      setIsAutoRenderPending(false)
      return
    }
    hasPendingRenderRef.current = true
    setIsAutoRenderPending(true)
    scheduleRender(PDF_RENDER_DEBOUNCE_MS)
  }, [resumeData, isDataLoaded, scheduleRender])

  // 若渲染期间继续有编辑，等当前渲染结束后再补一次（合并多次变更）
  useEffect(() => {
    if (resumeData.templateType === 'html') return
    if (!loading && hasPendingRenderRef.current) {
      scheduleRender(PDF_RENDER_DEBOUNCE_MS)
    }
  }, [loading, resumeData.templateType, scheduleRender])

  useEffect(() => {
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    }
  }, [])

  // JD 文本变化时自动触发评分
  useEffect(() => {
    if (currentResumeId && jdText && jdText.trim().length > 10) {
      scoreResume(currentResumeId, jdText).then(setScoreData).catch(console.error)
    }
  }, [currentResumeId, jdText])

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
        setResumeData={setResumeData}
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
        addCustomItem={addCustomItem}
        updateCustomItem={updateCustomItem}
        deleteCustomItem={deleteCustomItem}
        updateSelfEvaluation={updateSelfEvaluation}
        updateSkillContent={updateSkillContent}
        handleAIImport={handleAIImport}
        pdfBlob={pdfBlob}
        loading={loading}
        progress={progress}
        autoRenderPending={isAutoRenderPending}
        handleRender={handleRender}
        handleDownload={handleDownload}
        editMode={editMode}
      />

      {/* JD 评分输入区域 */}
      <div className="mt-4 mx-4 mb-4 p-4 border border-gray-200 dark:border-neutral-800 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">职位描述匹配评分</h3>
          <button
            type="button"
            onClick={() => setShowJdOptimize(true)}
            disabled={jdText.trim().length < 10 || jdFields.length === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={jdText.trim().length < 10 ? '请先粘贴职位描述' : '让 AI 按该 JD 优化简历'}
          >
            AI 优化匹配 JD
          </button>
        </div>
        <textarea
          ref={jdTextareaRef}
          value={jdText}
          onChange={(e) => { setJdText(e.target.value); setScoreData(null); }}
          placeholder="粘贴职位描述，AI将自动分析简历与JD的匹配度..."
          className="w-full min-h-[80px] p-2 border border-gray-200 dark:border-neutral-800 dark:bg-neutral-900 rounded text-sm"
        />
        {scoreData && <ScoreCard {...scoreData} />}
      </div>

      {/* 针对 JD 优化弹窗 */}
      <JdOptimizeDialog
        open={showJdOptimize}
        onOpenChange={setShowJdOptimize}
        fields={jdFields}
        jdText={jdText}
        onApply={applyTextReplacement}
      />

      {/* AI 助手 Dock —— 统一浮动入口 */}
      <AiCopilotDock
        onJdOptimize={() => setShowJdOptimize(true)}
        jdReady={jdText.trim().length >= 10 && jdFields.length > 0}
        onFocusJd={() => {
          jdTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          jdTextareaRef.current?.focus()
        }}
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
