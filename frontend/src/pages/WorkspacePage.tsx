import React, { useState, useCallback, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import { useNavigate } from 'react-router-dom'
import ChatPanel from '../components/ChatPanel'
import PDFPane from '../components/PDFPane'
import ResumeEditor from '../components/ResumeEditor'
import { HtmlPreview } from '../components/ResumePreview'
import ResumeList from '../components/ResumeList'
import AIImportDialog from '../components/AIImportDialog'
import OnboardingGuide from '../components/OnboardingGuide'
import type { Resume } from '../types/resume'
import { renderPDF, getDefaultTemplate } from '../services/api'
import { 
  getAllResumes, 
  getResume, 
  saveResume, 
  getCurrentResumeId, 
  setCurrentResumeId 
} from '../services/resumeStorage'

export default function WorkspacePage() {
  const navigate = useNavigate()
  const [resume, setResume] = useState<Resume | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [showEditor, setShowEditor] = useState(true) // 默认显示可视化编辑器
  const [showGuide, setShowGuide] = useState(false)
  const [showResumeList, setShowResumeList] = useState(false) // 显示简历列表
  const [showAIImport, setShowAIImport] = useState(false) // 显示 AI 导入弹窗
  const [currentResumeId, setCurrentResumeIdState] = useState<string | null>(null) // 当前简历ID
  const [lastImportedText, setLastImportedText] = useState('') // 最后导入的原始文本
  const [optimizing, setOptimizing] = useState(false) // AI 优化中
  const previewRef = useRef<HTMLDivElement>(null) // 预览区域引用
  const [previewMode, setPreviewMode] = useState<'live' | 'pdf'>('pdf') // 预览模式：默认PDF预览（HTML预览已隐藏）
  const [currentSectionOrder, setCurrentSectionOrder] = useState<string[]>([]) // 当前模块顺序
  const [leftPanelWidth, setLeftPanelWidth] = useState<number | null>(null) // 左侧面板宽度，初始为 null 表示使用百分比
  const [isDragging, setIsDragging] = useState(false) // 是否正在拖拽分割条
  const [previewScale, setPreviewScale] = useState(1.0) // 预览缩放比例，公共状态
  const containerRef = useRef<HTMLDivElement>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  /**
   * 从首页传递过来的指令
   */
  const [initialInstruction, setInitialInstruction] = useState<string | null>(null)

  const defaultSectionOrder = ['education', 'experience', 'projects', 'opensource', 'skills', 'awards', 'summary']

  /**
   * 加载简历（优先从 localStorage，否则从后端模板）
   */
  const loadResume = useCallback(async () => {
    // 检查是否有保存的简历
    const savedId = getCurrentResumeId()
    if (savedId) {
      const saved = getResume(savedId)
      if (saved) {
        setResume(saved.data)
        setCurrentResumeIdState(savedId)
        setShowEditor(true)
        setPreviewMode('pdf')
        setCurrentSectionOrder(defaultSectionOrder)
        renderPDF(saved.data, false, defaultSectionOrder)
          .then(blob => setPdfBlob(blob))
          .catch(err => console.log('PDF 后台生成失败:', err))
        return
      }
    }
    
    // 检查是否有任何保存的简历
    const allResumes = getAllResumes()
    if (allResumes.length > 0) {
      const first = allResumes[0]
      setResume(first.data)
      setCurrentResumeIdState(first.id)
      setCurrentResumeId(first.id)
      setShowEditor(true)
      setPreviewMode('pdf')
      setCurrentSectionOrder(defaultSectionOrder)
      renderPDF(first.data, false, defaultSectionOrder)
        .then(blob => setPdfBlob(blob))
        .catch(err => console.log('PDF 后台生成失败:', err))
      return
    }

    // 没有保存的简历，加载默认模板
    try {
      const template = await getDefaultTemplate() as unknown as Resume
      setResume(template)
      setShowEditor(true)
      setPreviewMode('pdf')
      setCurrentSectionOrder(defaultSectionOrder)
      // 自动保存为新简历
      const saved = saveResume(template)
      setCurrentResumeIdState(saved.id)
      
      renderPDF(template, false, defaultSectionOrder)
        .then(blob => setPdfBlob(blob))
        .catch(err => console.log('PDF 后台生成失败:', err))
    } catch (error) {
      console.error('Failed to load template:', error)
      alert('加载模板失败，请检查后端服务是否正常。')
    }
  }, [])

  /**
   * 新建简历
   */
  const handleCreateNew = useCallback(async () => {
    try {
      const template = await getDefaultTemplate() as unknown as Resume
      const saved = saveResume(template)
      setResume(template)
      setCurrentResumeIdState(saved.id)
      setShowEditor(true)
      setPreviewMode('pdf')
      setCurrentSectionOrder(defaultSectionOrder)
      setShowResumeList(false)
    } catch (error) {
      console.error('Failed to create new resume:', error)
    }
  }, [])

  /**
   * 选择简历
   */
  const handleSelectResume = useCallback((resumeData: Resume, id: string) => {
    setResume(resumeData)
    setCurrentResumeIdState(id)
    setShowEditor(true)
    setPreviewMode('pdf')
    setCurrentSectionOrder(defaultSectionOrder)
    setShowResumeList(false)
    renderPDF(resumeData, false, defaultSectionOrder)
      .then(blob => setPdfBlob(blob))
      .catch(err => console.log('PDF 后台生成失败:', err))
  }, [])

  /**
   * 自动保存（防抖）
   */
  const autoSave = useCallback((resumeData: Resume) => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
    }
    autoSaveTimer.current = setTimeout(() => {
      if (currentResumeId) {
        saveResume(resumeData, currentResumeId)
      }
    }, 1000) // 1秒防抖
  }, [currentResumeId])

  /**
   * AI 导入简历
   */
  const handleAIImport = useCallback((importedResume: Resume, saveToList: boolean, originalText: string) => {
    setResume(importedResume)
    setLastImportedText(originalText) // 保存原始文本
    setShowEditor(true)
    setPreviewMode('pdf')
    setCurrentSectionOrder(defaultSectionOrder)
    
    if (saveToList) {
      // 保存到我的简历
      const saved = saveResume(importedResume)
      setCurrentResumeIdState(saved.id)
    } else {
      // 仅预览，不保存到列表
      setCurrentResumeIdState(null)
    }
    
    // 生成 PDF
    renderPDF(importedResume, false, defaultSectionOrder)
      .then(blob => setPdfBlob(blob))
      .catch(err => console.log('PDF 后台生成失败:', err))
  }, [])

  /**
   * AI 自动优化 - 视觉反思修正
   * 使用隐藏的 HTML 预览进行截图分析
   */
  const handleAIOptimize = useCallback(async () => {
    if (!resume || !previewRef.current) {
      alert('请先加载简历')
      return
    }

    // 自动使用已有的原始文本；若无，则用当前 JSON 序列化，避免手动粘贴
    const textToUse = lastImportedText?.trim() || JSON.stringify(resume)
    if (!textToUse.trim()) {
      alert('缺少原始文本或简历数据，无法进行 AI 排版优化')
      return
    }

    setOptimizing(true)
    
    try {
      // 1. 截图预览区域
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      })
      const screenshotBase64 = canvas.toDataURL('image/png').split(',')[1]
      
      // 2. 调用 Agent 反思接口
      const response = await fetch('/api/agent/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_text: textToUse,
          current_json: resume,
          screenshot_base64: screenshotBase64,
          max_iterations: 2
        })
      })
      
      if (!response.ok) {
        throw new Error('优化失败')
      }
      
      const result = await response.json()
      
      // 3. 更新简历数据
      if (result.final_json) {
        setResume(result.final_json)
        
        // 重新生成 PDF
        renderPDF(result.final_json, false, currentSectionOrder)
          .then(blob => setPdfBlob(blob))
          .catch(err => console.log('PDF 重新生成失败:', err))
        
        // 显示优化结果
        const changes = result.changes?.join('\n') || '无修改'
        const vision = typeof result.vision_analysis === 'string' 
          ? result.vision_analysis 
          : JSON.stringify(result.vision_analysis || {}, null, 2)
        alert(
          `AI 排版优化完成（自动截图→视觉分析→修正 JSON）\n` +
          `迭代次数: ${result.iterations}\n` +
          `视觉分析: ${vision || '暂无'}\n` +
          `修改记录:\n${changes}`
        )
      }
    } catch (err) {
      console.error('AI 优化排版失败:', err)
      alert('AI 优化排版失败，请稍后重试')
    } finally {
      setOptimizing(false)
    }
  }, [resume, lastImportedText, currentSectionOrder])

  /**
   * 手动保存当前简历到列表
   */
  const handleSaveToList = useCallback(() => {
    if (resume) {
      const saved = saveResume(resume, currentResumeId || undefined)
      setCurrentResumeIdState(saved.id)
      alert('已保存到我的简历！')
    }
  }, [resume, currentResumeId])

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
      loadResume()
    }
  }, [loadResume])

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
    autoSave(newResume) // 自动保存到 localStorage
    
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
  }, [previewMode, currentSectionOrder, autoSave])
  
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
      {/* AI 导入弹窗 */}
      <AIImportDialog
        isOpen={showAIImport}
        onClose={() => setShowAIImport(false)}
        onImport={handleAIImport}
      />

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
              Resume Agent
            </div>
          </div>
        </div>

        {/* 工具栏 - 改为两行布局 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(0, 0, 0, 0.05)',
          gap: '12px',
        }}>
          {/* 第一行：视图切换 + 基础操作 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             {/* 视图切换 */}
            <div style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              <button
                onClick={() => setShowEditor(false)}
                style={{
                  padding: '4px 10px',
                  background: !showEditor ? 'rgba(167, 139, 250, 0.5)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: !showEditor ? 'white' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                JSON
              </button>
              <button
                onClick={() => setShowEditor(true)}
                style={{
                  padding: '4px 10px',
                  background: showEditor ? 'rgba(167, 139, 250, 0.5)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: showEditor ? 'white' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                可视化
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {/* 重置 */}
              <button
                onClick={loadResume}
                disabled={loadingPdf}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '6px',
                  color: '#fca5a5',
                  padding: '6px 10px',
                  fontSize: '12px',
                  cursor: loadingPdf ? 'not-allowed' : 'pointer',
                  opacity: loadingPdf ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                重置
              </button>

              {/* 我的简历 */}
              <button
                onClick={() => setShowResumeList(!showResumeList)}
                style={{
                  background: showResumeList ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                  border: showResumeList ? '1px solid rgba(102, 126, 234, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#e9d5ff',
                  padding: '6px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                我的简历
              </button>
            </div>
          </div>

          {/* 第二行：核心功能按钮 - 等宽排列 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px' }}>
            <button
              onClick={() => setShowAIImport(true)}
              style={{
                height: '32px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                borderRadius: '6px',
                color: '#e9d5ff',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              AI导入
            </button>

            <button
              onClick={handleSaveToList}
              disabled={!resume}
              style={{
                height: '32px',
                background: currentResumeId 
                  ? 'rgba(34, 197, 94, 0.15)' 
                  : 'rgba(251, 191, 36, 0.15)',
                border: currentResumeId 
                  ? '1px solid rgba(34, 197, 94, 0.3)' 
                  : '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '6px',
                color: currentResumeId ? '#86efac' : '#fcd34d',
                fontSize: '12px',
                fontWeight: 500,
                cursor: resume ? 'pointer' : 'not-allowed',
                opacity: resume ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {currentResumeId ? '已保存' : '保存'}
            </button>

            <button
              onClick={handleAIOptimize}
              disabled={!resume || optimizing}
              style={{
                height: '32px',
                background: optimizing 
                  ? 'rgba(239, 68, 68, 0.2)' 
                  : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#fca5a5',
                fontSize: '12px',
                fontWeight: 500,
                cursor: (!resume || optimizing) ? 'not-allowed' : 'pointer',
                opacity: !resume ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              {optimizing ? '排版中' : 'AI排版'}
            </button>
            
            <button
              onClick={() => setShowGuide(true)}
              style={{
                height: '32px',
                padding: '0 10px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#c4b5fd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
              }}
              title="查看引导"
            >
              引导
            </button>
          </div>
        </div>

        {/* 简历列表 */}
        {showResumeList && (
          <div style={{ 
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            <ResumeList
              onSelect={handleSelectResume}
              onCreateNew={handleCreateNew}
              currentId={currentResumeId}
            />
          </div>
        )}

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
        {/* 预览工具栏 - PDF 预览 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.2)',
        }}>
          {/* 标题 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#a78bfa',
            fontSize: '14px',
            fontWeight: 500,
          }}>
            <span>📄</span>
            PDF 预览
            {loadingPdf && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>（生成中...）</span>}
          </div>
          
          {/* 下载 PDF 按钮 */}
          <button
            onClick={() => {
              if (pdfBlob) {
                const url = URL.createObjectURL(pdfBlob)
                const link = document.createElement('a')
                link.href = url
                link.download = `resume_${new Date().toISOString().split('T')[0]}.pdf`
                link.click()
                URL.revokeObjectURL(url)
              }
            }}
            disabled={!pdfBlob}
            style={{
              padding: '6px 14px',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '6px',
              color: '#60a5fa',
              fontSize: '12px',
              cursor: !pdfBlob ? 'not-allowed' : 'pointer',
              opacity: !pdfBlob ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            下载 PDF
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
          
          {/* PDF 预览 */}
          <PDFPane pdfBlob={pdfBlob} scale={previewScale} onScaleChange={setPreviewScale} />
          
          {/* 隐藏的 HTML 预览，用于 AI 排版截图功能 */}
          <div 
            ref={previewRef} 
            style={{ 
              position: 'absolute', 
              left: '-9999px', 
              top: 0, 
              width: '210mm', 
              height: '297mm',
              background: 'white',
            }}
          >
            <HtmlPreview 
              resume={resume} 
              sectionOrder={currentSectionOrder} 
              scale={1}
              onUpdate={(updatedResume: Resume) => {
                setResume(updatedResume)
                autoSave(updatedResume)
              }}
            />
          </div>
          
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
