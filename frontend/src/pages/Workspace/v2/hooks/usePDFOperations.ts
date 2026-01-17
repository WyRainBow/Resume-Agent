/**
 * PDF 操作 Hook
 */
import { saveAs } from 'file-saver'
import { useCallback, useState } from 'react'
import { renderPDFStream } from '../../../../services/api'
import { saveResume, setCurrentResumeId } from '../../../../services/resumeStorage'
import type { ResumeData } from '../types'
import { convertToBackendFormat } from '../utils/convertToBackend'

interface UsePDFOperationsProps {
  resumeData: ResumeData
  currentResumeId: string | null
  setCurrentId: (id: string | null) => void
}

export function usePDFOperations({ resumeData, currentResumeId, setCurrentId }: UsePDFOperationsProps) {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 渲染 PDF
  const handleRender = useCallback(async () => {
    setLoading(true)
    setProgress('正在准备数据...')

    try {
      const backendData = convertToBackendFormat(resumeData)
      setProgress('正在渲染 PDF...')

      const blob = await renderPDFStream(
        backendData as any,
        backendData.sectionOrder,
        (p) => setProgress(p),
        () => setProgress('渲染完成！'),
        (err) => setProgress(`错误: ${err}`)
      )

      setPdfBlob(blob)
      setProgress('')
    } catch (error) {
      console.error('PDF 渲染失败:', error)
      setProgress(`渲染失败: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [resumeData])

  // 下载 PDF
  const handleDownload = useCallback(() => {
    if (!pdfBlob) return

    const name = resumeData.basic.name || '简历'
    const date = new Date().toISOString().split('T')[0]
    const filename = `${name}_简历_${date}.pdf`

    const file = new File([pdfBlob], filename, { type: 'application/pdf' })
    saveAs(file, filename)
  }, [pdfBlob, resumeData.basic.name])

  // 保存到 Dashboard
  const handleSaveToDashboard = useCallback(async () => {
    // 直接保存完整的 resumeData，确保 templateType 等字段不丢失
    const saved = await saveResume(resumeData as any, currentResumeId || undefined)
    
    if (!currentResumeId) {
      setCurrentId(saved.id)
      setCurrentResumeId(saved.id)
    }
    
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }, [resumeData, currentResumeId, setCurrentId])

  return {
    pdfBlob,
    loading,
    progress,
    saveSuccess,
    handleRender,
    handleDownload,
    handleSaveToDashboard,
  }
}

