/**
 * PDF 操作 Hook
 * 处理 PDF 渲染、生成、下载等操作
 */
import { useCallback } from 'react'
import type { Resume } from '../../../types/resume'
import { renderPDF, renderPDFStream } from '../../../services/api'
import { saveResume } from '../../../services/resumeStorage'

interface UsePDFOperationsProps {
  resume: Resume | null
  setResume: React.Dispatch<React.SetStateAction<Resume | null>>
  pdfBlob: Blob | null
  setPdfBlob: React.Dispatch<React.SetStateAction<Blob | null>>
  pdfDirty: boolean
  setPdfDirty: React.Dispatch<React.SetStateAction<boolean>>
  loadingPdf: boolean
  setLoadingPdf: React.Dispatch<React.SetStateAction<boolean>>
  currentSectionOrder: string[]
  setCurrentSectionOrder: React.Dispatch<React.SetStateAction<string[]>>
  setPreviewMode: React.Dispatch<React.SetStateAction<'live' | 'pdf'>>
  currentResumeId: string | null
  setShowEditor: React.Dispatch<React.SetStateAction<boolean>>
  autoSave: (resumeData: Resume) => void
  previewDebounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  pdfTimer: {
    startTimer: () => void
    stopTimer: () => void
    formatTime: (ms: number) => string
    elapsedTime: number
    finalTime: number | null
    getTimeColor: (ms: number) => string
  }
  setPdfProgress?: React.Dispatch<React.SetStateAction<string>>
  setShowProgress?: React.Dispatch<React.SetStateAction<boolean>>
}

export function usePDFOperations({
  resume,
  setResume,
  pdfBlob,
  setPdfBlob,
  pdfDirty,
  setPdfDirty,
  setLoadingPdf,
  currentSectionOrder,
  setCurrentSectionOrder,
  setPreviewMode,
  currentResumeId,
  setShowEditor,
  autoSave,
  previewDebounceRef,
  pdfTimer,
  setPdfProgress,
  setShowProgress,
}: UsePDFOperationsProps) {

  /**
   * 处理简历变化（从 ChatPanel）
   */
  const handleResumeChange = useCallback(async (newResume: Resume) => {
    setResume(newResume)
    setShowEditor(true)
    setLoadingPdf(true)
    try {
      // 使用流式渲染以显示进度
      const blob = await renderPDFStream(
        newResume,
        currentSectionOrder.length > 0 ? currentSectionOrder : undefined,
        // 进度回调
        (progress) => {
          setPdfProgress?.(progress)
        },
        // PDF数据回调
        (pdfData) => {
          setPdfProgress?.('PDF 生成完成！')
        },
        // 错误回调
        (error) => {
          setPdfProgress?.(`错误: ${error}`)
        }
      )
      setPdfBlob(blob)
    } catch (error) {
      console.error('Failed to render PDF:', error)
      setPdfProgress?.('渲染失败，请检查后端服务')
      alert('PDF 渲染失败，请检查后端服务是否正常。')
    } finally {
      setLoadingPdf(false)
    }
  }, [setResume, setShowEditor, setLoadingPdf, setPdfBlob, currentSectionOrder, setPdfProgress])

  /**
   * 【三层渲染架构】Layer 1 & 2: 编辑器数据变化处理
   */
  const handleEditorSave = useCallback((newResume: Resume, sectionOrder?: string[]) => {
    // Layer 1: 立即更新数据状态
    setResume(newResume)
    setPdfDirty(true)
    
    const newOrder = sectionOrder || currentSectionOrder
    if (sectionOrder) {
      setCurrentSectionOrder(sectionOrder)
    }
    
    // Layer 2: 防抖更新预览和自动保存（500ms）
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current)
    }
    previewDebounceRef.current = setTimeout(() => {
      autoSave(newResume)
      console.log('[Layer 2] 预览更新 + 自动保存')
    }, 500)
  }, [currentSectionOrder, autoSave, setResume, setPdfDirty, setCurrentSectionOrder, previewDebounceRef])
  
  /**
   * 【三层渲染架构】Layer 3: 显式生成 PDF（使用流式API）
   * @param forceRender 是否强制渲染
   * @param resumeData 可选，如果传入则使用传入的数据
   */
  const generatePDF = useCallback(async (forceRender = false, resumeData?: Resume) => {
    const dataToRender = resumeData || resume
    if (!dataToRender) return null
    if (!pdfDirty && !forceRender && pdfBlob) {
      console.log('[Layer 3] PDF 无变化，跳过渲染')
      return pdfBlob
    }

    console.log('[Layer 3] 开始生成 PDF...')
    setLoadingPdf(true)
    pdfTimer.startTimer()
    setPdfProgress?.('开始生成 PDF...')
    setShowProgress?.(true)

    try {
      // 使用流式PDF渲染API，显示进度
      const blob = await renderPDFStream(
        dataToRender,
        currentSectionOrder.length > 0 ? currentSectionOrder : undefined,
        // 进度回调
        (progress) => {
          console.log('[Layer 3] PDF生成进度:', progress)
          setPdfProgress?.(progress)
        },
        // PDF数据回调
        (pdfData) => {
          console.log('[Layer 3] PDF数据已接收，大小:', pdfData?.byteLength || 0, '字节')
          setPdfProgress?.('PDF 生成完成！')
        },
        // 错误回调
        (error) => {
          console.error('[Layer 3] PDF流式渲染错误:', error)
          setPdfProgress?.(`错误: ${error}`)
        }
      )

      setPdfBlob(blob)
      setPdfDirty(false)
      pdfTimer.stopTimer()
      return blob
    } catch (error) {
      console.error('[Layer 3] PDF 渲染失败:', error)
      pdfTimer.stopTimer()
      setPdfProgress?.('渲染失败，请重试')
      alert('PDF 渲染失败，请检查后端服务是否正常。')
      return null
    } finally {
      setLoadingPdf(false)
      setShowProgress?.(false)
    }
  }, [resume, pdfDirty, pdfBlob, currentSectionOrder, pdfTimer, setLoadingPdf, setPdfBlob, setPdfDirty, setPdfProgress, setShowProgress])
  
  /**
   * 显式保存并更新 PDF
   * @param resumeData 可选，如果传入则使用传入的数据，否则使用当前状态
   */
  const handleSaveAndRender = useCallback(async (resumeData?: Resume) => {
    const dataToRender = resumeData || resume
    if (!dataToRender) return
    
    // 如果传入了新数据，先更新状态
    if (resumeData) {
      setResume(resumeData)
      setPdfDirty(true)
    }
    
    if (currentResumeId) {
      saveResume(dataToRender, currentResumeId)
    }
    
    await generatePDF(true, dataToRender)
    setPreviewMode('pdf')
  }, [resume, currentResumeId, generatePDF, setPreviewMode, setResume, setPdfDirty])

  /**
   * 下载 PDF
   */
  const handleDownloadPDF = useCallback(async () => {
    let blob = pdfBlob
    if (pdfDirty || !pdfBlob) {
      blob = await generatePDF(true)
    }

    if (blob) {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `resume_${new Date().toISOString().split('T')[0]}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    }
  }, [pdfBlob, pdfDirty, generatePDF])

  /**
   * PDF 内容变化处理
   */
  const handlePDFContentChange = useCallback((oldText: string, newText: string) => {
    if (!resume) return
    
    const replaceTextInResume = (obj: any, old: string, newT: string): any => {
      if (typeof obj === 'string') {
        return obj === old ? newT : obj
      }
      if (Array.isArray(obj)) {
        return obj.map(item => replaceTextInResume(item, old, newT))
      }
      if (typeof obj === 'object' && obj !== null) {
        const newObj: any = {}
        for (const key in obj) {
          newObj[key] = replaceTextInResume(obj[key], old, newT)
        }
        return newObj
      }
      return obj
    }
    
    const newResume = replaceTextInResume(resume, oldText, newText)
    
    if (JSON.stringify(newResume) !== JSON.stringify(resume)) {
      handleEditorSave(newResume)
    }
  }, [resume, handleEditorSave])

  return {
    handleResumeChange,
    handleEditorSave,
    generatePDF,
    handleSaveAndRender,
    handleDownloadPDF,
    handlePDFContentChange,
  }
}
