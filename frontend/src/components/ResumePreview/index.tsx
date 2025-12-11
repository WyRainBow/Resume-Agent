/**
 * 简历实时预览组件（可编辑版）
 * 使用 HTML/CSS 渲染，支持直接在预览中编辑
 * 顶部工具栏支持：加粗、斜体、下划线、标题级别
 * 支持选中文字后AI改写
 */
import React, { useCallback, useState, useEffect, useRef } from 'react'
import type { Resume } from '../../types/resume'
import AIRewriteDialog from '../AIRewriteDialog'
import type { ResumePreviewProps } from './types'
import { styles, toolbarButtons } from './styles'
import {
  EducationSection,
  ExperienceSection,
  ProjectsSection,
  SkillsSection,
  AwardsSection,
  SummarySection,
  OpenSourceSection,
} from './sections'

export default function ResumePreview({ resume, sectionOrder, scale = 1, onUpdate }: ResumePreviewProps) {
  // AI改写相关状态
  const [showAIButton, setShowAIButton] = useState(false)
  const [aiButtonPos, setAIButtonPos] = useState({ x: 0, y: 0 })
  const [selectedText, setSelectedText] = useState('')
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 })
  const selectionRangeRef = useRef<Range | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // 监听文本选择
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        setTimeout(() => {
          if (!showAIDialog) {
            setShowAIButton(false)
          }
        }, 200)
        return
      }

      const text = selection.toString().trim()
      if (text.length < 2) {
        setShowAIButton(false)
        return
      }

      const range = selection.getRangeAt(0)
      const container = range.commonAncestorContainer
      const previewEl = previewRef.current
      if (!previewEl || !previewEl.contains(container)) {
        setShowAIButton(false)
        return
      }

      selectionRangeRef.current = range.cloneRange()
      setSelectedText(text)

      const rects = range.getClientRects()
      const targetRect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect()
      const previewRect = previewEl.getBoundingClientRect()
      const padding = 8
      const btnSize = { w: 120, h: 38 }

      let x = targetRect.right - previewRect.left + previewEl.scrollLeft + 8
      if (x + btnSize.w + padding > previewEl.scrollWidth) {
        x = Math.min(targetRect.left - previewRect.left + previewEl.scrollLeft - btnSize.w - 8, previewEl.scrollWidth - btnSize.w - padding)
      }
      x = Math.max(padding, Math.min(x, previewEl.scrollWidth - btnSize.w - padding))

      let y = targetRect.top - previewRect.top + previewEl.scrollTop + targetRect.height / 2 - btnSize.h / 2
      y = Math.max(padding, Math.min(y, previewEl.scrollHeight - btnSize.h - padding))

      setAIButtonPos({ x, y })
      setShowAIButton(true)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [showAIDialog])

  // 打开AI对话框
  const openAIDialog = () => {
    setDialogPos({
      x: Math.max(10, aiButtonPos.x - 150),
      y: Math.max(10, aiButtonPos.y + 50)
    })
    setShowAIDialog(true)
    setShowAIButton(false)
  }

  // 应用AI改写结果
  const applyRewrite = (newText: string) => {
    const range = selectionRangeRef.current
    if (range) {
      range.deleteContents()
      range.insertNode(document.createTextNode(newText))
      
      const previewEl = document.getElementById('resume-preview')
      if (previewEl) {
        const event = new Event('input', { bubbles: true })
        previewEl.dispatchEvent(event)
      }
    }
    setShowAIDialog(false)
    setSelectedText('')
  }

  // 执行格式化命令
  const execCommand = useCallback((command: string, arg?: string) => {
    document.execCommand(command, false, arg)
  }, [])

  // 处理 Tab 键缩进
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      
      let currentNode = selection.anchorNode as HTMLElement | null
      while (currentNode && currentNode.nodeName !== 'DIV') {
        currentNode = currentNode.parentElement
      }
      
      if (!currentNode) return
      
      const textSpan = currentNode.querySelector('span:last-of-type') as HTMLElement
      if (!textSpan) return
      
      if (e.shiftKey) {
        if (currentNode.dataset.indent) {
          delete currentNode.dataset.indent
          currentNode.style.marginLeft = '0'
        }
      } else {
        if (!currentNode.dataset.indent) {
          currentNode.dataset.indent = 'true'
          currentNode.style.marginLeft = '18px'
        }
      }
    }
  }, [])

  // 处理编辑后的数据同步
  const handleBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (!onUpdate || !resume) return
    
    const field = e.currentTarget.dataset.field
    if (!field) return
    
    const content = e.currentTarget.innerHTML
    const textContent = e.currentTarget.textContent || ''
    
    const parts = field.split('.')
    const newResume = JSON.parse(JSON.stringify(resume))
    
    if (parts.length === 1) {
      if (field === 'name') {
        newResume.name = textContent
      } else if (field === 'summary') {
        newResume.summary = content
      } else if (field === 'objective') {
        newResume.objective = textContent
      } else if (field === 'skills') {
        const liElements = e.currentTarget.querySelectorAll('li')
        if (liElements.length > 0) {
          newResume.skills = Array.from(liElements).map(li => {
            const text = li.textContent?.trim() || ''
            const colonIdx = text.indexOf(':')
            if (colonIdx > 0) {
              return {
                category: text.substring(0, colonIdx).trim(),
                details: text.substring(colonIdx + 1).trim()
              }
            }
            return { category: text, details: '' }
          }).filter(s => s.category || s.details)
        } else {
          const lines = textContent.split(/[\n]+/).map(s => s.trim()).filter(Boolean)
          newResume.skills = lines.map(line => {
            const colonIdx = line.indexOf(':')
            if (colonIdx > 0) {
              return {
                category: line.substring(0, colonIdx).trim(),
                details: line.substring(colonIdx + 1).trim()
              }
            }
            return { category: line, details: '' }
          })
        }
      } else if (field === 'awards') {
        const liElements = e.currentTarget.querySelectorAll('li')
        if (liElements.length > 0) {
          newResume.awards = Array.from(liElements)
            .map(li => li.textContent?.trim() || '')
            .filter(Boolean)
        } else {
          newResume.awards = textContent.split(/[•\n]+/).map(s => s.trim()).filter(Boolean)
        }
      }
    } else if (parts.length === 2) {
      const [section, subField] = parts
      if (section === 'contact') {
        newResume.contact = newResume.contact || {}
        if (subField === 'phone') {
          newResume.contact.phone = textContent
        } else if (subField === 'email') {
          newResume.contact.email = textContent
        } else if (subField === 'location') {
          newResume.contact.location = textContent
        }
      } else if (section === 'skills') {
        const idx = parseInt(subField, 10)
        if (!isNaN(idx) && newResume.skills?.[idx] !== undefined) {
          const colonIdx = textContent.indexOf(':')
          if (colonIdx > 0) {
            newResume.skills[idx] = {
              category: textContent.substring(0, colonIdx).trim(),
              details: textContent.substring(colonIdx + 1).trim()
            }
          } else {
            newResume.skills[idx] = { category: textContent, details: '' }
          }
        }
      } else if (section === 'sectionTitle') {
        newResume.sectionTitles = newResume.sectionTitles || {}
        newResume.sectionTitles[subField as keyof typeof newResume.sectionTitles] = textContent
      }
    } else if (parts.length === 3) {
      const [section, indexStr, subField] = parts
      const index = parseInt(indexStr, 10)
      
      if (section === 'education' && newResume.education?.[index]) {
        if (subField === 'titleLine') {
          const titleParts = textContent.split(' - ')
          newResume.education[index].school = titleParts[0]?.trim() || ''
          newResume.education[index].title = titleParts[0]?.trim() || ''
          newResume.education[index].degree = titleParts[1]?.trim() || ''
          newResume.education[index].subtitle = titleParts[1]?.trim() || ''
          newResume.education[index].major = titleParts[2]?.trim() || ''
        } else if (subField === 'school') {
          newResume.education[index].school = textContent
          newResume.education[index].title = textContent
        } else if (subField === 'degree') {
          const cleanText = textContent.replace(/^[\s-·]+/, '').trim()
          newResume.education[index].degree = cleanText
          newResume.education[index].subtitle = cleanText
        } else if (subField === 'date') {
          newResume.education[index].date = textContent
          newResume.education[index].duration = textContent
        } else if (subField === 'details') {
          newResume.education[index].details = textContent.split(/[；;。\n]+/).map(s => s.trim()).filter(Boolean)
        }
      } else if (section === 'experience' && newResume.internships?.[index]) {
        if (subField === 'titleLine') {
          const titleParts = textContent.split(' - ')
          newResume.internships[index].title = titleParts[0]?.trim() || ''
          newResume.internships[index].subtitle = titleParts[1]?.trim() || ''
        } else if (subField === 'title') {
          newResume.internships[index].title = textContent
        } else if (subField === 'subtitle') {
          const cleanText = textContent.replace(/^[\s-]+/, '').trim()
          newResume.internships[index].subtitle = cleanText
        } else if (subField === 'date') {
          newResume.internships[index].date = textContent
        } else if (subField === 'details') {
          const liElements = e.currentTarget.querySelectorAll('li')
          if (liElements.length > 0) {
            const items = Array.from(liElements).map(li => li.textContent?.trim() || '').filter(Boolean)
            newResume.internships[index].highlights = items
            newResume.internships[index].details = items
          } else {
            const items = textContent.split(/[\n]+/).map(s => s.trim()).filter(Boolean)
            newResume.internships[index].highlights = items
            newResume.internships[index].details = items
          }
        }
      } else if (section === 'projects' && newResume.projects?.[index]) {
        if (subField === 'titleLine') {
          const titleParts = textContent.split(' - ')
          newResume.projects[index].title = titleParts[0]?.trim() || ''
          newResume.projects[index].name = titleParts[0]?.trim() || ''
          newResume.projects[index].subtitle = titleParts[1]?.trim() || ''
          newResume.projects[index].role = titleParts[1]?.trim() || ''
        } else if (subField === 'title') {
          newResume.projects[index].title = textContent
          newResume.projects[index].name = textContent
        } else if (subField === 'subtitle') {
          const cleanText = textContent.replace(/^[\s-]+/, '').trim()
          newResume.projects[index].subtitle = cleanText
          newResume.projects[index].role = cleanText
        } else if (subField === 'date') {
          newResume.projects[index].date = textContent
        } else if (subField === 'details') {
          const container = e.currentTarget.querySelector('div')
          const itemElements = container?.querySelectorAll(':scope > div') || e.currentTarget.querySelectorAll('li')
          if (itemElements && itemElements.length > 0) {
            const items = Array.from(itemElements).map(el => {
              const elem = el as HTMLElement
              const hasIndent = elem.dataset.indent === 'true' || elem.style.marginLeft === '18px'
              const prefix = hasIndent ? '>' : ''
              const text = (el.textContent || '').replace(/^[•·\s]+/, '').trim()
              const boldEl = el.querySelector('span[style*="bold"]')
              if (boldEl) {
                const boldText = boldEl.textContent?.trim() || ''
                const restText = text.replace(boldText, '').replace(/^[：:•·›\s]+/, '').trim()
                if (restText) {
                  return `${prefix}**${boldText}**:${restText}`
                } else {
                  return `${prefix}**${boldText}**`
                }
              }
              return prefix + text.replace(/^[•·›]\s*/, '')
            }).filter(Boolean)
            newResume.projects[index].highlights = items
            newResume.projects[index].details = items
          } else {
            const items = textContent.split(/[•·\n]+/).map(s => s.trim()).filter(Boolean)
            newResume.projects[index].highlights = items
            newResume.projects[index].details = items
          }
        }
      } else if (section === 'opensource' && newResume.openSource?.[index]) {
        if (subField === 'titleLine') {
          const titleParts = textContent.split(' - ')
          newResume.openSource[index].title = titleParts[0]?.trim() || ''
          newResume.openSource[index].subtitle = titleParts[1]?.trim() || ''
        } else if (subField === 'items') {
          const liElements = e.currentTarget.querySelectorAll('li')
          if (liElements.length > 0) {
            newResume.openSource[index].items = Array.from(liElements)
              .map(li => li.textContent?.trim() || '')
              .filter(Boolean)
          } else {
            newResume.openSource[index].items = textContent.split(/[\n]+/).map(s => s.trim()).filter(Boolean)
          }
        }
      }
    }
    
    onUpdate(newResume)
  }, [resume, onUpdate])

  if (!resume) {
    return (
      <div style={styles.placeholder}>
        <div style={styles.placeholderText}>暂无简历数据</div>
      </div>
    )
  }

  const defaultOrder = ['education', 'internships', 'experience', 'projects', 'opensource', 'skills', 'awards', 'summary']
  const order = (sectionOrder && sectionOrder.length > 0) ? sectionOrder : defaultOrder

  // 渲染模块
  const renderSection = (sectionType: string) => {
    const props = { resume, onBlur: handleBlur, onKeyDown: handleKeyDown, styles }
    switch (sectionType) {
      case 'education':
        return <EducationSection key="education" {...props} />
      case 'experience':
      case 'internships':
        return <ExperienceSection key="experience" {...props} />
      case 'projects':
        return <ProjectsSection key="projects" {...props} />
      case 'skills':
        return <SkillsSection key="skills" {...props} />
      case 'awards':
        return <AwardsSection key="awards" resume={resume} onBlur={handleBlur} styles={styles} />
      case 'summary':
        return <SummarySection key="summary" {...props} />
      case 'opensource':
        return <OpenSourceSection key="opensource" {...props} />
      default:
        return null
    }
  }

  return (
    <div style={styles.container}>
      {/* 顶部工具栏 */}
      <div style={styles.toolbar}>
        {toolbarButtons.map((btn, idx) => 
          btn.type === 'divider' ? (
            <div key={idx} style={styles.toolbarDivider} />
          ) : (
            <button
              key={idx}
              onClick={() => execCommand(btn.command!, btn.arg)}
              title={btn.title}
              style={{
                ...styles.toolbarButton,
                ...(btn.style || {}),
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {btn.icon}
            </button>
          )
        )}
      </div>

      {/* 打印样式 */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #resume-preview, #resume-preview * { visibility: visible; }
          #resume-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            margin: 0;
            padding: 15mm 20mm;
            box-shadow: none;
          }
        }
        #resume-preview [contenteditable]:focus {
          outline: 2px solid rgba(167, 139, 250, 0.5);
          outline-offset: 2px;
          border-radius: 2px;
        }
        #resume-preview [contenteditable]:hover {
          background: rgba(167, 139, 250, 0.05);
        }
        #resume-preview h1 { font-size: 14pt !important; margin: 2px 0 2px 0; }
        #resume-preview h2 { font-size: 12pt !important; margin: 2px 0 2px 0; }
        #resume-preview h3 { font-size: 10pt !important; margin: 2px 0 2px 0; }
        #resume-preview ul, #resume-preview ol { margin: 4px 0; padding-left: 20px; }
        #resume-preview li { margin: 2px 0; }
      `}</style>

      {/* 可滚动的预览区域 */}
      <div ref={previewRef} style={styles.scrollArea}>
        <div id="resume-preview" style={{
          ...styles.paper,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}>
          {/* 头部：姓名和联系方式 */}
          <div style={styles.header}>
            <div 
              contentEditable 
              suppressContentEditableWarning
              style={styles.name}
              data-field="name"
              onBlur={handleBlur}
            >
              {resume.name || '姓名'}
            </div>
            <div style={styles.contact}>
              {resume.contact?.phone && (
                <>
                  <span 
                    contentEditable 
                    suppressContentEditableWarning
                    data-field="contact.phone"
                    onBlur={handleBlur}
                  >
                    {resume.contact.phone}
                  </span>
                  <span> · </span>
                </>
              )}
              {resume.contact?.email && (
                <>
                  <span 
                    contentEditable 
                    suppressContentEditableWarning
                    data-field="contact.email"
                    onBlur={handleBlur}
                  >
                    {resume.contact.email}
                  </span>
                  <span> · </span>
                </>
              )}
              {resume.contact?.location && (
                <>
                  <span 
                    contentEditable 
                    suppressContentEditableWarning
                    data-field="contact.location"
                    onBlur={handleBlur}
                  >
                    {resume.contact.location}
                  </span>
                  <span> · </span>
                </>
              )}
              {resume.objective && (
                <span 
                  contentEditable 
                  suppressContentEditableWarning
                  data-field="objective"
                  onBlur={handleBlur}
                >
                  {resume.objective}
                </span>
              )}
            </div>
          </div>

          {/* 按顺序渲染各模块 */}
          {order.map(renderSection)}
        </div>

        {/* AI改写浮动按钮 */}
        {showAIButton && (
          <div
            style={{
              position: 'absolute',
              left: aiButtonPos.x,
              top: aiButtonPos.y,
              zIndex: 9990,
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <button
              onClick={openAIDialog}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: '20px',
                color: 'white',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span>✨</span>
              AI 改写
            </button>
          </div>
        )}
      </div>

      {/* AI改写对话框 */}
      <AIRewriteDialog
        isOpen={showAIDialog}
        selectedText={selectedText}
        position={dialogPos}
        onClose={() => setShowAIDialog(false)}
        onApply={applyRewrite}
      />
    </div>
  )
}
