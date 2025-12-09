/**
 * 简历实时预览组件（可编辑版）
 * 使用 HTML/CSS 渲染，支持直接在预览中编辑
 * 顶部工具栏支持：加粗、斜体、下划线、标题级别
 * 支持选中文字后AI改写
 */
import React, { useCallback, useState, useEffect, useRef } from 'react'
import type { Resume } from '../types/resume'
import AIRewriteDialog from './AIRewriteDialog'

interface Props {
  resume: Resume | null
  sectionOrder?: string[]
  scale?: number
  onUpdate?: (resume: Resume) => void
}

// 格式化工具栏按钮配置
const toolbarButtons = [
  { command: 'bold', icon: 'B', title: '加粗', style: { fontWeight: 'bold' } },
  { command: 'italic', icon: 'I', title: '斜体', style: { fontStyle: 'italic' } },
  { command: 'underline', icon: 'U', title: '下划线', style: { textDecoration: 'underline' } },
  { type: 'divider' },
  { command: 'formatBlock', arg: 'h1', icon: 'H1', title: '一级标题' },
  { command: 'formatBlock', arg: 'h2', icon: 'H2', title: '二级标题' },
  { command: 'formatBlock', arg: 'h3', icon: 'H3', title: '三级标题' },
  { command: 'formatBlock', arg: 'p', icon: 'P', title: '正文' },
  { type: 'divider' },
  { command: 'insertUnorderedList', icon: '•', title: '无序列表' },
  { command: 'insertOrderedList', icon: '1.', title: '有序列表' },
  { type: 'divider' },
  { command: 'justifyLeft', icon: '☰', title: '左对齐' },
  { command: 'justifyCenter', icon: '☰', title: '居中', style: { transform: 'scaleX(0.8)' } },
  { command: 'justifyRight', icon: '☰', title: '右对齐' },
]

export default function ResumePreview({ resume, sectionOrder, scale = 1, onUpdate }: Props) {
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
        // 延迟隐藏，避免点击按钮时消失
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

      // 检查选中是否在预览区域内
      const range = selection.getRangeAt(0)
      const container = range.commonAncestorContainer
      const previewEl = previewRef.current
      if (!previewEl || !previewEl.contains(container)) {
        setShowAIButton(false)
        return
      }

      // 保存选区和位置
      selectionRangeRef.current = range.cloneRange()
      setSelectedText(text)

      const rect = range.getBoundingClientRect()
      setAIButtonPos({
        x: rect.left + rect.width / 2 - 40,
        y: rect.top - 45
      })
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
      
      // 触发更新
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
      e.preventDefault() // 阻止默认的 Tab 跳转
      if (e.shiftKey) {
        // Shift+Tab: 减少缩进
        document.execCommand('outdent', false)
      } else {
        // Tab: 增加缩进
        document.execCommand('indent', false)
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
    
    // 解析字段路径，如 "education.0.school" 或 "name"
    const parts = field.split('.')
    const newResume = JSON.parse(JSON.stringify(resume)) // 深拷贝
    
    if (parts.length === 1) {
      // 简单字段：name, summary, objective
      if (field === 'name') {
        newResume.name = textContent
      } else if (field === 'summary') {
        newResume.summary = content // 保留 HTML 格式
      } else if (field === 'objective') {
        newResume.objective = textContent
      } else if (field === 'skills') {
        // 技能：按行分割，解析 "技能名: 描述" 格式
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
      } else if (field === 'awards') {
        // 奖项：按行分割
        newResume.awards = textContent.split(/[•\n]+/).map(s => s.trim()).filter(Boolean)
      }
    } else if (parts.length === 2) {
      // contact.phone, contact.email, contact.location 或 skills.0
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
        // 技能格式：技能名: 描述
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
        // 模块标题：sectionTitle.education, sectionTitle.experience 等
        newResume.sectionTitles = newResume.sectionTitles || {}
        newResume.sectionTitles[subField as keyof typeof newResume.sectionTitles] = textContent
      }
    } else if (parts.length === 3) {
      // 数组字段：education.0.school
      const [section, indexStr, subField] = parts
      const index = parseInt(indexStr, 10)
      
      if (section === 'education' && newResume.education?.[index]) {
        if (subField === 'titleLine') {
          // 解析 "学校 - 学位 - 专业" 格式
          const parts = textContent.split(' - ')
          newResume.education[index].school = parts[0]?.trim() || ''
          newResume.education[index].title = parts[0]?.trim() || ''
          newResume.education[index].degree = parts[1]?.trim() || ''
          newResume.education[index].subtitle = parts[1]?.trim() || ''
          newResume.education[index].major = parts[2]?.trim() || ''
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
          // 解析 "公司 - 职位" 格式
          const parts = textContent.split(' - ')
          newResume.internships[index].title = parts[0]?.trim() || ''
          newResume.internships[index].subtitle = parts[1]?.trim() || ''
        } else if (subField === 'title') {
          newResume.internships[index].title = textContent
        } else if (subField === 'subtitle') {
          const cleanText = textContent.replace(/^[\s-]+/, '').trim()
          newResume.internships[index].subtitle = cleanText
        } else if (subField === 'date') {
          newResume.internships[index].date = textContent
        } else if (subField === 'details') {
          // 从 HTML 中提取列表项
          const liElements = e.currentTarget.querySelectorAll('li')
          if (liElements.length > 0) {
            const items = Array.from(liElements).map(li => li.textContent?.trim() || '').filter(Boolean)
            newResume.internships[index].highlights = items
            newResume.internships[index].details = items
          } else {
            // 没有列表结构时，按换行分割
            const items = textContent.split(/[\n]+/).map(s => s.trim()).filter(Boolean)
            newResume.internships[index].highlights = items
            newResume.internships[index].details = items
          }
        }
      } else if (section === 'projects' && newResume.projects?.[index]) {
        if (subField === 'titleLine') {
          // 解析 "项目名 - 角色" 格式
          const parts = textContent.split(' - ')
          newResume.projects[index].title = parts[0]?.trim() || ''
          newResume.projects[index].name = parts[0]?.trim() || ''
          newResume.projects[index].subtitle = parts[1]?.trim() || ''
          newResume.projects[index].role = parts[1]?.trim() || ''
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
          // 从 HTML 中提取列表项
          const liElements = e.currentTarget.querySelectorAll('li')
          if (liElements.length > 0) {
            const items = Array.from(liElements).map(li => li.textContent?.trim() || '').filter(Boolean)
            newResume.projects[index].highlights = items
            newResume.projects[index].details = items
          } else {
            // 没有列表结构时，按换行分割
            const items = textContent.split(/[\n]+/).map(s => s.trim()).filter(Boolean)
            newResume.projects[index].highlights = items
            newResume.projects[index].details = items
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

  const defaultOrder = ['education', 'experience', 'projects', 'opensource', 'skills', 'awards', 'summary']
  const order = (sectionOrder && sectionOrder.length > 0) ? sectionOrder : defaultOrder

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
              onMouseDown={(e) => e.preventDefault()} // 防止失去焦点
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
        /* 限制标题字体大小 */
        #resume-preview h1 {
          font-size: 14pt !important;
          margin: 2px 0 2px 0;
        }
        #resume-preview h2 {
          font-size: 12pt !important;
          margin: 2px 0 2px 0;
        }
        #resume-preview h3 {
          font-size: 10pt !important;
          margin: 2px 0 2px 0;
        }
        #resume-preview ul, #resume-preview ol {
          margin: 4px 0;
          padding-left: 20px;
        }
        #resume-preview li {
          margin: 2px 0;
        }
      `}</style>

      {/* 可滚动的预览区域 */}
      <div ref={previewRef} style={styles.scrollArea}>
        <div id="resume-preview" style={{
          ...styles.paper,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}>
        {/* 头部：姓名和联系方式 - 可编辑 */}
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
        {order.map((sectionType) => {
          switch (sectionType) {
            case 'education':
              return renderEducation(resume, handleBlur, handleKeyDown)
            case 'experience':
            case 'internships':
              return renderExperience(resume, handleBlur, handleKeyDown)
            case 'projects':
              return renderProjects(resume, handleBlur, handleKeyDown)
            case 'skills':
              return renderSkills(resume, handleBlur, handleKeyDown)
            case 'awards':
              return renderAwards(resume, handleBlur, handleKeyDown)
            case 'summary':
              return renderSummary(resume, handleBlur, handleKeyDown)
            case 'opensource':
              return renderOpenSource(resume, handleBlur, handleKeyDown)
            default:
              return null
          }
        })}
        </div>
      </div>

      {/* AI改写浮动按钮 */}
      {showAIButton && (
        <div
          style={{
            position: 'fixed',
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

type BlurHandler = (e: React.FocusEvent<HTMLElement>) => void
type KeyHandler = (e: React.KeyboardEvent<HTMLElement>) => void

function renderEducation(resume: Resume, onBlur: BlurHandler, onKeyDown: KeyHandler) {
  const education = resume.education
  if (!education || education.length === 0) return null
  const title = resume.sectionTitles?.education || '教育经历'

  return (
    <div key="education" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.education"
        onBlur={onBlur}
      >
        {title}
      </div>
      {education.map((edu: any, idx: number) => {
        const school = edu.school || edu.title || ''
        const degree = edu.degree || edu.subtitle || ''
        const major = edu.major || ''
        const date = edu.date || edu.duration || ''
        const details = edu.details || []
        const description = edu.description || ''
        
        if (!school && !degree) return null
        
        return (
          <div key={idx} style={styles.entry}>
            <div style={styles.entryHeader}>
              <div
                contentEditable 
                suppressContentEditableWarning
                style={{ ...styles.entryTitle, display: 'inline' }}
                data-field={`education.${idx}.titleLine`}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
              >
                {school}{degree ? ` - ${degree}` : ''}{major ? ` - ${major}` : ''}
              </div>
              {date && (
                <span 
                  contentEditable 
                  suppressContentEditableWarning
                  style={styles.entryDate}
                  data-field={`education.${idx}.date`}
                  onBlur={onBlur}
                >
                  {date}
                </span>
              )}
            </div>
            <div 
              contentEditable 
              suppressContentEditableWarning
              style={{ fontSize: '10pt', color: '#666', marginTop: '4px', minHeight: '1em' }}
              data-field={`education.${idx}.details`}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
            >
              {Array.isArray(details) && details.length > 0 
                ? details.join('；') 
                : description || '点击添加描述...'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function renderExperience(resume: Resume, onBlur: BlurHandler, onKeyDown: KeyHandler) {
  const internships = resume.internships
  if (!internships || internships.length === 0) return null
  const title = resume.sectionTitles?.experience || resume.sectionTitles?.internships || '工作经历'

  return (
    <div key="experience" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.experience"
        onBlur={onBlur}
      >
        {title}
      </div>
      {internships.map((item: any, idx: number) => {
        const title = item.title || item.company || ''
        const subtitle = item.subtitle || item.position || ''
        const date = item.date || item.duration || ''
        const details = item.highlights || item.details || []
        
        if (!title && !subtitle) return null
        
        return (
          <div key={idx} style={styles.entry}>
            <div style={styles.entryHeader}>
              <div
                contentEditable 
                suppressContentEditableWarning
                style={{ ...styles.entryTitle, display: 'inline' }}
                data-field={`experience.${idx}.titleLine`}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
              >
                {title}{subtitle ? ` - ${subtitle}` : ''}
              </div>
              {date && (
                <span 
                  contentEditable 
                  suppressContentEditableWarning
                  style={styles.entryDate}
                  data-field={`experience.${idx}.date`}
                  onBlur={onBlur}
                >
                  {date}
                </span>
              )}
            </div>
            <div 
              contentEditable 
              suppressContentEditableWarning
              style={{ ...styles.highlights, paddingLeft: '18px', minHeight: '1em' }}
              data-field={`experience.${idx}.details`}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
            >
              {details.length > 0 
                ? <ul style={{ margin: 0, paddingLeft: '18px' }}>{details.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
                : '点击添加工作描述...'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function renderProjects(resume: Resume, onBlur: BlurHandler, onKeyDown: KeyHandler) {
  const projects = resume.projects
  if (!projects || projects.length === 0) return null
  const title = resume.sectionTitles?.projects || '项目经历'

  return (
    <div key="projects" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.projects"
        onBlur={onBlur}
      >
        {title}
      </div>
      {projects.map((item: any, idx: number) => {
        const title = item.title || item.name || ''
        const subtitle = item.subtitle || item.role || ''
        const date = item.date || ''
        const details = item.highlights || item.details || []
        const repoUrl = item.repoUrl || ''
        
        if (!title) return null
        
        return (
          <div key={idx} style={styles.entry}>
            <div style={styles.entryHeader}>
              <div>
                <div
                  contentEditable 
                  suppressContentEditableWarning
                  style={{ ...styles.entryTitle, display: 'inline' }}
                  data-field={`projects.${idx}.titleLine`}
                  onBlur={onBlur}
                  onKeyDown={onKeyDown}
                >
                  {title}{subtitle ? ` - ${subtitle}` : ''}
                </div>
                {repoUrl && (
                  <a 
                    href={repoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ marginLeft: '8px', color: '#6366f1', fontSize: '10pt', textDecoration: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    🔗 仓库
                  </a>
                )}
              </div>
              {date && (
                <span 
                  contentEditable 
                  suppressContentEditableWarning
                  style={styles.entryDate}
                  data-field={`projects.${idx}.date`}
                  onBlur={onBlur}
                >
                  {date}
                </span>
              )}
            </div>
            <div 
              contentEditable 
              suppressContentEditableWarning
              style={{ ...styles.highlights, paddingLeft: '18px', minHeight: '1em' }}
              data-field={`projects.${idx}.details`}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
            >
              {details.length > 0 
                ? <ul style={{ margin: 0, paddingLeft: '18px' }}>{details.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
                : '点击添加项目描述...'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function renderSkills(resume: Resume, onBlur: BlurHandler, onKeyDown: KeyHandler) {
  const skills = resume.skills
  if (!skills || skills.length === 0) return null
  const title = resume.sectionTitles?.skills || '专业技能'

  return (
    <div key="skills" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.skills"
        onBlur={onBlur}
      >
        {title}
      </div>
      <ul 
        contentEditable 
        suppressContentEditableWarning
        style={{ fontSize: '10pt', lineHeight: 1.6, minHeight: '2em', margin: 0, paddingLeft: '24px' }}
        data-field="skills"
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      >
        {skills.map((skill: any, idx: number) => {
          const isObject = typeof skill === 'object' && skill !== null
          const category = isObject ? (skill.category || '') : skill
          const details = isObject ? (skill.details || '') : ''
          return (
            <li key={idx}>
              {category && details ? (
                <><strong>{category}</strong>: {details}</>
              ) : (
                category || details
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function renderAwards(resume: Resume, onBlur: BlurHandler, onKeyDown: KeyHandler) {
  const awards = resume.awards
  if (!awards || awards.length === 0) return null
  const title = resume.sectionTitles?.awards || '荣誉奖项'

  return (
    <div key="awards" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.awards"
        onBlur={onBlur}
      >
        {title}
      </div>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={{ ...styles.awardsList, listStyle: 'none', padding: 0, minHeight: '1em' }}
        data-field="awards"
        onBlur={onBlur}
      >
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {awards.map((award: any, idx: number) => {
            const text = typeof award === 'string' ? award : (award.title || award.name || '')
            if (!text) return null
            return <li key={idx} style={styles.awardItem}>{text}</li>
          })}
        </ul>
      </div>
    </div>
  )
}

function renderSummary(resume: Resume, onBlur: BlurHandler, onKeyDown: KeyHandler) {
  const summary = resume.summary
  if (!summary) return null
  const title = resume.sectionTitles?.summary || '个人总结'

  return (
    <div key="summary" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.summary"
        onBlur={onBlur}
      >
        {title}
      </div>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={{ ...styles.summaryText, minHeight: '2em' }}
        data-field="summary"
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      >
        {summary}
      </div>
    </div>
  )
}

function renderOpenSource(resume: Resume, onBlur: BlurHandler, onKeyDown: KeyHandler) {
  const openSource = resume.openSource
  if (!openSource || openSource.length === 0) return null
  const title = resume.sectionTitles?.openSource || '开源经历'

  return (
    <div key="opensource" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.openSource"
        onBlur={onBlur}
      >
        {title}
      </div>
      {openSource.map((item: any, idx: number) => {
        const itemTitle = item.title || ''
        const subtitle = item.subtitle || ''
        const items = item.items || []
        const repoUrl = item.repoUrl || ''
        
        if (!itemTitle) return null
        
        return (
          <div key={idx} style={styles.entry}>
            <div style={styles.entryHeader}>
              <div>
                <div
                  contentEditable 
                  suppressContentEditableWarning
                  style={{ ...styles.entryTitle, display: 'inline' }}
                  data-field={`opensource.${idx}.titleLine`}
                  onBlur={onBlur}
                  onKeyDown={onKeyDown}
                >
                  {itemTitle}{subtitle ? ` - ${subtitle}` : ''}
                </div>
                {repoUrl && (
                  <a 
                    href={repoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ marginLeft: '8px', color: '#6366f1', fontSize: '10pt', textDecoration: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    🔗 仓库
                  </a>
                )}
              </div>
            </div>
            <div 
              contentEditable 
              suppressContentEditableWarning
              style={{ ...styles.highlights, paddingLeft: '18px', minHeight: '1em' }}
              data-field={`opensource.${idx}.items`}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
            >
              {items.length > 0 
                ? <ul style={{ margin: 0, paddingLeft: '18px' }}>{items.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
                : '点击添加开源贡献描述...'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.95)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
    flexShrink: 0,
  },
  toolbarButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#333',
    transition: 'all 0.15s',
  },
  toolbarDivider: {
    width: '1px',
    height: '20px',
    background: 'rgba(0, 0, 0, 0.15)',
    margin: '0 4px',
  },
  scrollArea: {
    flex: 1,
    overflow: 'auto',
    padding: '32px',
    display: 'flex',
    justifyContent: 'center',
  },
  paper: {
    width: '210mm',
    minHeight: '297mm',
    // margin: '0 auto', // 由 flex 居中
    backgroundColor: 'white',
    padding: '40px 50px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 0 1px rgba(0, 0, 0, 0.1)', // 增强阴影以适应深色背景
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontSize: '10pt',
    lineHeight: 1.4,
    color: '#333',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#525659',
  },
  placeholderText: {
    color: '#888',
    fontSize: '16px',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '16px',
    borderBottom: '2px solid #333',
    paddingBottom: '12px',
  },
  name: {
    fontSize: '22pt',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  contact: {
    fontSize: '10pt',
    color: '#555',
  },
  section: {
    marginBottom: '14px',
  },
  sectionTitle: {
    fontSize: '12pt',
    fontWeight: 'bold',
    color: '#000',
    borderBottom: '1px solid #ccc',
    paddingBottom: '4px',
    marginBottom: '8px',
  },
  entry: {
    marginBottom: '10px',
  },
  entryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '4px',
  },
  entryTitle: {
    fontWeight: 'bold',
    fontSize: '10.5pt',
  },
  entrySubtitle: {
    color: '#555',
    fontSize: '10pt',
  },
  entryDate: {
    color: '#666',
    fontSize: '9pt',
    whiteSpace: 'nowrap' as const,
  },
  highlights: {
    paddingLeft: '18px',
    marginTop: '4px',
    marginBottom: 0,
  },
  highlightItem: {
    marginBottom: '2px',
    fontSize: '9.5pt',
  },
  skillsList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px 12px',
  },
  skillItem: {
    background: '#f0f0f0',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '9.5pt',
  },
  awardsList: {
    paddingLeft: '18px',
    marginTop: 0,
    marginBottom: 0,
  },
  awardItem: {
    marginBottom: '2px',
    fontSize: '9.5pt',
  },
  summaryText: {
    fontSize: '9.5pt',
    textAlign: 'justify' as const,
    margin: 0,
  },
}
