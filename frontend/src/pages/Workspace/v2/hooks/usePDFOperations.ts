/**
 * PDF 操作 Hook
 */
import { saveAs } from 'file-saver'
import { useCallback, useEffect, useRef, useState } from 'react'
import { recordPdfDownload, renderPDFStream, renderPDF } from '../../../../services/api'
import { getStoredAuthRole } from '@/lib/runtimeEnv'
import { getStoredPDFRenderMode, setStoredPDFRenderMode, type PDFRenderMode } from '@/services/pdfRenderMode'
import { saveResume, setCurrentResumeId } from '../../../../services/resumeStorage'
import type { ResumeData } from '../types'
import { convertToBackendFormat } from '../utils/convertToBackend'
import { useAuth } from '@/contexts/AuthContext'

interface UsePDFOperationsProps {
  resumeData: ResumeData
  currentResumeId: string | null
  setCurrentId: (id: string | null) => void
}

export function usePDFOperations({ resumeData, currentResumeId, setCurrentId }: UsePDFOperationsProps) {
  const { isAuthenticated, openModal } = useAuth()
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [renderMode, setRenderMode] = useState<PDFRenderMode>(getStoredPDFRenderMode())
  const resumeDataRef = useRef(resumeData)
  const renderModeRef = useRef<PDFRenderMode>(renderMode)
  const dataVersionRef = useRef(0)
  const activeRenderIdRef = useRef(0)
  const activeAbortControllerRef = useRef<AbortController | null>(null)
  resumeDataRef.current = resumeData
  renderModeRef.current = renderMode
  const isAdmin = getStoredAuthRole() === 'admin'

  useEffect(() => {
    if (!isAdmin && renderMode !== 'local') {
      setRenderMode('local')
      setStoredPDFRenderMode('local')
      return
    }
    setStoredPDFRenderMode(renderMode)
    console.info('[PDF TRACE][render-mode:stored]', {
      renderMode,
      isAdmin,
    })
  }, [isAdmin, renderMode])

  useEffect(() => {
    dataVersionRef.current += 1
    activeAbortControllerRef.current?.abort()
  }, [resumeData])

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    try {
      return JSON.stringify(error)
    } catch {
      return '未知错误'
    }
  }

  // 渲染 PDF：始终用 ref 取最新数据，供防抖/延迟调用时使用
  const handleRender = useCallback(async () => {
    const renderVersion = dataVersionRef.current
    const renderId = activeRenderIdRef.current + 1
    const abortController = new AbortController()
    activeRenderIdRef.current = renderId
    activeAbortControllerRef.current?.abort()
    activeAbortControllerRef.current = abortController
    const isCurrentRender = () =>
      renderId === activeRenderIdRef.current &&
      renderVersion === dataVersionRef.current &&
      !abortController.signal.aborted

    setLoading(true)
    setProgress('正在准备数据...')

    try {
      const data = resumeDataRef.current
      const backendData = convertToBackendFormat(data)
      console.info('[PDF TRACE][render:dispatch]', {
        renderMode: renderModeRef.current,
        trigger: 'workspace.v2',
      })
      setProgress('正在渲染 PDF...')

      let blob: Blob
      try {
        blob = await renderPDFStream(
          backendData as any,
          backendData.sectionOrder,
          (p) => {
            if (isCurrentRender()) setProgress(p)
          },
          () => {
            if (isCurrentRender()) setProgress('渲染完成！')
          },
          (err) => {
            if (isCurrentRender()) setProgress(`错误: ${err}`)
          },
          {
            source: 'workspace.v2',
            trigger: 'auto-render',
            signal: abortController.signal,
            renderMode: renderModeRef.current,
          }
        )
      } catch (streamError) {
        const streamErrorMsg = getErrorMessage(streamError)
        if (!isCurrentRender()) return
        console.error('PDF 流式渲染失败，尝试普通渲染:', streamError)
        setProgress(`流式渲染失败：${streamErrorMsg}\n正在切换为普通渲染...`)
        try {
          blob = await renderPDF(
            backendData as any,
            false,
            backendData.sectionOrder,
            abortController.signal,
            renderModeRef.current,
          )
        } catch (normalError) {
          if (!isCurrentRender()) return
          const normalErrorMsg = getErrorMessage(normalError)
          throw new Error(
            `流式渲染失败：${streamErrorMsg}\n普通渲染失败：${normalErrorMsg}`
          )
        }
      }

      if (!isCurrentRender()) return
      setPdfBlob(blob)
      setProgress('')
    } catch (error) {
      if (!isCurrentRender()) return
      const message = getErrorMessage(error)
      console.error('PDF 渲染失败:', error)
      setProgress(`渲染失败：${message}`)
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null
        setLoading(false)
      }
    }
  }, [])

  // 清理文件名：去除首尾空格，将多个连续空格替换为单个空格
  const cleanFileName = (name: string | undefined): string => {
    if (!name) return '简历'
    return name.trim().replace(/\s+/g, ' ')
  }

  // 下载 PDF
  const handleDownload = useCallback(async () => {
    if (!pdfBlob) return

    // 导出/下载需要登录（预览渲染对所有人开放）
    if (!isAuthenticated) {
      openModal('login')
      setProgress('请先登录后再导出 PDF')
      return
    }

    const name = cleanFileName(resumeData.basic.name)
    const date = new Date().toISOString().split('T')[0]
    const filename = `${name}_简历_${date}.pdf`

    try {
      await recordPdfDownload()
    } catch (error) {
      const message = getErrorMessage(error)
      setProgress(`下载失败：${message}`)
      return
    }

    const file = new File([pdfBlob], filename, { type: 'application/pdf' })
    saveAs(file, filename)
  }, [pdfBlob, resumeData.basic.name, isAuthenticated, openModal])

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
    renderMode,
    canUseRemoteRender: isAdmin,
    setRenderMode,
    handleRender,
    handleDownload,
    handleSaveToDashboard,
  }
}
