/**
 * 简历操作 Hook
 * 处理简历的加载、保存、导入等操作
 */
import { useCallback } from 'react'
import type { Resume } from '../../../types/resume'
import { renderPDF, getDefaultTemplate } from '../../../services/api'
import { 
  getAllResumes, 
  getResume, 
  saveResume, 
  getCurrentResumeId, 
  setCurrentResumeId 
} from '../../../services/resumeStorage'
import { DEFAULT_SECTION_ORDER } from './useWorkspaceState'

interface UseResumeOperationsProps {
  setResume: React.Dispatch<React.SetStateAction<Resume | null>>
  setCurrentResumeId: React.Dispatch<React.SetStateAction<string | null>>
  setShowEditor: React.Dispatch<React.SetStateAction<boolean>>
  setPreviewMode: React.Dispatch<React.SetStateAction<'live' | 'pdf'>>
  setCurrentSectionOrder: React.Dispatch<React.SetStateAction<string[]>>
  setShowResumeList: React.Dispatch<React.SetStateAction<boolean>>
  setPdfBlob: React.Dispatch<React.SetStateAction<Blob | null>>
  setLoadingPdf: React.Dispatch<React.SetStateAction<boolean>>
  setLastImportedText: React.Dispatch<React.SetStateAction<string>>
  currentResumeId: string | null
  resume: Resume | null
  autoSaveTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  pdfTimer: {
    startTimer: () => void
    stopTimer: () => void
  }
}

export function useResumeOperations({
  setResume,
  setCurrentResumeId: setCurrentResumeIdState,
  setShowEditor,
  setPreviewMode,
  setCurrentSectionOrder,
  setShowResumeList,
  setPdfBlob,
  setLoadingPdf,
  setLastImportedText,
  currentResumeId,
  resume,
  autoSaveTimer,
  pdfTimer,
}: UseResumeOperationsProps) {
  
  /**
   * 加载简历（优先从 localStorage，否则从前端模板）
   */
  const loadResume = useCallback(async () => {
    setLoadingPdf(true)
    pdfTimer.startTimer()
    
    // 检查是否有保存的简历
    const savedId = getCurrentResumeId()
    if (savedId) {
      const saved = getResume(savedId)
      if (saved) {
        setResume(saved.data)
        setCurrentResumeIdState(savedId)
        setShowEditor(true)
        setPreviewMode('pdf')
        setCurrentSectionOrder(DEFAULT_SECTION_ORDER)
        
        renderPDF(saved.data, false, DEFAULT_SECTION_ORDER)
          .then(blob => {
            setPdfBlob(blob)
            setLoadingPdf(false)
            pdfTimer.stopTimer()
          })
          .catch(err => {
            console.log('PDF 后台生成失败:', err)
            setLoadingPdf(false)
            pdfTimer.stopTimer()
          })
        return
      }
    }
    
    // 检查是否有任何保存的简历
    const allResumes = getAllResumes()
    if (allResumes.length > 0) {
      const first = allResumes[0]
      setResume(first.data)
      setCurrentResumeIdState(first.id)
      setCurrentResumeId(first.id)
      setShowEditor(true)
      setPreviewMode('pdf')
      setCurrentSectionOrder(DEFAULT_SECTION_ORDER)
      
      renderPDF(first.data, false, DEFAULT_SECTION_ORDER)
        .then(blob => {
          setPdfBlob(blob)
          setLoadingPdf(false)
          pdfTimer.stopTimer()
        })
        .catch(err => {
          console.log('PDF 后台生成失败:', err)
          setLoadingPdf(false)
          pdfTimer.stopTimer()
        })
      return
    }

    // 没有保存的简历，使用前端默认模板
    try {
      const template = getDefaultTemplate() as Resume
      setResume(template)
      setShowEditor(true)
      setPreviewMode('pdf')
      setCurrentSectionOrder(DEFAULT_SECTION_ORDER)
      
      // 自动保存为新简历
      const saved = saveResume(template)
      setCurrentResumeIdState(saved.id)
      
      renderPDF(template, false, DEFAULT_SECTION_ORDER)
        .then(blob => {
          setPdfBlob(blob)
          setLoadingPdf(false)
          pdfTimer.stopTimer()
        })
        .catch(err => {
          console.log('PDF 后台生成失败:', err)
          setLoadingPdf(false)
          pdfTimer.stopTimer()
        })
    } catch (error) {
      console.error('Failed to load template:', error)
      setLoadingPdf(false)
      pdfTimer.stopTimer()
      alert('加载模板失败，请检查后端服务是否正常。')
    }
  }, [setResume, setCurrentResumeIdState, setShowEditor, setPreviewMode, setCurrentSectionOrder, setPdfBlob, setLoadingPdf, pdfTimer])

  /**
   * 新建简历
   */
  const handleCreateNew = useCallback(async () => {
    try {
      const template = getDefaultTemplate() as Resume
      const saved = saveResume(template)
      setResume(template)
      setCurrentResumeIdState(saved.id)
      setShowEditor(true)
      setPreviewMode('pdf')
      setCurrentSectionOrder(DEFAULT_SECTION_ORDER)
      setShowResumeList(false)
    } catch (error) {
      console.error('Failed to create new resume:', error)
    }
  }, [setResume, setCurrentResumeIdState, setShowEditor, setPreviewMode, setCurrentSectionOrder, setShowResumeList])

  /**
   * 选择简历
   */
  const handleSelectResume = useCallback((resumeData: Resume, id: string) => {
    setResume(resumeData)
    setCurrentResumeIdState(id)
    setShowEditor(true)
    setPreviewMode('pdf')
    setCurrentSectionOrder(DEFAULT_SECTION_ORDER)
    setShowResumeList(false)
    renderPDF(resumeData, false, DEFAULT_SECTION_ORDER)
      .then(blob => setPdfBlob(blob))
      .catch(err => console.log('PDF 后台生成失败:', err))
  }, [setResume, setCurrentResumeIdState, setShowEditor, setPreviewMode, setCurrentSectionOrder, setShowResumeList, setPdfBlob])

  /**
   * 自动保存（防抖）
   */
  const autoSave = useCallback((resumeData: Resume) => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
    }
    autoSaveTimer.current = setTimeout(() => {
      if (currentResumeId) {
        saveResume(resumeData, currentResumeId)
      }
    }, 1000)
  }, [currentResumeId, autoSaveTimer])

  /**
   * AI 导入简历
   */
  const handleAIImport = useCallback((importedResume: Resume, saveToList: boolean, originalText: string) => {
    setResume(importedResume)
    setLastImportedText(originalText)
    setShowEditor(true)
    setPreviewMode('pdf')
    setCurrentSectionOrder(DEFAULT_SECTION_ORDER)
    
    if (saveToList) {
      const saved = saveResume(importedResume)
      setCurrentResumeIdState(saved.id)
    } else {
      setCurrentResumeIdState(null)
    }
    
    renderPDF(importedResume, false, DEFAULT_SECTION_ORDER)
      .then(blob => setPdfBlob(blob))
      .catch(err => console.log('PDF 后台生成失败:', err))
  }, [setResume, setLastImportedText, setShowEditor, setPreviewMode, setCurrentSectionOrder, setCurrentResumeIdState, setPdfBlob])

  /**
   * 手动保存当前简历到列表
   */
  const handleSaveToList = useCallback(() => {
    if (resume) {
      const saved = saveResume(resume, currentResumeId || undefined)
      setCurrentResumeIdState(saved.id)
      alert('已保存到我的简历！')
    }
  }, [resume, currentResumeId, setCurrentResumeIdState])

  /**
   * 加载 Demo 模板
   */
  const handleLoadDemo = useCallback(async () => {
    setLoadingPdf(true)
    try {
      const template = getDefaultTemplate()
      setResume(template)
      const saved = saveResume(template)
      setCurrentResumeIdState(saved.id)
      setShowEditor(true)
      setPreviewMode('pdf')
      const blob = await renderPDF(template, false, DEFAULT_SECTION_ORDER)
      setPdfBlob(blob)
    } catch (error) {
      console.error('Failed to load demo:', error)
      alert('加载模板失败，请检查后端服务是否正常。')
    } finally {
      setLoadingPdf(false)
    }
  }, [setResume, setCurrentResumeIdState, setShowEditor, setPreviewMode, setPdfBlob, setLoadingPdf])

  return {
    loadResume,
    handleCreateNew,
    handleSelectResume,
    autoSave,
    handleAIImport,
    handleSaveToList,
    handleLoadDemo,
  }
}
