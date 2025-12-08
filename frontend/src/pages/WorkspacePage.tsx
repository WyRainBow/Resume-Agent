import React, { useState, useCallback, useEffect, useRef } from 'react'
import html2pdf from 'html2pdf.js'
import { useNavigate } from 'react-router-dom'
import ChatPanel from '../components/ChatPanel'
import PDFPane from '../components/PDFPane'
import ResumeEditor from '../components/ResumeEditor'
import ResumePreview from '../components/ResumePreview'
import OnboardingGuide from '../components/OnboardingGuide'
import type { Resume } from '../types/resume'
import { renderPDF, getDefaultTemplate } from '../services/api'

export default function WorkspacePage() {
  const navigate = useNavigate()
  const [resume, setResume] = useState<Resume | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [showEditor, setShowEditor] = useState(true) // 默认显示可视化编辑器
  const [showGuide, setShowGuide] = useState(false)
  const [previewMode, setPreviewMode] = useState<'live' | 'pdf'>('live') // 预览模式：live=实时预览，pdf=PDF预览
  const [currentSectionOrder, setCurrentSectionOrder] = useState<string[]>([]) // 当前模块顺序
  const [leftPanelWidth, setLeftPanelWidth] = useState<number | null>(null) // 左侧面板宽度，初始为 null 表示使用百分比
  const [isDragging, setIsDragging] = useState(false) // 是否正在拖拽分割条
  const [previewScale, setPreviewScale] = useState(1.0) // 预览缩放比例，公共状态
  const containerRef = useRef<HTMLDivElement>(null)
  
  /**
   * 从首页传递过来的指令
   */
  const [initialInstruction, setInitialInstruction] = useState<string | null>(null)

  /**
   * 加载默认模板（从后端 test_resume_demo.json 加载）
   * 1. 先加载数据 → 立即显示实时预览
   * 2. 异步后台生成 PDF（不阻塞用户）
   */
  const loadDefaultTemplate = useCallback(async () => {
    try {
      // 1. 加载模板数据
      const template = await getDefaultTemplate() as unknown as Resume
      setResume(template)
      setShowEditor(true)
      setPreviewMode('live') // 默认显示实时预览
      
      // 设置默认 section 顺序
      const defaultSectionOrder = ['education', 'experience', 'projects', 'skills', 'awards', 'summary']
      setCurrentSectionOrder(defaultSectionOrder)
      
      // 2. 异步后台生成 PDF（不阻塞实时预览）
      renderPDF(template, false, defaultSectionOrder)
        .then(blob => setPdfBlob(blob))
        .catch(err => console.log('PDF 后台生成失败:', err))
        
    } catch (error) {
      console.error('Failed to load template:', error)
      alert('加载模板失败，请检查后端服务是否正常。')
    }
  }, [])

  // 分割条拖拽处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const newWidth = e.clientX - containerRect.left
    // 限制宽度范围：280px ~ 50%
    const maxWidth = containerRect.width * 0.5
    setLeftPanelWidth(Math.max(280, Math.min(newWidth, maxWidth)))
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 监听全局鼠标事件
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // 预览缩放比例固定为 100%，用户可通过底部 +/- 按钮手动调整
  // 不自动计算，确保默认始终是 100%

  useEffect(() => {
    // 检查是否有从首页传递过来的指令
    const instruction = sessionStorage.getItem('resume_instruction')
    if (instruction) {
      setInitialInstruction(instruction)
      // 清除，避免重复触发
      sessionStorage.removeItem('resume_instruction')
    } else {
      // 没有指令时，加载默认模板
      loadDefaultTemplate()
    }
  }, [loadDefaultTemplate])

  const handleResumeChange = useCallback(async (newResume: Resume) => {
    setResume(newResume)
    setShowEditor(true) // 生成后自动切换到编辑器
    setLoadingPdf(true)
    try {
      const blob = await renderPDF(newResume, false)
      setPdfBlob(blob)
    } catch (error) {
      console.error('Failed to render PDF:', error)
      alert('PDF 渲染失败，请检查后端服务是否正常。')
    } finally {
      setLoadingPdf(false)
    }
  }, [])

  /**
   * 从编辑器保存简历
   * - 实时预览模式：只更新状态（立即刷新预览）
   * - PDF 预览模式：更新状态并重新生成 PDF
   */
  const handleEditorSave = useCallback(async (newResume: Resume, sectionOrder?: string[]) => {
    setResume(newResume)
    const newOrder = sectionOrder || currentSectionOrder
    if (sectionOrder) {
      setCurrentSectionOrder(sectionOrder)
    }
    
    // PDF 预览模式下，点击保存也要更新 PDF
    if (previewMode === 'pdf') {
      setLoadingPdf(true)
      try {
        const blob = await renderPDF(newResume, false, newOrder.length > 0 ? newOrder : undefined)
        setPdfBlob(blob)
      } catch (error) {
        console.error('Failed to render PDF:', error)
        alert('PDF 渲染失败，请检查后端服务是否正常。')
      } finally {
        setLoadingPdf(false)
      }
    }
  }, [previewMode, currentSectionOrder])
  
  /**
   * 生成 PDF（用于下载或查看最终效果）
   */
  const generatePDF = useCallback(async () => {
    if (!resume) return
    setLoadingPdf(true)
    setPreviewMode('pdf')
    try {
      const blob = await renderPDF(resume, false, currentSectionOrder.length > 0 ? currentSectionOrder : undefined)
      setPdfBlob(blob)
    } catch (error) {
      console.error('Failed to render PDF:', error)
      alert('PDF 渲染失败，请检查后端服务是否正常。')
    } finally {
      setLoadingPdf(false)
    }
  }, [resume, currentSectionOrder])

  const handleLoadDemo = useCallback(async () => {
    setLoadingPdf(true)
    try {
      const blob = await renderPDF({} as Resume, true)
      setPdfBlob(blob)
    } catch (error) {
      console.error('Failed to load demo PDF:', error)
      alert('Demo PDF 加载失败，请检查后端服务是否正常。')
    } finally {
      setLoadingPdf(false)
    }
  }, [])

  return (
    <div 
      ref={containerRef}
      className="main-container"
      style={{ 
        display: 'flex', 
        height: '100vh',
        width: '100vw',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 新手引导弹窗 */}
      <OnboardingGuide 
        visible={showGuide} 
        onClose={() => setShowGuide(false)}
        onLoadDemo={handleLoadDemo}
        pdfBlob={pdfBlob}
      />

      {/* 紫色渐变背景装饰 */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        animation: 'float 20s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-10%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(50px)',
        animation: 'float 15s ease-in-out infinite reverse'
      }} />
      
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(30px, -30px) rotate(5deg); }
        }
        @media (max-width: 768px) {
          .main-container {
            flex-direction: column !important;
          }
          .left-panel {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
            max-height: 50vh;
          }
          .right-panel {
            width: 100% !important;
            flex: 1 !important;
          }
        }
        @media (max-width: 480px) {
          .left-panel {
            max-height: 40vh;
          }
        }
      `}</style>

      <div 
        className="left-panel"
        style={{ 
          width: leftPanelWidth !== null ? `${leftPanelWidth}px` : '30%',
          minWidth: '280px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
          backdropFilter: 'blur(10px)',
          background: 'rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 顶部导航栏 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '8px 12px',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ← 首页
            </button>
            <div style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>😄</span>
              Resume Agent
            </div>
          </div>
        </div>

        {/* 工具栏 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(0, 0, 0, 0.05)',
        }}>
          {/* 左侧：重置 */}
          <button
            onClick={loadDefaultTemplate}
            disabled={loadingPdf}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#f87171',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: loadingPdf ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: loadingPdf ? 0.6 : 1,
            }}
          >
            🔄 重置
          </button>

          {/* 右侧：视图切换和引导 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              padding: '3px',
            }}>
              <button
                onClick={() => setShowEditor(false)}
                style={{
                  padding: '6px 12px',
                  background: !showEditor ? 'rgba(167, 139, 250, 0.4)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: !showEditor ? 'white' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                📝 JSON
              </button>
              <button
                onClick={() => setShowEditor(true)}
                style={{
                  padding: '6px 12px',
                  background: showEditor ? 'rgba(167, 139, 250, 0.4)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: showEditor ? 'white' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                ✏️ 可视化
              </button>
            </div>
            
            <button
              onClick={() => setShowGuide(true)}
              style={{
                padding: '6px 12px',
                background: 'rgba(167, 139, 250, 0.15)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                borderRadius: '8px',
                color: '#c4b5fd',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              💡 引导
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {showEditor && resume ? (
            <ResumeEditor 
              resumeData={resume} 
              onSave={handleEditorSave}
              saving={loadingPdf}
            />
          ) : (
            <div style={{ height: '100%', overflowY: 'auto' }}>
              <ChatPanel 
                onResume={handleResumeChange} 
                onLoadDemo={handleLoadDemo} 
                pdfBlob={pdfBlob}
                initialInstruction={initialInstruction}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* 可拖拽分割条 */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: '3px',
          cursor: 'col-resize',
          background: isDragging 
            ? 'rgba(167, 139, 250, 0.8)' 
            : 'rgba(255, 255, 255, 0.15)',
          transition: isDragging ? 'none' : 'background 0.2s',
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.background = 'rgba(167, 139, 250, 0.5)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
          }
        }}
      />
      
      <div 
        className="right-panel"
        style={{ 
          flex: 1, 
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          // background: '#f3f4f6', // 移除浅灰背景
          background: 'rgba(255, 255, 255, 0.05)', // 改为半透明，透出底层的渐变紫
          backdropFilter: 'blur(10px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* 预览工具栏 - 两种模板切换 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.2)',
        }}>
          {/* 模板切换按钮 */}
          <div style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '6px',
            padding: '2px',
          }}>
            <button
              onClick={() => setPreviewMode('live')}
              style={{
                padding: '6px 12px',
                background: previewMode === 'live' ? 'rgba(34, 197, 94, 0.4)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: previewMode === 'live' ? '#4ade80' : 'rgba(255, 255, 255, 0.6)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              🌐 HTML 版本
            </button>
            <button
              onClick={() => {
                setPreviewMode('pdf')
                // 切换到 LaTeX 版本时生成 PDF
                generatePDF()
              }}
              disabled={loadingPdf}
              style={{
                padding: '6px 12px',
                background: previewMode === 'pdf' ? 'rgba(167, 139, 250, 0.4)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: previewMode === 'pdf' ? '#a78bfa' : 'rgba(255, 255, 255, 0.6)',
                fontSize: '12px',
                cursor: loadingPdf ? 'not-allowed' : 'pointer',
                opacity: loadingPdf ? 0.7 : 1,
              }}
            >
              {loadingPdf && previewMode === 'pdf' ? '生成中...' : '📄 LaTeX 版本'}
            </button>
          </div>
          
          {/* 下载 PDF 按钮 */}
          <button
            onClick={() => {
              if (previewMode === 'live') {
                // HTML 版本：使用 html2pdf 直接生成并下载
                const element = document.getElementById('resume-preview')
                if (element) {
                  const opt = {
                    margin: [10, 10, 10, 10] as [number, number, number, number],
                    filename: `resume_html_${new Date().toISOString().split('T')[0]}.pdf`,
                    image: { type: 'jpeg' as const, quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
                  }
                  html2pdf().set(opt).from(element).save()
                }
              } else if (pdfBlob) {
                // LaTeX 版本：下载已生成的 PDF
                const url = URL.createObjectURL(pdfBlob)
                const link = document.createElement('a')
                link.href = url
                link.download = `resume_latex_${new Date().toISOString().split('T')[0]}.pdf`
                link.click()
                URL.revokeObjectURL(url)
              }
            }}
            disabled={previewMode === 'pdf' && !pdfBlob}
            style={{
              padding: '6px 14px',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '6px',
              color: '#60a5fa',
              fontSize: '12px',
              cursor: (previewMode === 'pdf' && !pdfBlob) ? 'not-allowed' : 'pointer',
              opacity: (previewMode === 'pdf' && !pdfBlob) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ⬇️ 下载 PDF
          </button>
        </div>
        
        {/* 预览内容 */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {loadingPdf && previewMode === 'pdf' && (
            <div style={{
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              background: 'rgba(102, 126, 234, 0.8)', 
              backdropFilter: 'blur(5px)',
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              zIndex: 10,
              color: 'white',
              fontSize: '18px',
              fontWeight: 600
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  border: '4px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '4px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                正在生成 PDF...
              </div>
            </div>
          )}
          
          {previewMode === 'live' ? (
            <ResumePreview resume={resume} sectionOrder={currentSectionOrder} scale={previewScale} />
          ) : (
            <PDFPane pdfBlob={pdfBlob} scale={previewScale} onScaleChange={setPreviewScale} />
          )}
          
          {/* 公共缩放控制条 */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            zIndex: 20,
            border: '1px solid rgba(0, 0, 0, 0.05)',
          }}>
            <button
              onClick={() => setPreviewScale(prev => Math.max(0.5, +(prev - 0.1).toFixed(1)))}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#f3f4f6',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              -
            </button>
            <span style={{ fontSize: '14px', color: '#333', minWidth: '50px', textAlign: 'center', fontWeight: 500 }}>
              {Math.round(previewScale * 100)}%
            </span>
            <button
              onClick={() => setPreviewScale(prev => Math.min(2, +(prev + 0.1).toFixed(1)))}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#f3f4f6',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
