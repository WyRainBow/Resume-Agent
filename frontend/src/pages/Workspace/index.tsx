/**
 * Workspace 主页面
 * 简历编辑工作区
 * 
 * 模块化重构版本 - 将原1186行代码拆分为多个模块
 */
import React, { useCallback, useEffect } from 'react'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'

// 外部组件
import ChatPanel from '../../components/ChatPanel'
import { PDFViewerSelector } from '../../components/PDFEditor'
import { PDFProgressIndicator } from '../../components/PDFEditor/PDFProgressIndicator'
import ResumeEditor from '../../components/ResumeEditor'
import { HtmlPreview } from '../../components/ResumePreview'
import ResumeList from '../../components/ResumeList'
import AIImportDialog from '../../components/AIImportDialog'
import OnboardingGuide from '../../components/OnboardingGuide'
import { useTimer } from '../../hooks/useTimer'
import type { Resume } from '../../types/resume'
import { renderPDF, renderPDFStream, generateResumeStream, getDefaultTemplate } from '../../services/api'
import { saveResume } from '../../services/resumeStorage'

// 内部 Hooks
import { 
  useWorkspaceState, 
  useResumeOperations, 
  usePDFOperations, 
  usePanelResize,
  DEFAULT_SECTION_ORDER 
} from './hooks'

// 内部组件
import {
  Toolbar,
  PreviewToolbar,
  ZoomControl,
  BackgroundDecoration,
  globalStyles,
  LoadingOverlay,
  NavHeader,
  Divider,
  AIOutputView,
} from './components'

export default function WorkspacePage() {
  // 状态管理
  const state = useWorkspaceState()
  const pdfTimer = useTimer()
  const aiTimer = useTimer()  // AI 生成计时器

  // PDF 生成进度
  const [pdfProgress, setPdfProgress] = React.useState('')
  const [showProgress, setShowProgress] = React.useState(false)
  
  // 简历操作
  const resumeOps = useResumeOperations({
    setResume: state.setResume,
    setCurrentResumeId: state.setCurrentResumeId,
    setShowEditor: state.setShowEditor,
    setPreviewMode: state.setPreviewMode,
    setCurrentSectionOrder: state.setCurrentSectionOrder,
    setShowResumeList: state.setShowResumeList,
    setPdfBlob: state.setPdfBlob,
    setLoadingPdf: state.setLoadingPdf,
    setLastImportedText: state.setLastImportedText,
    currentResumeId: state.currentResumeId,
    resume: state.resume,
    autoSaveTimer: state.autoSaveTimer,
    pdfTimer,
    setPdfProgress,
    setShowProgress,
  })
  
  // PDF 操作
  const pdfOps = usePDFOperations({
    resume: state.resume,
    setResume: state.setResume,
    pdfBlob: state.pdfBlob,
    setPdfBlob: state.setPdfBlob,
    pdfDirty: state.pdfDirty,
    setPdfDirty: state.setPdfDirty,
    loadingPdf: state.loadingPdf,
    setLoadingPdf: state.setLoadingPdf,
    currentSectionOrder: state.currentSectionOrder,
    setCurrentSectionOrder: state.setCurrentSectionOrder,
    setPreviewMode: state.setPreviewMode,
    currentResumeId: state.currentResumeId,
    setShowEditor: state.setShowEditor,
    autoSave: resumeOps.autoSave,
    previewDebounceRef: state.previewDebounceRef,
    pdfTimer,
    setPdfProgress,
    setShowProgress,
  })
  
  // 分割条拖拽
  const { handleMouseDown } = usePanelResize({
    isDragging: state.isDragging,
    setIsDragging: state.setIsDragging,
    setLeftPanelWidth: state.setLeftPanelWidth,
    containerRef: state.containerRef,
  })
  
  /**
   * 流式生成简历
   */
  const handleStreamGenerate = useCallback(async (instruction: string) => {
    // 切换到 AI 输出视图
    state.setRightView('ai-output')
    state.setAiOutput('')
    state.setAiGenerating(true)
    state.setAiGeneratingStatus('streaming')
    state.setPendingResumeJson(null)
    
    // 启动计时器
    aiTimer.startTimer()
    
    await generateResumeStream(instruction, 'zh', {
      onMarkdown: (chunk) => {
        // 使用 flushSync 强制同步更新，实现真正的流式效果
        flushSync(() => {
          state.setAiOutput(prev => prev + chunk)
        })
      },
      onStatus: (status) => {
        flushSync(() => {
          state.setAiGeneratingStatus(status)
        })
      },
      onComplete: (resume) => {
        flushSync(() => {
          state.setPendingResumeJson(resume)
          state.setAiGenerating(false)
          state.setAiGeneratingStatus('done')
        })
        // 停止计时器
        aiTimer.stopTimer()
      },
      onError: (error) => {
        console.error('流式生成失败:', error)
        flushSync(() => {
          state.setAiGenerating(false)
          state.setAiGeneratingStatus('error')
        })
        // 停止计时器
        aiTimer.stopTimer()
      }
    })
  }, [state, aiTimer])

  /**
   * 更新预览 - 从 AI 输出切换到 PDF 视图（使用流式API显示进度）
   */
  const handleUpdatePreview = useCallback(async () => {
    if (!state.pendingResumeJson) return

    // 设置简历数据
    state.setResume(state.pendingResumeJson)
    state.setLoadingPdf(true)
    state.setRightView('pdf')
    setShowProgress(true)
    setPdfProgress('开始生成 PDF...')

    try {
      // 使用流式PDF渲染API，显示进度
      const blob = await renderPDFStream(
        state.pendingResumeJson,
        state.currentSectionOrder,
        // 进度回调
        (progress) => {
          setPdfProgress(progress)
        },
        // PDF数据回调
        (pdfData) => {
          setPdfProgress('PDF 生成完成！')
        },
        // 错误回调
        (error) => {
          setPdfProgress(`错误: ${error}`)
        }
      )

      state.setPdfBlob(blob)
      state.setShowEditor(true)

      // 自动保存
      resumeOps.autoSave(state.pendingResumeJson)
    } catch (err) {
      console.error('PDF 渲染失败:', err)
      setPdfProgress('渲染失败，请重试')
      alert('PDF 渲染失败，请重试')
    } finally {
      state.setLoadingPdf(false)
      setShowProgress(false)
    }
  }, [state, resumeOps])

  /**
   * 新建简历 - 创建新的默认模板
   */
  const handleNewResume = useCallback(async () => {
    // 设置加载状态
    state.setLoadingPdf(true)
    setShowProgress(true)
    setPdfProgress('创建新简历...')

    try {
      // 获取默认模板
      const newTemplate = getDefaultTemplate()

      // 设置简历数据
      state.setResume(newTemplate)
      state.setShowEditor(true)
      state.setPreviewMode('pdf')
      state.setCurrentSectionOrder(DEFAULT_SECTION_ORDER)
      state.setShowResumeList(false)

      // 使用流式渲染PDF
      const blob = await renderPDFStream(
        newTemplate,
        DEFAULT_SECTION_ORDER,
        // 进度回调
        (progress) => {
          setPdfProgress(progress)
        },
        // PDF数据回调
        (pdfData) => {
          setPdfProgress('新简历创建完成！')
        },
        // 错误回调
        (error) => {
          setPdfProgress(`错误: ${error}`)
        }
      )

      state.setPdfBlob(blob)

      // 自动保存为新简历
      const saved = saveResume(newTemplate)
      state.setCurrentResumeId(saved.id)
      console.log('新简历已保存，ID:', saved.id)

      // 清除编辑状态
      state.setPdfDirty(false)
    } catch (error) {
      console.error('创建新简历失败:', error)
      alert('创建新简历失败，请重试')
    } finally {
      state.setLoadingPdf(false)
      setShowProgress(false)
    }
  }, [state, setPdfProgress, setShowProgress])

  /**
   * AI 自动优化 - 视觉反思修正
   */
  const handleAIOptimize = useCallback(async () => {
    if (!state.resume || !state.previewRef.current) {
      alert('请先加载简历')
      return
    }

    const textToUse = state.lastImportedText?.trim() || JSON.stringify(state.resume)
    if (!textToUse.trim()) {
      alert('缺少原始文本或简历数据。无法进行 AI 排版优化')
      return
    }

    state.setOptimizing(true)
    
    try {
      const canvas = await html2canvas(state.previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      })
      const screenshotBase64 = canvas.toDataURL('image/png').split(',')[1]
      
      const response = await fetch('/api/agent/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_text: textToUse,
          current_json: state.resume,
          screenshot_base64: screenshotBase64,
          max_iterations: 2
        })
      })
      
      if (!response.ok) {
        throw new Error('优化失败')
      }
      
      const result = await response.json()
      
      if (result.final_json) {
        state.setResume(result.final_json)
        
        renderPDF(result.final_json, false, state.currentSectionOrder)
          .then(blob => state.setPdfBlob(blob))
          .catch(err => console.log('PDF 重新生成失败:', err))
        
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
      state.setOptimizing(false)
    }
  }, [state])

  // 初始化 - 只在组件挂载时执行一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const instruction = sessionStorage.getItem('resume_instruction')

    if (instruction) {
      sessionStorage.removeItem('resume_instruction')
      // 从首页跳转时，触发流式生成
      handleStreamGenerate(instruction)
    } else {
      // 无论是否有保存的简历，都先加载默认模板
      // 直接内联加载逻辑，避免依赖问题
      const loadDefaultTemplate = async () => {
        // 设置加载状态
        state.setLoadingPdf(true)
        setShowProgress(true)
        setPdfProgress('加载默认模板...')

        try {
          // 获取默认模板
          const defaultTemplate = getDefaultTemplate()

          // 设置简历数据
          state.setResume(defaultTemplate)
          state.setShowEditor(true)
          state.setPreviewMode('pdf')
          state.setCurrentSectionOrder(DEFAULT_SECTION_ORDER)

          // 使用流式渲染PDF
          const blob = await renderPDFStream(
            defaultTemplate,
            DEFAULT_SECTION_ORDER,
            (progress) => {
              setPdfProgress(progress)
            },
            (pdfData) => {
              setPdfProgress('模板加载完成！')
            },
            (error) => {
              setPdfProgress(`错误: ${error}`)
            }
          )

          state.setPdfBlob(blob)

          // 自动保存默认模板为新简历
          try {
            const saved = saveResume(defaultTemplate)
            state.setCurrentResumeId(saved.id)
          } catch (error) {
            console.error('自动保存默认模板失败:', error)
          }
        } catch (error) {
          console.error('加载默认模板失败:', error)
          alert('加载默认模板失败')
        } finally {
          state.setLoadingPdf(false)
          setShowProgress(false)
        }
      }

      loadDefaultTemplate()
    }
  }, [])

  
  return (
    <div 
      ref={state.containerRef}
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
      {/* 弹窗组件 */}
      <AIImportDialog
        isOpen={state.showAIImport}
        onClose={() => state.setShowAIImport(false)}
        onImport={resumeOps.handleAIImport}
      />
      <OnboardingGuide 
        visible={state.showGuide} 
        onClose={() => state.setShowGuide(false)}
        onLoadDemo={resumeOps.handleLoadDemo}
        pdfBlob={state.pdfBlob}
      />

      {/* 背景装饰 */}
      <BackgroundDecoration />
      <style>{globalStyles}</style>

      {/* 左侧面板 */}
      <div 
        className="left-panel"
        style={{ 
          width: state.leftPanelWidth !== null ? `${state.leftPanelWidth}px` : '30%',
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
        <NavHeader />
        
        <Toolbar
          showEditor={state.showEditor}
          setShowEditor={state.setShowEditor}
          showResumeList={state.showResumeList}
          setShowResumeList={state.setShowResumeList}
          setShowAIImport={state.setShowAIImport}
          setShowGuide={state.setShowGuide}
          onReset={resumeOps.loadResume}
          onAIOptimize={handleAIOptimize}
          onNewResume={handleNewResume}
          loadingPdf={state.loadingPdf}
          optimizing={state.optimizing}
          hasResume={!!state.resume}
        />

        {/* 简历列表 */}
        {state.showResumeList && (
          <div style={{ 
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            <ResumeList
              onSelect={resumeOps.handleSelectResume}
              onCreateNew={resumeOps.handleCreateNew}
              currentId={state.currentResumeId}
            />
          </div>
        )}

        {/* 内容区域 */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {state.showEditor && state.resume ? (
            <ResumeEditor
              resumeData={state.resume}
              onSave={pdfOps.handleEditorSave}
              onSaveAndRender={pdfOps.handleSaveAndRender}
              saving={state.loadingPdf}
            />
          ) : (
            <div style={{ height: '100%', overflowY: 'auto' }}>
              <ChatPanel 
                onResume={pdfOps.handleResumeChange} 
                onLoadDemo={resumeOps.handleLoadDemo} 
                pdfBlob={state.pdfBlob}
                initialInstruction={state.initialInstruction}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* 分割条 */}
      <Divider 
        isDragging={state.isDragging} 
        onMouseDown={handleMouseDown} 
      />
      
      {/* 右侧面板 */}
      <div 
        className="right-panel"
        style={{ 
          flex: 1, 
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {state.rightView === 'pdf' && (
          <PreviewToolbar
            pdfDirty={state.pdfDirty}
            loadingPdf={state.loadingPdf}
            hasResume={!!state.resume}
            onSaveAndRender={pdfOps.handleSaveAndRender}
            onDownload={pdfOps.handleDownloadPDF}
            pdfTimer={pdfTimer}
          />
        )}
        
        {/* 预览内容 */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {state.rightView === 'ai-output' ? (
            // AI 流式输出视图
            <AIOutputView
              content={state.aiOutput}
              status={state.aiGeneratingStatus}
              onUpdatePreview={handleUpdatePreview}
              elapsedTime={aiTimer.elapsedTime}
              finalTime={aiTimer.finalTime}
              formatTime={aiTimer.formatTime}
              getTimeColor={aiTimer.getTimeColor}
            />
          ) : (
            // PDF 预览视图
            <>
              <LoadingOverlay visible={state.loadingPdf && state.previewMode === 'pdf' && !showProgress} />

              {/* PDF 生成进度指示器 */}
              <PDFProgressIndicator
                progress={pdfProgress}
                visible={showProgress}
              />

              <PDFViewerSelector
                pdfBlob={state.pdfBlob}
                scale={state.previewScale}
                onContentChange={pdfOps.handlePDFContentChange}
              />

              <ZoomControl
                scale={state.previewScale}
                setScale={state.setPreviewScale}
              />
            </>
          )}
          
          {/* 隐藏的 HTML 预览 AI 不读取 */}
          <div 
            ref={state.previewRef} 
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
              resume={state.resume} 
              sectionOrder={state.currentSectionOrder} 
              scale={1}
              onUpdate={(updatedResume: Resume) => {
                state.setResume(updatedResume)
                resumeOps.autoSave(updatedResume)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
