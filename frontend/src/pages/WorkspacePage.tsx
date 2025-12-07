import React, { useState, useCallback, useEffect } from 'react'
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
  
  /**
   * 从首页传递过来的指令
   */
  const [initialInstruction, setInitialInstruction] = useState<string | null>(null)

  /**
   * 前端默认模板（fallback）
   */
  const defaultTemplate = {
    name: '张三',
    contact: {
      phone: '13800138000',
      email: 'zhangsan@example.com',
      wechat: 'zhangsan_dev',
      github: 'github.com/zhangsan',
      blog: 'zhangsan.dev'
    },
    objective: '资深前端工程师',
    education: [{
      title: '科技大学 - 计算机科学与技术',
      date: '2018.09 - 2022.06',
      city: '北京'
    }],
    internships: [{
      title: '某知名互联网公司',
      subtitle: '前端开发实习生',
      date: '2021.06 - 2021.09',
      city: '北京',
      highlights: [
        '负责公司核心业务系统的模块开发与维护，使用 React + TypeScript 技术栈。',
        '参与前端性能优化专项，通过代码分割和资源预加载，将首屏加载时间降低 30%。',
        '协助团队建立组件库文档，提升开发效率。'
      ]
    }],
    projects: [{
      title: '企业级数据可视化平台',
      date: '2021.10 - 2022.03',
      highlights: [
        '基于 D3.js 和 ECharts 开发的高性能数据可视化平台，支持千万级数据实时渲染。',
        '设计并实现自定义大屏编辑器，支持拖拽布局和动态配置，大幅降低交付成本。',
        '技术栈：React, Redux, D3.js, Webpack。'
      ]
    }],
    skills: [
      '熟练掌握 HTML5, CSS3, JavaScript (ES6+), TypeScript。',
      '深入理解 React 原理，熟悉 Vue3 及其生态。',
      '熟悉前端工程化，掌握 Webpack, Vite 等构建工具配置。',
      '了解 Node.js 后端开发，熟悉 Koa/Express 框架。'
    ],
    awards: [
      '2020-2021学年 国家奖学金',
      '第十二届蓝桥杯全国软件和信息技术专业人才大赛 省赛一等奖'
    ],
    summary: '热爱编程，对新技术保持敏锐的嗅觉。具备扎实的前端基础和良好的代码规范。善于沟通与协作，能够快速融入团队并解决问题。',
    openSource: []
  } as unknown as Resume

  /**
   * 加载默认模板并渲染 PDF
   */
  const loadDefaultTemplate = useCallback(async () => {
    setLoadingPdf(true)
    let template = defaultTemplate
    
    // 尝试从后端加载模板
    try {
      template = await getDefaultTemplate() as unknown as Resume
    } catch (error) {
      console.log('Using frontend default template')
    }
    
    setResume(template)
    setShowEditor(true)
    
    // 渲染 PDF（优先用模板数据，失败则用 demo）
    // 使用前端默认的 section 顺序
    const defaultSectionOrder = ['education', 'experience', 'projects', 'skills', 'awards', 'summary']
    try {
      const blob = await renderPDF(template, false, defaultSectionOrder)
      setPdfBlob(blob)
    } catch (e) {
      console.log('Fallback to demo PDF')
      try {
        const blob = await renderPDF({} as Resume, true)
        setPdfBlob(blob)
      } catch (e2) {
        console.error('Failed to render PDF:', e2)
      }
    }
    
    setLoadingPdf(false)
  }, [])

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
   * 从编辑器保存简历（实时预览模式下只更新状态，不触发 PDF 渲染）
   */
  const handleEditorSave = useCallback(async (newResume: Resume, sectionOrder?: string[]) => {
    setResume(newResume)
    if (sectionOrder) {
      setCurrentSectionOrder(sectionOrder)
    }
    // 实时预览模式下不触发 PDF 渲染，只更新预览
    // PDF 在用户切换到 PDF 模式或下载时生成
  }, [])
  
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
          width: '40%', 
          minWidth: '380px',
          maxWidth: '550px',
          position: 'relative',
          zIndex: 1,
          backdropFilter: 'blur(10px)',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.2)',
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
      <div 
        className="right-panel"
        style={{ 
          flex: 1, 
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          backdropFilter: 'blur(10px)',
          background: 'rgba(255, 255, 255, 0.05)',
          boxShadow: 'inset 0 0 50px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* 预览工具栏 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.2)',
        }}>
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
              ⚡ 实时预览
            </button>
            <button
              onClick={() => {
                setPreviewMode('pdf')
                if (!pdfBlob) generatePDF()
              }}
              style={{
                padding: '6px 12px',
                background: previewMode === 'pdf' ? 'rgba(167, 139, 250, 0.4)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: previewMode === 'pdf' ? '#a78bfa' : 'rgba(255, 255, 255, 0.6)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              📄 PDF 预览
            </button>
          </div>
          
          <button
            onClick={generatePDF}
            disabled={loadingPdf || !resume}
            style={{
              padding: '6px 14px',
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '6px',
              color: '#4ade80',
              fontSize: '12px',
              cursor: (loadingPdf || !resume) ? 'not-allowed' : 'pointer',
              opacity: (loadingPdf || !resume) ? 0.5 : 1,
            }}
          >
            {loadingPdf ? '生成中...' : '🔄 生成 PDF'}
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
            <ResumePreview resume={resume} sectionOrder={currentSectionOrder} />
          ) : (
            <PDFPane pdfBlob={pdfBlob} />
          )}
        </div>
      </div>
    </div>
  )
}
