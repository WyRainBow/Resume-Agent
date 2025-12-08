/**
 * @file PDF 预览组件（使用 PDF.js 正确渲染字体）
 */
import React, { useEffect, useState, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// 设置 PDF.js worker - 使用 unpkg CDN（更可靠）
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface Props {
  pdfBlob: Blob | null
  scale: number
  onScaleChange: (scale: number) => void
}

export default function PDFPane({ pdfBlob, scale, onScaleChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)

  /* 下载 PDF 功能 */
  const handleDownload = () => {
    if (!pdfBlob) return;
    
    /* 创建下载链接 */
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    
    /* 生成文件名：resume_日期.pdf */
    const date = new Date().toISOString().split('T')[0];
    link.download = `resume_${date}.pdf`;
    
    /* 触发下载 */
    document.body.appendChild(link);
    link.click();
    
    /* 清理 */
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 记录上次渲染的 blob，避免重复渲染
  const lastRenderedBlob = useRef<Blob | null>(null)

  const renderPDF = async (forceLoading = false) => {
    if (!pdfBlob) return
    
    // 如果 blob 变了，或者强制显示 loading，才显示 loading 状态
    // 仅仅是缩放或翻页时，不显示 loading，避免闪烁
    const isNewFile = lastRenderedBlob.current !== pdfBlob
    if (isNewFile || forceLoading) {
      setLoading(true)
    }
    
    setError(null)
    lastRenderedBlob.current = pdfBlob
    
    try {
      const arrayBuffer = await pdfBlob.arrayBuffer()
      
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        verbosity: 0
      })
      const pdf = await loadingTask.promise
      
      setNumPages(pdf.numPages)
      
      const page = await pdf.getPage(pageNum)
      
      const container = containerRef.current
      if (!container) {
        setLoading(false)
        return
      }
      
      // PDF 实际渲染比例 = 用户设置的 scale * 1.2
      // 这样按钮 100% 时，PDF 视觉大小等于之前 120% 的效果
      const renderScale = scale * 1.2
      
      // 创建新 canvas 避免冲突
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) {
        setLoading(false)
        return
      }
      
      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: renderScale })
      
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      canvas.style.maxWidth = '100%'
      canvas.style.height = 'auto'
      canvas.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
      
      context.scale(dpr, dpr)
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        enableWebGL: false,
        renderInteractiveForms: false
      }
      
      await page.render(renderContext).promise
      
      // 清除旧内容，添加新 canvas
      const canvasContainer = container.querySelector('.pdf-canvas-container')
      if (canvasContainer) {
        canvasContainer.innerHTML = ''
        canvasContainer.appendChild(canvas)
      }
      
      setLoading(false)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      // 忽略取消错误
      if (!errorMsg.includes('cancelled') && !errorMsg.includes('cancel')) {
        setError(`PDF 渲染失败: ${errorMsg}`)
      }
      setLoading(false)
    }
  }

  useEffect(() => {
    renderPDF()
  }, [pdfBlob, pageNum, scale]) // 加入 scale 依赖，缩放时重新渲染

  return (
    <div style={{ 
      padding: '32px', 
      height: '100%', 
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {pdfBlob ? (
        <>
          {/* PDF 渲染区域 - 简洁设计 */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              overflow: 'auto',
              minHeight: 0
            }}
          >
            {loading && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: '#666'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid rgba(102, 126, 234, 0.2)',
                  borderTop: '4px solid #667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '16px'
                }} />
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                <div>正在加载 PDF</div>
              </div>
            )}
            
            {error && (
              <div style={{
                padding: '40px',
                color: '#e74c3c',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '18px', marginBottom: '8px' }}>错误</div>
                <div>{error}</div>
              </div>
            )}
            
            {/* Canvas 容器 - 动态添加 canvas 元素 */}
            <div 
              className="pdf-canvas-container"
              style={{
                display: (loading || error) ? 'none' : 'flex',
                justifyContent: 'center'
              }}
            />
          </div>

        </>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          color: '#666', 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
          <div style={{ fontWeight: 500, fontSize: '16px' }}>
            请先在左侧生成简历
          </div>
        </div>
      )}
    </div>
  )
}
