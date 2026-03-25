/**
 * HTML 模板工作区
 * 专门用于 HTML 模板的实时编辑和预览
 * 无需渲染按钮，所有编辑即时生效
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { cn } from '../../../../lib/utils'
import { saveResume, setCurrentResumeId } from '../../../../services/resumeStorage'
import html2pdf from 'html2pdf.js'

// Hooks
import { useResumeData, usePDFOperations, useAIImport } from '../hooks'

// 组件
import EditPreviewLayout from '../EditPreviewLayout'
import AIImportModal from '../shared/AIImportModal'
import WorkspaceLayout from '@/pages/WorkspaceLayout'

type EditMode = 'click' | 'scroll'

export default function HTMLWorkspace() {
  const { resumeId } = useParams<{ resumeId?: string }>()
  // 编辑模式状态 - HTML 模板默认使用滚动编辑模式
  const [editMode, setEditMode] = useState<EditMode>('scroll')
  
  // 跟踪编辑状态和保存状态
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [initialResumeData, setInitialResumeData] = useState<any>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)

  // 简历数据管理
  const {
    resumeData,
    setResumeData,
    activeSection,
    setActiveSection,
    currentResumeId,
    setCurrentId,
    updateBasicInfo,
    updateProject,
    deleteProject,
    reorderProjects,
    updateExperience,
    deleteExperience,
    reorderExperiences,
    updateEducation,
    deleteEducation,
    reorderEducations,
    updateOpenSource,
    deleteOpenSource,
    reorderOpenSources,
    updateAward,
    deleteAward,
    reorderAwards,
    addCustomItem,
    updateCustomItem,
    deleteCustomItem,
    updateSkillContent,
    updateMenuSections,
    reorderSections,
    toggleSectionVisibility,
    updateGlobalSettings,
    addCustomSection,
  } = useResumeData()

  // PDF 操作 - HTML 模板主要用于导出
  const {
    pdfBlob,
    loading,
    progress,
    saveSuccess,
    handleRender,
    handleDownload,
    handleSaveToDashboard,
  } = usePDFOperations({ resumeData, currentResumeId, setCurrentId })

  // AI 导入
  const {
    aiModalOpen,
    aiModalSection,
    aiModalTitle,
    setAiModalOpen,
    handleAIImport,
    handleGlobalAIImport,
    handleAISave,
  } = useAIImport({ setResumeData })

  // 文件输入引用（用于导入 JSON）
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 防抖保存定时器
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedDataRef = useRef<string>('')

  // 自动保存函数（防抖）
  const autoSave = useCallback(() => {
    // 清除之前的定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    
    // 设置新的定时器，500ms 后保存
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const currentDataStr = JSON.stringify(resumeData)
          // 只有当数据真正变化时才保存
          if (currentDataStr !== lastSavedDataRef.current) {
            const saved = await saveResume(resumeData, currentResumeId || undefined)
            // 如果保存后获得了新的 ID，更新 currentResumeId
            if (!currentResumeId && saved.id) {
              setCurrentId(saved.id)
              setCurrentResumeId(saved.id)
            }
            lastSavedDataRef.current = currentDataStr
            console.log('自动保存成功', saved.id)
          }
        } catch (error) {
          console.error('自动保存失败:', error)
        }
      })()
    }, 500)
  }, [resumeData, currentResumeId, setCurrentId])

  // 立即保存函数（用于失焦时）
  const saveImmediately = useCallback(() => {
    // 清除防抖定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    
    void (async () => {
      try {
        const currentDataStr = JSON.stringify(resumeData)
        if (currentDataStr !== lastSavedDataRef.current) {
          const saved = await saveResume(resumeData, currentResumeId || undefined)
          // 如果保存后获得了新的 ID，更新 currentResumeId
          if (!currentResumeId && saved.id) {
            setCurrentId(saved.id)
            setCurrentResumeId(saved.id)
          }
          lastSavedDataRef.current = currentDataStr
          console.log('立即保存成功', saved.id)
        }
      } catch (error) {
        console.error('立即保存失败:', error)
      }
    })()
  }, [resumeData, currentResumeId, setCurrentId])

  // 如果路由携带 resumeId，则设置为当前简历 ID，保持与路由一致
  useEffect(() => {
    if (resumeId) {
      setCurrentId(resumeId)
      setCurrentResumeId(resumeId)
    }
  }, [resumeId, setCurrentId])

  // 监听简历数据变化，自动保存（防抖）
  useEffect(() => {
    if (resumeData) {
      autoSave()
    }
    
    // 清理定时器
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [resumeData, autoSave])

  // 全局点击事件：点击任意区域时立即保存（排除交互元素）
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 如果点击的是输入框、文本域、可编辑元素、按钮或链接，不保存
      const isEditable = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.tagName === 'BUTTON' ||
                        target.tagName === 'A' ||
                        target.isContentEditable ||
                        target.closest('input, textarea, button, a, [contenteditable="true"]')
      
      // 点击非交互区域时保存
      if (!isEditable) {
        saveImmediately()
      }
    }

    // 使用 mousedown 事件，在点击时立即保存
    document.addEventListener('mousedown', handleGlobalClick)
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick)
    }
  }, [saveImmediately])

  // 监听编辑状态：页面加载时保存初始状态
  useEffect(() => {
    if (!initialResumeData) {
      setInitialResumeData(JSON.stringify(resumeData))
      lastSavedDataRef.current = JSON.stringify(resumeData)
    }
  }, [])

  // 监听简历数据变化，判断是否有未保存的修改
  useEffect(() => {
    if (initialResumeData && saveSuccess === false) {
      const currentData = JSON.stringify(resumeData)
      setHasUnsavedChanges(currentData !== initialResumeData)
    }
  }, [resumeData, initialResumeData, saveSuccess])

  // 保存成功时，更新初始状态
  useEffect(() => {
    if (saveSuccess) {
      setInitialResumeData(JSON.stringify(resumeData))
      setHasUnsavedChanges(false)
    }
  }, [saveSuccess, resumeData])

  // 页面卸载时提醒用户保存
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = '记得保存简历的修改'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // 🎯 HTML 模板特有：不需要自动渲染 PDF，实时预览即可

  // 导出 JSON
  const handleExportJSON = () => {
    try {
      const jsonString = JSON.stringify(resumeData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `resume-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('导出 JSON 失败:', error)
      alert('导出失败，请重试')
    }
  }

  // 导入 JSON
  const handleImportJSON = () => {
    fileInputRef.current?.click()
  }

  // HTML 转 PDF 下载
  const handleDownloadPDF = useCallback(() => {
    try {
      // 直接从当前页面获取已渲染的 HTML 模板容器
      const sourceElement = document.querySelector('.html-template-container') as HTMLElement
      
      // #region agent log H1
      const allContainers = document.querySelectorAll('.html-template-container');
      logDebug('querySelector result', { 
        found: !!sourceElement, 
        totalContainers: allContainers.length,
        sourceElementTag: sourceElement?.tagName,
        sourceElementClassName: sourceElement?.className,
        sourceElementInnerHTMLLength: sourceElement?.innerHTML?.length || 0
      }, 'H1');
      // #endregion agent log H1

      if (!sourceElement) {
        // #region agent log H1
        logDebug('sourceElement is null - checking for any containers', { 
          bodyInnerHTMLSnippet: document.body.innerHTML.substring(0, 500)
        }, 'H1');
        // #endregion agent log H1
        alert('找不到简历预览内容，请确保预览区域可见')
        return
      }

      // 克隆元素
      const clonedElement = sourceElement.cloneNode(true) as HTMLElement
      
      // #region agent log H4
      logDebug('clonedElement info', { 
        clonedTagName: clonedElement?.tagName,
        clonedClassName: clonedElement?.className,
        clonedInnerHTMLLength: clonedElement?.innerHTML?.length || 0,
        clonedInnerHTMLSnippet: clonedElement?.innerHTML?.substring(0, 300)
      }, 'H4');
      // #endregion agent log H4
      
      // 创建一个临时容器
      const tempContainer = document.createElement('div')
      tempContainer.style.position = 'absolute'
      tempContainer.style.left = '-9999px'
      tempContainer.style.top = '0'
      tempContainer.style.width = '210mm'
      tempContainer.style.background = 'white'
      
      // 添加内联样式到克隆元素（确保样式被应用）
      const styles = `
        .html-template-container {
          width: 100%;
          max-width: 850px;
          background: white;
          padding: 40px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu',
            'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .template-header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 24px; }
        .header-main { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 12px; }
        .header-left { flex: 1; }
        .candidate-name { font-size: 32px; font-weight: bold; color: #1f2937; margin: 0; line-height: 1.2; }
        .candidate-title { font-size: 18px; color: #2563eb; margin: 6px 0 0 0; font-weight: 600; }
        .header-right { display: flex; flex-direction: column; gap: 6px; text-align: right; }
        .info-item { font-size: 13px; color: #666; white-space: nowrap; }
        .employment-status { font-size: 12px; color: #666; display: inline-block; padding: 4px 8px; background: #f0f9ff; border-radius: 4px; margin-top: 8px; }
        .template-content { display: flex; flex-direction: column; gap: 24px; }
        .template-section { display: flex; flex-direction: column; gap: 12px; }
        .section-title { font-size: 16px; font-weight: bold; color: #1f2937; margin: 0; display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
        .section-content { display: flex; flex-direction: column; gap: 16px; }
        .section-content ul, .section-content ol { margin: 0; padding-left: 24px; line-height: 1.7; }
        .section-content ul { list-style-type: disc; }
        .section-content ol { list-style-type: decimal; }
        .section-content li { margin: 6px 0; color: #555; font-size: 14px; }
        .section-content li p { margin: 0; }
        .item { display: flex; flex-direction: column; gap: 8px; }
        .item-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .item-title-group { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .item-title { font-size: 15px; font-weight: 600; color: #1f2937; margin: 0; }
        .item-subtitle { font-size: 13px; color: #2563eb; }
        .item-date { font-size: 12px; color: #999; white-space: nowrap; flex-shrink: 0; }
        .item-description { font-size: 13px; color: #555; margin: 0; line-height: 1.5; }
        .item-description p { margin: 0; padding: 0; }
        .item-description ul, .item-description ol { margin: 4px 0; padding-left: 20px; }
        .item-description li { margin: 3px 0; }
        .item-link { font-size: 12px; color: #2563eb; text-decoration: none; font-weight: 500; }
      `
      
      const styleElement = document.createElement('style')
      styleElement.textContent = styles
      tempContainer.appendChild(styleElement)
      tempContainer.appendChild(clonedElement)
      document.body.appendChild(tempContainer)

      // 清理文件名：去除首尾空格，将多个连续空格替换为单个空格
      const cleanFileName = (name: string | undefined): string => {
        if (!name) return '简历'
        return name.trim().replace(/\s+/g, ' ')
      }
      
      const opt = {
        margin: [6, 6, 6, 6],
        filename: `${cleanFileName(resumeData.basic.name)}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 3.2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 0,
          ignoreElements: (element: HTMLElement) => {
            return element.classList?.contains('no-print');
          }
        },
        jsPDF: { 
          orientation: 'portrait', 
          unit: 'mm', 
          format: 'a4',
          compress: true
        },
      }

      // #region agent log H5
      logDebug('before html2pdf call', { 
        clonedElementInBody: document.body.contains(tempContainer),
        optFilename: opt.filename
      }, 'H5');
      // #endregion agent log H5

      // 使用 html2pdf 转换并下载
      html2pdf()
        .set(opt)
        .from(clonedElement)
        .save()
        .then(() => {
          // #region agent log H5
          logDebug('html2pdf success', { success: true }, 'H5');
          // #endregion agent log H5
        })
        .catch((err: any) => {
          // #region agent log H5
          logDebug('html2pdf error', { error: err?.message || String(err) }, 'H5');
          // #endregion agent log H5
        })
        .finally(() => {
          // 清理临时元素
          if (tempContainer.parentNode) {
            document.body.removeChild(tempContainer)
          }
        })
    } catch (error) {
      // #region agent log H5
      logDebug('handleDownloadPDF exception', { error: String(error) }, 'H5');
      // #endregion agent log H5
      console.error('PDF 下载失败:', error)
      alert('下载失败，请重试')
    }
  }, [resumeData.basic.name])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const importedData = JSON.parse(text)

        if (typeof importedData === 'object' && importedData !== null) {
          setResumeData(importedData)
          alert('导入成功！')
        } else {
          throw new Error('无效的 JSON 格式')
        }
      } catch (error) {
        console.error('导入 JSON 失败:', error)
        alert('导入失败：文件格式不正确，请确保是有效的 JSON 文件')
      }
    }
    reader.onerror = () => {
      alert('读取文件失败，请重试')
    }
    reader.readAsText(file)

    event.target.value = ''
  }

  return (
    <WorkspaceLayout
      onSave={handleSaveToDashboard}
      onDownload={handleDownloadPDF}
    >
      {/* 编辑 + 预览布局 */}
      <EditPreviewLayout
        resumeData={resumeData}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        toggleSectionVisibility={toggleSectionVisibility}
        updateMenuSections={updateMenuSections}
        reorderSections={reorderSections}
        updateGlobalSettings={updateGlobalSettings}
        addCustomSection={addCustomSection}
        updateBasicInfo={updateBasicInfo}
        updateProject={updateProject}
        deleteProject={deleteProject}
        reorderProjects={reorderProjects}
        updateExperience={updateExperience}
        deleteExperience={deleteExperience}
        reorderExperiences={reorderExperiences}
        updateEducation={updateEducation}
        deleteEducation={deleteEducation}
        reorderEducations={reorderEducations}
        updateOpenSource={updateOpenSource}
        deleteOpenSource={deleteOpenSource}
        reorderOpenSources={reorderOpenSources}
        updateAward={updateAward}
        deleteAward={deleteAward}
        reorderAwards={reorderAwards}
        addCustomItem={addCustomItem}
        updateCustomItem={updateCustomItem}
        deleteCustomItem={deleteCustomItem}
        updateSkillContent={updateSkillContent}
        handleAIImport={handleAIImport}
        pdfBlob={pdfBlob}
        loading={loading}
        progress={progress}
        handleRender={handleRender}
        handleDownload={handleDownload}
        editMode={editMode}
      />

      {/* 隐藏的文件输入（用于导入 JSON） */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* AI 导入弹窗 */}
      <AIImportModal
        isOpen={aiModalOpen}
        sectionType={aiModalSection}
        sectionTitle={aiModalTitle}
        onClose={() => setAiModalOpen(false)}
        onSave={handleAISave}
      />

      {/* 未保存提醒对话框 */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 max-w-sm">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              未保存的更改
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              记得保存简历！您的更改可能会丢失。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUnsavedDialog(false)
                  if (pendingNavigation) {
                    pendingNavigation()
                    setPendingNavigation(null)
                  }
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
              >
                继续离开
              </button>
              <button
                onClick={() => setShowUnsavedDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
              >
                留下保存
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  )
}

