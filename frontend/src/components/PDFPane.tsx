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
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
        // 将 Blob 转换为 ArrayBuffer
        const arrayBuffer = await pdfBlob.arrayBuffer()
        console.log('PDF Blob 大小:', arrayBuffer.byteLength, 'bytes')
        
        // 加载 PDF 文档
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          verbosity: 0  // 减少日志输出
        })
        const pdf = await loadingTask.promise
        console.log('PDF 加载成功，总页数:', pdf.numPages)
        
        setNumPages(pdf.numPages)
        
        // 渲染第一页
        console.log(`开始获取第 ${pageNum} 页...`)
        const page = await pdf.getPage(pageNum)
        console.log('页面获取成功')
        
        const canvas = canvasRef.current
        if (!canvas) {
          console.error('Canvas 元素不存在')
          setLoading(false)
          return
        }
        
        const context = canvas.getContext('2d')
        if (!context) {
          console.error('无法获取 Canvas 2D 上下文')
          setLoading(false)
          return
        }
        
        // 获取设备像素比（Retina 屏幕通常是 2 或 3）
        const dpr = window.devicePixelRatio || 1
        console.log(`设备像素比 (DPR): ${dpr}`)
        
        // 计算视口尺寸
        const viewport = page.getViewport({ scale })
        console.log(`视口尺寸: ${viewport.width} x ${viewport.height}`)
        
        // 设置 Canvas 的物理尺寸（乘以 DPR 提高分辨率）
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        
        // 设置 Canvas 的 CSS 显示尺寸（保持原始大小）
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        
        console.log(`Canvas 物理尺寸: ${canvas.width} x ${canvas.height}`)
        console.log(`Canvas 显示尺寸: ${canvas.style.width} x ${canvas.style.height}`)
        
        // 缩放绘图上下文，确保内容清晰
        context.scale(dpr, dpr)
        
        // 渲染 PDF 页面，启用文本层以正确显示字体
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          enableWebGL: false,  // 禁用 WebGL，使用 Canvas 2D 确保字体正确渲染
          renderInteractiveForms: false
        }
        
        console.log('开始渲染 PDF 页面到 Canvas...')
        const renderTask = page.render(renderContext)
        
        // 添加超时处理
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('PDF 渲染超时（10秒）')), 10000)
        })
        
        try {
          await Promise.race([renderTask.promise, timeoutPromise])
          console.log('PDF 页面渲染完成')
        } catch (renderErr) {
          console.error('PDF 渲染过程出错:', renderErr)
          throw renderErr
        }
        
        setLoading(false)
        console.log('PDF 渲染状态已更新为完成')
      } catch (err) {
        console.error('PDF 渲染错误:', err)
        console.error('错误详情:', err)
        const errorMsg = err instanceof Error ? err.message : String(err)
        setError(`PDF 渲染失败: ${errorMsg}`)
        setLoading(false)
      }
    }

    // 使用 requestAnimationFrame 确保 DOM 已更新
    requestAnimationFrame(() => {
      // 再次检查 canvas 是否存在
      if (!canvasRef.current) {
        console.log('等待 Canvas 元素挂载...')
        const checkInterval = setInterval(() => {
          if (canvasRef.current) {
            clearInterval(checkInterval)
            renderPDF()
          }
        }, 50)
        // 最多等待 5 秒
        setTimeout(() => {
          clearInterval(checkInterval)
          if (!canvasRef.current) {
            console.error('Canvas 元素在 5 秒内未挂载')
            setError('Canvas 元素未找到，无法渲染 PDF')
            setLoading(false)
          }
        }, 5000)
        return
      }
      renderPDF()
    })
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
            
            {/* Canvas 始终渲染，但可能隐藏 */}
            <canvas
              ref={canvasRef}
              style={{
                display: (loading || error || !pdfBlob) ? 'none' : 'block',
                maxWidth: '100%',
                height: 'auto',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
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
