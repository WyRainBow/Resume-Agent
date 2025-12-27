/**
 * PDF 文档加载 Hook
 * 负责加载 PDF 文档并管理其生命周期
 * 支持移动设备和网络较差环境的重试机制
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

const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 秒

export const usePDFDocument = (pdfBlob: Blob | null): UsePDFDocumentResult => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 追踪当前加载任务，用于取消
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null)
  const retryCountRef = useRef(0)

  useEffect(() => {
    // 清理之前的文档
    if (pdfDoc) {
      pdfDoc.destroy()
      setPdfDoc(null)
    }

    if (!pdfBlob) {
      setNumPages(0)
      setError(null)
      retryCountRef.current = 0
      return
    }

    const loadPDF = async (retryCount = 0) => {
      setLoading(true)
      if (retryCount === 0) {
        setError(null)
      }

      try {
        // 取消之前的加载任务
        if (loadingTaskRef.current) {
          loadingTaskRef.current.destroy()
        }

        const arrayBuffer = await pdfBlob.arrayBuffer()

        // 检查 PDF 文件有效性
        const dataView = new Uint8Array(arrayBuffer)
        if (dataView[0] !== 0x25 || dataView[1] !== 0x50 || dataView[2] !== 0x44 || dataView[3] !== 0x46) {
          throw new Error('Invalid PDF file format')
        }

        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          // 移动设备优化：使用 Range 请求但要求较大的块大小
          rangeChunkSize: 65536,
          disableStream: true, // 禁用流式处理，一次性加载整个文件
          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
        })

        loadingTaskRef.current = loadingTask

        const doc = await loadingTask.promise

        setPdfDoc(doc)
        setNumPages(doc.numPages)
        setError(null)
        retryCountRef.current = 0
      } catch (err) {
        // 忽略取消错误
        if (err instanceof Error && err.message.includes('destroy')) {
          return
        }
        
        console.error('PDF 加载失败:', err)
        
        const errorMessage = err instanceof Error ? err.message : '加载失败'
        
        // 如果还有重试次数，自动重试
        if (retryCount < MAX_RETRIES) {
          console.info(`Retrying PDF load (attempt ${retryCount + 1}/${MAX_RETRIES})`)
          setError(`加载中... (${retryCount + 1}/${MAX_RETRIES})`)
          
          // 延迟后重试
          setTimeout(() => {
            loadPDF(retryCount + 1)
          }, RETRY_DELAY * (retryCount + 1))
        } else {
          // 重试失败，显示错误信息
          setError(`${errorMessage}。请检查网络连接或刷新页面重试。`)
          setLoading(false)
        }
      } finally {
        if (retryCount === MAX_RETRIES || !error) {
          setLoading(false)
        }
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
