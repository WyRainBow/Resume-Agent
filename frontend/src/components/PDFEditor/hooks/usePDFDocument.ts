/**
 * PDF 文档加载 Hook
 * 负责加载 PDF 文档并管理其生命周期
 */

import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// 设置 PDF.js Worker
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePDFDocument.ts:useEffect:entry',message:'usePDFDocument useEffect 执行',data:{hasPdfBlob:!!pdfBlob,blobSize:pdfBlob?.size,hasPdfDoc:!!pdfDoc},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D,E'})}).catch(()=>{});
    // #endregion
    // 清理之前的文档
    if (pdfDoc) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePDFDocument.ts:useEffect:destroyOldDoc',message:'销毁旧的 PDF 文档',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      pdfDoc.destroy()
      setPdfDoc(null)
    }

    if (!pdfBlob) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePDFDocument.ts:useEffect:noPdfBlob',message:'pdfBlob 为空，跳过加载',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      setNumPages(0)
      setError(null)
      return
    }

    const loadPDF = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePDFDocument.ts:loadPDF:start',message:'开始加载 PDF',data:{blobSize:pdfBlob.size},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      setLoading(true)
      setError(null)

      try {
        // 取消之前的加载任务
        if (loadingTaskRef.current) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePDFDocument.ts:loadPDF:cancelPrevious',message:'取消之前的加载任务',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
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
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePDFDocument.ts:loadPDF:success',message:'PDF 文档加载成功',data:{numPages:doc.numPages},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        setPdfDoc(doc)
        setNumPages(doc.numPages)
      } catch (err) {
        // 忽略取消错误
        if (err instanceof Error && err.message.includes('destroy')) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePDFDocument.ts:loadPDF:destroyed',message:'加载任务被取消',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          return
        }
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePDFDocument.ts:loadPDF:error',message:'PDF 加载失败',data:{error:String(err)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.error('PDF 加载失败:', err)
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadPDF()

    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePDFDocument.ts:useEffect:cleanup',message:'useEffect 清理函数执行',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy()
        loadingTaskRef.current = null
      }
    }
  }, [pdfBlob])

  return { pdfDoc, numPages, loading, error }
}
