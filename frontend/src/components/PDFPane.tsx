/**
 * @file PDF 预览组件（使用 PDF.js 正确渲染字体）
 */
import React, { useEffect, useState, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// 设置 PDF.js worker - 使用 unpkg CDN（更可靠）
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface Props {
  pdfBlob: Blob | null
}

export default function PDFPane({ pdfBlob }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.0)

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

  useEffect(() => {
    if (!pdfBlob) return
    
    const renderPDF = async () => {
      setLoading(true)
      setError(null)
      
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
        
        // 创建新 canvas 避免冲突
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
          setLoading(false)
          return
        }
        
        const dpr = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale })
        
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

    renderPDF()
  }, [pdfBlob, pageNum, scale])

  return (
    <div style={{ 
      padding: 'clamp(16px, 3vw, 24px)', 
      height: '100%', 
      boxSizing: 'border-box',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ 
        fontWeight: 700, 
        marginBottom: 'clamp(16px, 2.5vw, 20px)',
        fontSize: 'clamp(16px, 2.5vw, 20px)',
        background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        textShadow: '0 2px 10px rgba(167, 139, 250, 0.3)'
      }}>
        PDF 预览
      </div>
      {pdfBlob ? (
        <div style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: 'clamp(12px, 2vw, 16px)',
          padding: 'clamp(12px, 2.5vw, 20px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* PDF 控制栏 */}
          {numPages > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '16px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              flexWrap: 'wrap'
            }}>
              {/* 下载按钮 */}
              <button
                onClick={handleDownload}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                下载 PDF
              </button>

              {/* 翻页和缩放控制 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setPageNum(prev => Math.max(1, prev - 1))}
                  disabled={pageNum <= 1}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: pageNum <= 1 ? 'not-allowed' : 'pointer',
                    opacity: pageNum <= 1 ? 0.5 : 1,
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  ← 上一页
                </button>
                <span style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>
                  第 {pageNum} 页 / 共 {numPages} 页
                </span>
                <button
                  onClick={() => setPageNum(prev => Math.min(numPages, prev + 1))}
                  disabled={pageNum >= numPages}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: pageNum >= numPages ? 'not-allowed' : 'pointer',
                    opacity: pageNum >= numPages ? 0.5 : 1,
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  下一页 →
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '6px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    −
                  </button>
                  <span style={{ color: 'white', fontSize: '14px', minWidth: '60px', textAlign: 'center' }}>
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={() => setScale(prev => Math.min(3, prev + 0.25))}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '6px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PDF 渲染区域 */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
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
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          color: 'rgba(255, 255, 255, 0.7)', 
          paddingTop: 'clamp(20vh, 30vh, 40vh)',
          fontSize: 'clamp(14px, 2vw, 16px)',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: 'clamp(12px, 2vw, 16px)',
          padding: 'clamp(24px, 5vw, 40px)',
          border: '2px dashed rgba(255, 255, 255, 0.3)',
          margin: 'clamp(12px, 2.5vw, 20px)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{ 
            fontSize: 'clamp(36px, 6vw, 48px)', 
            marginBottom: 'clamp(12px, 2vw, 16px)',
            filter: 'drop-shadow(0 4px 8px rgba(167, 139, 250, 0.3))'
          }}>
            PDF
          </div>
          <div style={{ fontWeight: 500, fontSize: 'clamp(14px, 2vw, 16px)' }}>
            请先在左侧生成简历
          </div>
          <div style={{ 
            fontSize: 'clamp(12px, 1.75vw, 14px)', 
            marginTop: 'clamp(6px, 1vw, 8px)',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            此处将展示 PDF 预览
          </div>
        </div>
      )}
    </div>
  )
}
