/**
 * PDF 操作 Hook
 */
import { saveAs } from 'file-saver'
import { useCallback, useRef, useState } from 'react'
import { renderPDFStream, renderPDF } from '../../../../services/api'
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
  const resumeDataRef = useRef(resumeData)
  resumeDataRef.current = resumeData

  // 渲染 PDF：始终用 ref 取最新数据，供防抖/延迟调用时使用
  const handleRender = useCallback(async () => {
    setLoading(true)
    setProgress('正在准备数据...')

    try {
      const data = resumeDataRef.current
      const backendData = convertToBackendFormat(data)
      setProgress('正在渲染 PDF...')

      let blob: Blob
      try {
        blob = await renderPDFStream(
          backendData as any,
          backendData.sectionOrder,
          (p) => setProgress(p),
          () => setProgress('渲染完成！'),
          (err) => setProgress(`错误: ${err}`)
        )
      } catch (streamError) {
        console.error('PDF 流式渲染失败，尝试普通渲染:', streamError)
        setProgress('流式渲染失败，正在切换为普通渲染...')
        blob = await renderPDF(
          backendData as any,
          false,
          backendData.sectionOrder
        )
      }

      setPdfBlob(blob)
      setProgress('')
    } catch (error) {
      console.error('PDF 渲染失败:', error)
      setProgress(`渲染失败: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // 清理文件名：去除首尾空格，将多个连续空格替换为单个空格
  const cleanFileName = (name: string | undefined): string => {
    if (!name) return '简历'
    return name.trim().replace(/\s+/g, ' ')
  }

  // 下载 PDF
  const handleDownload = useCallback(() => {
    if (!pdfBlob) return

    const name = cleanFileName(resumeData.basic.name)
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

