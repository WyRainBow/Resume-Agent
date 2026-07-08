import { toast } from '@/lib/toast'
/**
 * Workspace v2 - 编辑区主入口
 * 使用 WorkspaceLayout 包裹，提供统一的侧边栏布局
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Hooks
import { useAIImport, useAutoSaveResume, usePDFOperations, useResumeData } from './hooks'

// 组件
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { Header } from './components'
import EditPreviewLayout from './EditPreviewLayout'
import AIImportModal from './shared/AIImportModal'
import JdOptimizeDialog from './shared/JdOptimizeDialog'
import JdMatchDialog from './shared/JdMatchDialog'
import TranslateDialog from './shared/TranslateDialog'
import HealthCheckDialog from './shared/HealthCheckDialog'
import AiAssistantChat from './shared/AiAssistantChat'
import { scoreResume, type JdOptimizeField } from '@/services/api'
import { stripHtmlTags } from './utils/textUtils'

const PDF_RENDER_DEBOUNCE_MS = 2000
// 首次加载的自动渲染延迟：短一点，打开工作台即出预览
const PDF_RENDER_INITIAL_DELAY_MS = 300

export default function WorkspaceV2() {
  const navigate = useNavigate()
  
  // 跟踪编辑状态和保存状态
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [initialResumeData, setInitialResumeData] = useState<any>(null)
  const [isAutoRenderPending, setIsAutoRenderPending] = useState(false)
  // 评分状态
  const [jdText, setJdText] = useState('')
  const [scoreData, setScoreData] = useState<any>(null)
  const [scoring, setScoring] = useState(false)
  const [showJdMatch, setShowJdMatch] = useState(false)
  const [showJdOptimize, setShowJdOptimize] = useState(false)
  const [showTranslate, setShowTranslate] = useState(false)
  const [showHealthCheck, setShowHealthCheck] = useState(false)
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
    applyTextReplacements,
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
    renderError,
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

  // 自动保存（与 latex/html 工作台同一保存模型）
  const { saveStatus, saveError } = useAutoSaveResume({
    resumeData,
    currentResumeId,
    isDataLoaded,
    setCurrentId,
  })

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

  // 保存成功时（手动保存或自动保存），更新初始状态
  // 依赖只跟保存状态：仅在“变为已保存”那一刻快照，避免把保存后的新编辑误标为已保存
  useEffect(() => {
    if (saveSuccess || saveStatus === 'saved') {
      setInitialResumeData(JSON.stringify(resumeData))
      setHasUnsavedChanges(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSuccess, saveStatus])

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
      // 首次加载也自动渲染预览（渲染对所有人开放，无需登录）
      hasPendingRenderRef.current = true
      setIsAutoRenderPending(false)
      scheduleRender(PDF_RENDER_INITIAL_DELAY_MS)
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
      setScoring(true)
      scoreResume(currentResumeId, jdText)
        .then(setScoreData)
        .catch(console.error)
        .finally(() => setScoring(false))
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
      toast.error('导出失败，请重试')
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
          toast.success('导入成功！')
        } else {
          throw new Error('无效的 JSON 格式')
        }
      } catch (error) {
        console.error('导入 JSON 失败:', error)
        toast.error('导入失败：文件格式不正确，请确保是有效的 JSON 文件')
      }
    }
    reader.onerror = () => {
      toast.error('读取文件失败，请重试')
    }
    reader.readAsText(file)

    // 清空 input，以便可以重复选择同一文件
    event.target.value = ''
  }

  return (
    <WorkspaceLayout>
      {/* 装饰头(照搬 Builder 风格):返回链接 + 大标题 + 编辑模式标识 + 简历名 chip,纯展示,不含操作按钮(操作按钮在下方 Header 里,避免重复) */}
      <div className="border-b border-black dark:border-white bg-[#F0F0E8] dark:bg-[#1C1C1C] px-6 py-5 md:px-8 md:py-6 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/my-resumes')}
          className="inline-flex items-center gap-1.5 mb-2 -ml-1 px-1 font-mono text-xs font-bold uppercase tracking-wide text-blue-700 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回 Dashboard
        </button>
        <h1 className="font-serif text-3xl md:text-5xl text-black dark:text-white tracking-tight leading-[0.95] uppercase">
          Resume Builder
        </h1>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <p className="text-sm font-mono text-blue-700 uppercase tracking-wide font-bold">
            {'// '}编辑模式
          </p>
          {resumeData?.basic?.name && (
            <span className="font-mono text-xs text-[#444850] dark:text-neutral-300 border border-black dark:border-white bg-white dark:bg-[#2A2A2A] px-2 py-1">
              {resumeData.basic.name}
            </span>
          )}
        </div>
      </div>

      {/* 顶部导航栏 */}
      <Header
        saveSuccess={saveSuccess}
        saveStatus={saveStatus}
        saveError={saveError}
        onGlobalAIImport={handleGlobalAIImport}
        onSaveToDashboard={handleSaveToDashboard}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        resumeData={resumeData}
        resumeName={resumeData?.basic?.name || '我的简历'}
        pdfBlob={pdfBlob}
        onDownloadPDF={handleDownload}
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
        renderError={renderError}
        autoRenderPending={isAutoRenderPending}
        handleRender={handleRender}
        handleDownload={handleDownload}
      />

      {/* JD 匹配优化 —— 聚焦弹窗（粘 JD → 多维评分 → 一键深度优化），取代页面底部常驻大框 */}
      <JdMatchDialog
        open={showJdMatch}
        onOpenChange={setShowJdMatch}
        jdText={jdText}
        onJdTextChange={(v) => { setJdText(v); setScoreData(null) }}
        scoreData={scoreData}
        scoring={scoring}
        hasContent={jdFields.length > 0}
        onOptimize={() => { setShowJdMatch(false); setShowJdOptimize(true) }}
      />

      {/* 针对 JD 优化弹窗 */}
      <JdOptimizeDialog
        open={showJdOptimize}
        onOpenChange={setShowJdOptimize}
        fields={jdFields}
        jdText={jdText}
        onApply={applyTextReplacement}
        onApplyBatch={applyTextReplacements}
      />

      {/* 简历一键翻译弹窗 */}
      <TranslateDialog
        open={showTranslate}
        onOpenChange={setShowTranslate}
        fields={jdFields}
        onApply={applyTextReplacement}
        onApplyBatch={applyTextReplacements}
      />

      {/* 通用简历体检弹窗 */}
      <HealthCheckDialog
        open={showHealthCheck}
        onOpenChange={setShowHealthCheck}
        fields={jdFields}
        onApply={applyTextReplacement}
        onApplyBatch={applyTextReplacements}
      />

      {/* AI 助手 —— 右下角可拖拽悬浮气泡 + 对话窗口 */}
      <AiAssistantChat
        resumeData={resumeData}
        onJdOptimize={() => setShowJdMatch(true)}
        jdReady={jdText.trim().length >= 10 && jdFields.length > 0}
        onFocusJd={() => setShowJdMatch(true)}
        onTranslate={() => setShowTranslate(true)}
        onHealthCheck={() => setShowHealthCheck(true)}
        hasContent={jdFields.length > 0}
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

    </WorkspaceLayout>
  )
}
