/**
 * PDF 文档加载 Hook
 * 负责加载 PDF 文档并管理其生命周期
 */

import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { initPDF } from '../pdfWorkerConfig'

// 初始化 PDF 配置
initPDF()

interface UsePDFDocumentResult {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null
  numPages: number
  loading: boolean
  error: string | null
}

export const usePDFDocument = (pdfBlob: Blob | null): UsePDFDocumentResult => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 追踪当前加载任务，用于取消
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null)

  useEffect(() => {
    // 清理之前的文档
    if (pdfDoc) {
      pdfDoc.destroy()
      setPdfDoc(null)
    }

    if (!pdfBlob) {
      setNumPages(0)
      setError(null)
      return
    }

    const loadPDF = async () => {
      setLoading(true)
      setError(null)

      try {
        // 取消之前的加载任务
        if (loadingTaskRef.current) {
          loadingTaskRef.current.destroy()
        }

        const arrayBuffer = await pdfBlob.arrayBuffer()

        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        })

        loadingTaskRef.current = loadingTask

        const doc = await loadingTask.promise

        setPdfDoc(doc)
        setNumPages(doc.numPages)
      } catch (err) {
        // 忽略取消错误
        if (err instanceof Error && err.message.includes('destroy')) {
          return
        }
        console.error('PDF 加载失败:', err)
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadPDF()

    return () => {
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy()
        loadingTaskRef.current = null
      }
    }
  }, [pdfBlob])

  return { pdfDoc, numPages, loading, error }
}
