import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type ResumeSection = {
  id: string
  type: 'contact' | 'education' | 'experience' | 'projects' | 'skills' | 'awards' | 'summary' | 'opensource'
  title: string
  icon: string
  data: any
}

type Props = {
  resumeData: any
  onSave: (data: any, sectionOrder?: string[]) => void
  saving?: boolean
}

const defaultSections: ResumeSection[] = [
  { id: 'contact', type: 'contact', title: '个人信息', icon: '👤', data: {} },
  { id: 'education', type: 'education', title: '教育经历', icon: '🎓', data: [] },
  { id: 'experience', type: 'experience', title: '工作经历', icon: '💼', data: [] },
  { id: 'projects', type: 'projects', title: '项目经历', icon: '🚀', data: [] },
  { id: 'opensource', type: 'opensource', title: '开源经历', icon: '🌐', data: [] },
  { id: 'skills', type: 'skills', title: '专业技能', icon: '⚡', data: [] },
  { id: 'awards', type: 'awards', title: '荣誉奖项', icon: '🏆', data: [] },
  { id: 'summary', type: 'summary', title: '个人总结', icon: '📝', data: '' },
]

/**
 * AI 导入弹窗组件
 */
function AIImportModal({
  isOpen,
  sectionType,
  sectionTitle,
  onClose,
  onImport,
  importing
}: {
  isOpen: boolean
  sectionType: string
  sectionTitle: string
  onClose: () => void
  onImport: (text: string) => void
  importing: boolean
}) {
  const [text, setText] = useState('')
  
  if (!isOpen) return null
  
  const placeholders: Record<string, string> = {
    contact: '张三\n电话: 13800138000\n邮箱: zhangsan@example.com\n地区: 北京\n求职意向: 后端开发工程师',
    education: '华南理工大学\n本科 · 计算机科学与技术\n2020.09 - 2024.06\nGPA: 3.8/4.0',
    experience: '字节跳动 · 后端开发实习生\n2023.06 - 2023.09\n- 负责推荐系统后端开发\n- 优化接口性能，QPS 提升 50%',
    projects: '智能简历系统\n技术负责人 · 2023.01 - 2023.06\n- 使用 React + FastAPI 开发\n- 集成 AI 自动生成功能\nGitHub: https://github.com/xxx/resume',
    skills: '编程语言: Java, Python, Go\n数据库: MySQL, Redis, MongoDB\n框架: Spring Boot, FastAPI',
    awards: '国家奖学金 · 2023\nACM 省级一等奖 · 2022\n优秀毕业生 · 2024',
    summary: '3年后端开发经验，熟悉 Java/Go 技术栈，擅长高并发系统设计与优化，有丰富的微服务架构经验。',
    opensource: 'Kubernetes\n核心贡献者\n- 提交性能优化 PR，被成功合并\n- 修复关键 Bug\n仓库: https://github.com/kubernetes/kubernetes'
  }
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          borderRadius: '16px',
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          border: '1px solid rgba(167, 139, 250, 0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>
            ✨ AI 导入 - {sectionTitle}
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >×</button>
        </div>
        
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '12px' }}>
          粘贴或输入该模块的文本内容，AI 将自动解析并填充
        </p>
        
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholders[sectionType] || '请输入文本内容...'}
          style={{
            width: '100%',
            minHeight: '180px',
            padding: '12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
        />
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={() => onImport(text)}
            disabled={!text.trim() || importing}
            style={{
              padding: '10px 24px',
              background: importing ? 'rgba(167, 139, 250, 0.3)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: importing || !text.trim() ? 'not-allowed' : 'pointer',
              opacity: !text.trim() ? 0.5 : 1,
            }}
          >
            {importing ? '🔄 解析中...' : '✨ AI 解析'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 可排序的模块卡片
 */
function SortableSection({ 
  section, 
  expanded, 
  onToggle, 
  onUpdate,
  onTitleChange,
  onAIImport,
  importing
}: { 
  section: ResumeSection
  expanded: boolean
  onToggle: () => void
  onUpdate: (data: any) => void
  onTitleChange: (title: string) => void
  onAIImport: () => void
  importing: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{
        background: isDragging 
          ? 'rgba(167, 139, 250, 0.3)' 
          : 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        border: isDragging 
          ? '2px solid rgba(167, 139, 250, 0.6)' 
          : '1px solid rgba(255, 255, 255, 0.15)',
        marginBottom: '8px',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        boxShadow: isDragging 
          ? '0 20px 40px rgba(0, 0, 0, 0.3)' 
          : '0 4px 15px rgba(0, 0, 0, 0.1)',
      }}>
        {/* 标题栏 - 整个区域可拖拽 */}
        <div 
          {...attributes}
          {...listeners}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 14px',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          {/* 拖拽手柄图标（视觉提示） */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '8px',
              marginRight: '12px',
              opacity: 0.5,
              transition: 'opacity 0.2s',
            }}
          >
            <div style={{ display: 'flex', gap: '2px' }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
            </div>
          </div>

          {/* 图标和标题 - 点击展开 */}
          <div 
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '16px' }}>{section.icon}</span>
            <input
              type="text"
              value={section.title}
              onChange={(e) => onTitleChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{ 
                color: 'white', 
                fontSize: '14px', 
                fontWeight: 600,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'text',
                width: 'auto',
                minWidth: '80px',
                maxWidth: '150px',
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = 'rgba(167, 139, 250, 0.2)'
                e.currentTarget.style.border = '1px solid rgba(167, 139, 250, 0.4)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.border = 'none'
              }}
            />
          </div>

          {/* AI 导入按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAIImport()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={importing}
            style={{
              padding: '4px 10px',
              background: importing ? 'rgba(167, 139, 250, 0.2)' : 'rgba(167, 139, 250, 0.15)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              borderRadius: '6px',
              color: '#a78bfa',
              fontSize: '11px',
              cursor: importing ? 'not-allowed' : 'pointer',
              marginRight: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
            }}
            title="AI 智能导入"
          >
            {importing ? '⏳' : '✨'} AI
          </button>

          {/* 展开/收起箭头 - 点击展开 */}
          <div 
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
            }}
          >
            ▶
          </div>
        </div>

        {/* 展开的内容区 */}
        {expanded && (
          <div style={{
            padding: '0 20px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            animation: 'fadeIn 0.3s ease',
          }}>
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <SectionEditor 
              section={section} 
              onUpdate={onUpdate} 
            />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 年月选择器组件
 */
function YearMonthPicker({ 
  value, 
  onChange, 
  placeholder = '选择年月',
  style = {}
}: { 
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  // 解析当前值（格式如 "2022-05" 或 "2022.05" 或 "至今"）
  const parseValue = (val: string) => {
    if (!val || val === '至今' || val === '现在' || val === 'present') {
      return { year: '', month: '', isPresent: val === '至今' || val === '现在' || val === 'present' }
    }
    const match = val.match(/(\d{4})[-./年]?(\d{1,2})?/)
    if (match) {
      return { year: match[1], month: match[2] || '', isPresent: false }
    }
    return { year: '', month: '', isPresent: false }
  }

  const { year, month, isPresent } = parseValue(value)
  
  // 生成年份选项（从当前年往前20年）
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 25 }, (_, i) => currentYear - i)
  
  // 生成月份选项
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

  const handleChange = (newYear: string, newMonth: string, newIsPresent: boolean) => {
    if (newIsPresent) {
      onChange('至今')
    } else if (newYear && newMonth) {
      onChange(`${newYear}-${newMonth}`)
    } else if (newYear) {
      onChange(newYear)
    } else {
      onChange('')
    }
  }

  const selectStyle: React.CSSProperties = {
    padding: '8px 10px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '0.5px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' fill-opacity='0.6' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: '28px',
    ...style
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <select
        value={isPresent ? '' : year}
        onChange={(e) => handleChange(e.target.value, month, false)}
        style={{ ...selectStyle, flex: 1 }}
        disabled={isPresent}
      >
        <option value="">年</option>
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <select
        value={isPresent ? '' : month}
        onChange={(e) => handleChange(year, e.target.value, false)}
        style={{ ...selectStyle, width: '70px' }}
        disabled={isPresent || !year}
      >
        <option value="">月</option>
        {months.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  )
}

/**
 * 时间范围选择器（开始 - 结束）
 */
function DateRangePicker({
  value,
  onChange,
  style = {}
}: {
  value: string
  onChange: (value: string) => void
  style?: React.CSSProperties
}) {
  // 解析时间范围（格式如 "2022-05-2023-10" 或 "2022.05 - 2023.10" 或 "2022-05-至今"）
  const parseRange = (val: string) => {
    if (!val) return { start: '', end: '' }
    
    // 尝试匹配各种格式
    const patterns = [
      /(\d{4}[-./]\d{1,2})[\s]*[-–~至]+[\s]*(\d{4}[-./]\d{1,2}|至今|现在|present)/i,
      /(\d{4}[-./]\d{1,2})[\s]*[-–~至]+[\s]*/,
      /(\d{4})[\s]*[-–~至]+[\s]*(\d{4}|至今|现在|present)/i,
    ]
    
    for (const pattern of patterns) {
      const match = val.match(pattern)
      if (match) {
        return { 
          start: match[1]?.replace(/[./]/g, '-') || '', 
          end: match[2]?.replace(/[./]/g, '-') || '' 
        }
      }
    }
    
    // 如果只有一个日期
    const singleMatch = val.match(/(\d{4}[-./]?\d{0,2})/)
    if (singleMatch) {
      return { start: singleMatch[1].replace(/[./]/g, '-'), end: '' }
    }
    
    return { start: '', end: '' }
  }

  const { start, end } = parseRange(value)
  
  const handleStartChange = (newStart: string) => {
    if (newStart && end) {
      onChange(`${newStart}-${end}`)
    } else if (newStart) {
      onChange(newStart)
    } else {
      onChange(end || '')
    }
  }
  
  const handleEndChange = (newEnd: string) => {
    if (start && newEnd) {
      onChange(`${start}-${newEnd}`)
    } else if (start) {
      onChange(`${start}-${newEnd || ''}`)
    } else {
      onChange('')
    }
  }

  const checkboxStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '12px',
    cursor: 'pointer',
    userSelect: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '4px' }}>开始</div>
          <YearMonthPicker value={start} onChange={handleStartChange} />
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', paddingTop: '18px' }}>→</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>结束</span>
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={end === '至今'}
                onChange={(e) => handleEndChange(e.target.checked ? '至今' : '')}
                style={{ width: '14px', height: '14px', accentColor: '#a78bfa' }}
              />
              至今
            </label>
          </div>
          <YearMonthPicker 
            value={end === '至今' ? '' : end} 
            onChange={handleEndChange}
            style={{ opacity: end === '至今' ? 0.5 : 1 }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * 各模块的编辑器
 */
function SectionEditor({ section, onUpdate }: { section: ResumeSection, onUpdate: (data: any) => void }) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '36px',
    padding: '8px 10px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '0.5px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    marginBottom: '10px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '13px',
    marginBottom: '6px',
    marginTop: '12px',
  }

  switch (section.type) {
    case 'contact':
      return (
        <div style={{ paddingTop: '16px' }}>
          <label style={labelStyle}>姓名</label>
          <input
            style={inputStyle}
            value={section.data?.name || ''}
            onChange={(e) => onUpdate({ ...section.data, name: e.target.value })}
            placeholder="请输入姓名"
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.18)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <label style={labelStyle}>电话</label>
          <input
            style={inputStyle}
            value={section.data?.phone || ''}
            onChange={(e) => onUpdate({ ...section.data, phone: e.target.value })}
            placeholder="请输入电话"
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.18)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <label style={labelStyle}>邮箱</label>
          <input
            style={inputStyle}
            value={section.data?.email || ''}
            onChange={(e) => onUpdate({ ...section.data, email: e.target.value })}
            placeholder="请输入邮箱"
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.18)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <label style={labelStyle}>地区</label>
          <input
            style={inputStyle}
            value={section.data?.location || ''}
            onChange={(e) => onUpdate({ ...section.data, location: e.target.value })}
            placeholder="请输入所在地区（如：北京市）"
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.18)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <label style={labelStyle}>求职意向</label>
          <input
            style={inputStyle}
            value={section.data?.objective || ''}
            onChange={(e) => onUpdate({ ...section.data, objective: e.target.value })}
            placeholder="请输入求职意向"
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.18)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>
      )

    case 'education':
      // 教育经历单独处理
      const eduItems = Array.isArray(section.data) ? section.data : []
      return (
        <div style={{ paddingTop: '16px' }}>
          {eduItems.map((item: any, index: number) => (
            <div 
              key={index} 
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>#{index + 1}</span>
                <button
                  onClick={() => {
                    const newItems = eduItems.filter((_: any, i: number) => i !== index)
                    onUpdate(newItems)
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '6px',
                    color: '#f87171',
                    padding: '4px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  删除
                </button>
              </div>
              {/* 第一行：学校 + 专业 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>学校</label>
                  <input
                    style={inputStyle}
                    value={item.title || item.school || ''}
                    onChange={(e) => {
                      const newItems = [...eduItems]
                      newItems[index] = { ...item, title: e.target.value, school: e.target.value }
                      onUpdate(newItems)
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>专业</label>
                  <input
                    style={inputStyle}
                    value={item.major || ''}
                    onChange={(e) => {
                      const newItems = [...eduItems]
                      newItems[index] = { ...item, major: e.target.value }
                      onUpdate(newItems)
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
                  />
                </div>
              </div>
              {/* 第二行：学位 */}
              <div>
                <label style={labelStyle}>学位</label>
                <input
                  style={inputStyle}
                  value={item.subtitle || item.degree || ''}
                  onChange={(e) => {
                    const newItems = [...eduItems]
                    newItems[index] = { ...item, subtitle: e.target.value, degree: e.target.value }
                    onUpdate(newItems)
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
                />
              </div>
              {/* 第三行：时间范围选择器 */}
              <div>
                <label style={labelStyle}>时间</label>
                <DateRangePicker
                  value={item.date || item.duration || ''}
                  onChange={(newDate) => {
                    const newItems = [...eduItems]
                    newItems[index] = { ...item, date: newDate, duration: newDate }
                    onUpdate(newItems)
                  }}
                />
              </div>
              {/* 描述 */}
              <label style={labelStyle}>描述</label>
              <textarea
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                value={Array.isArray(item.details) ? item.details.join('\n') : (item.details || '')}
                onChange={(e) => {
                  const newItems = [...eduItems]
                  newItems[index] = { ...item, details: e.target.value.split('\n').filter(Boolean) }
                  onUpdate(newItems)
                }}
                placeholder="每行一条描述"
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
              />
            </div>
          ))}
          <button
            onClick={() => onUpdate([...eduItems, { title: '', subtitle: '', major: '', date: '', details: [] }])}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(167, 139, 250, 0.15)',
              border: '2px dashed rgba(167, 139, 250, 0.4)',
              borderRadius: '12px',
              color: '#a78bfa',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + 添加教育
          </button>
        </div>
      )

    case 'experience':
    case 'projects':
      const items = Array.isArray(section.data) ? section.data : []
      const itemLabels = {
        experience: { title: '公司', subtitle: '职位', date: '时间' },
        projects: { title: '项目名称', subtitle: '角色', date: '时间' },
      }
      const labels = itemLabels[section.type as 'experience' | 'projects']
      
      return (
        <div style={{ paddingTop: '16px' }}>
          {items.map((item: any, index: number) => (
            <div 
              key={index} 
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>#{index + 1}</span>
                <button
                  onClick={() => {
                    const newItems = items.filter((_: any, i: number) => i !== index)
                    onUpdate(newItems)
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '6px',
                    color: '#f87171',
                    padding: '4px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  删除
                </button>
              </div>
              <div>
                <label style={labelStyle}>{labels.title}</label>
                <input
                  style={inputStyle}
                  value={item.title || ''}
                  onChange={(e) => {
                    const newItems = [...items]
                    newItems[index] = { ...item, title: e.target.value }
                    onUpdate(newItems)
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>{labels.date}</label>
                <DateRangePicker
                  value={item.date || ''}
                  onChange={(newDate) => {
                    const newItems = [...items]
                    newItems[index] = { ...item, date: newDate }
                    onUpdate(newItems)
                  }}
                />
              </div>
              <label style={labelStyle}>{labels.subtitle}</label>
              <input
                style={inputStyle}
                value={item.subtitle || ''}
                onChange={(e) => {
                  const newItems = [...items]
                  newItems[index] = { ...item, subtitle: e.target.value }
                  onUpdate(newItems)
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                }}
              />
              <label style={labelStyle}>描述</label>
              <textarea
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                value={Array.isArray(item.details) ? item.details.join('\n') : (item.details || '')}
                onChange={(e) => {
                  const newItems = [...items]
                  newItems[index] = { ...item, details: e.target.value.split('\n').filter(Boolean) }
                  onUpdate(newItems)
                }}
                placeholder="每行一条描述"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                }}
              />
              {section.type === 'projects' && (
                <>
                  <label style={labelStyle}>🔗 仓库链接（可选）</label>
                  <input
                    style={inputStyle}
                    value={item.repoUrl || ''}
                    onChange={(e) => {
                      const newItems = [...items]
                      newItems[index] = { ...item, repoUrl: e.target.value }
                      onUpdate(newItems)
                    }}
                    placeholder="如：https://github.com/user/repo"
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                    }}
                  />
                </>
              )}
            </div>
          ))}
          <button
            onClick={() => onUpdate([...items, { title: '', subtitle: '', date: '', details: [], repoUrl: '' }])}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(167, 139, 250, 0.15)',
              border: '2px dashed rgba(167, 139, 250, 0.4)',
              borderRadius: '12px',
              color: '#a78bfa',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(167, 139, 250, 0.25)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(167, 139, 250, 0.15)'
            }}
          >
            + 添加{section.title.replace('经历', '')}
          </button>
        </div>
      )

    case 'skills':
      const skills = Array.isArray(section.data) ? section.data : []
      return (
        <div style={{ paddingTop: '16px' }}>
          {skills.map((skill: any, index: number) => {
            // 兼容旧格式（字符串）和新格式（对象）
            const isObject = typeof skill === 'object' && skill !== null
            const category = isObject ? (skill.category || '') : skill
            const details = isObject ? (skill.details || '') : ''
            
            return (
              <div 
                key={index}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>#{index + 1}</span>
                  <button
                    onClick={() => onUpdate(skills.filter((_: any, i: number) => i !== index))}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '6px',
                      color: '#f87171',
                      padding: '4px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    删除
                  </button>
                </div>
                <label style={labelStyle}>技能名称</label>
                <input
                  style={inputStyle}
                  value={category}
                  onChange={(e) => {
                    const newSkills = [...skills]
                    newSkills[index] = { category: e.target.value, details }
                    onUpdate(newSkills)
                  }}
                  placeholder="如：Java基础"
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
                />
                <label style={labelStyle}>技能描述</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                  value={details}
                  onChange={(e) => {
                    const newSkills = [...skills]
                    newSkills[index] = { category, details: e.target.value }
                    onUpdate(newSkills)
                  }}
                  placeholder="详细描述你对该技能的掌握程度"
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
                />
              </div>
            )
          })}
          <button
            onClick={() => onUpdate([...skills, { category: '', details: '' }])}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(167, 139, 250, 0.15)',
              border: '2px dashed rgba(167, 139, 250, 0.4)',
              borderRadius: '12px',
              color: '#a78bfa',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + 添加技能
          </button>
        </div>
      )

    case 'awards':
      const awards = Array.isArray(section.data) ? section.data : []
      return (
        <div style={{ paddingTop: '16px' }}>
          {awards.map((award: any, index: number) => (
            <div 
              key={index}
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '12px',
                alignItems: 'center',
              }}
            >
              <input
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                value={typeof award === 'string' ? award : award.title || ''}
                onChange={(e) => {
                  const newAwards = [...awards]
                  newAwards[index] = e.target.value
                  onUpdate(newAwards)
                }}
                placeholder="奖项名称"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                }}
              />
              <button
                onClick={() => onUpdate(awards.filter((_: any, i: number) => i !== index))}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f87171',
                  padding: '12px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => onUpdate([...awards, ''])}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(167, 139, 250, 0.15)',
              border: '2px dashed rgba(167, 139, 250, 0.4)',
              borderRadius: '12px',
              color: '#a78bfa',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + 添加奖项
          </button>
        </div>
      )

    case 'summary':
      return (
        <div style={{ paddingTop: '16px' }}>
          <textarea
            style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
            value={section.data || ''}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder="请输入个人总结..."
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.18)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>
      )

    case 'opensource':
      const opensourceItems = Array.isArray(section.data) ? section.data : []
      return (
        <div style={{ paddingTop: '16px' }}>
          {opensourceItems.map((item: any, idx: number) => (
            <div key={idx} style={{ 
              background: 'rgba(255, 255, 255, 0.03)', 
              borderRadius: '8px', 
              padding: '12px', 
              marginBottom: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>开源项目 {idx + 1}</span>
                <button
                  onClick={() => {
                    const newItems = opensourceItems.filter((_: any, i: number) => i !== idx)
                    onUpdate(newItems)
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#f87171',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  删除
                </button>
              </div>
              <label style={labelStyle}>项目名称</label>
              <input
                style={inputStyle}
                value={item.title || ''}
                onChange={(e) => {
                  const newItems = [...opensourceItems]
                  newItems[idx] = { ...item, title: e.target.value }
                  onUpdate(newItems)
                }}
                placeholder="如：Kubernetes"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.18)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <label style={labelStyle}>角色/贡献类型</label>
              <input
                style={inputStyle}
                value={item.subtitle || ''}
                onChange={(e) => {
                  const newItems = [...opensourceItems]
                  newItems[idx] = { ...item, subtitle: e.target.value }
                  onUpdate(newItems)
                }}
                placeholder="如：核心贡献者"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.18)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <label style={labelStyle}>贡献描述（每行一条）</label>
              <textarea
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                value={(item.items || []).join('\n')}
                onChange={(e) => {
                  const newItems = [...opensourceItems]
                  newItems[idx] = { ...item, items: e.target.value.split('\n').filter((s: string) => s.trim()) }
                  onUpdate(newItems)
                }}
                placeholder="提交了性能优化 PR&#10;修复了关键 Bug"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.18)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <label style={labelStyle}>🔗 仓库链接（可选）</label>
              <input
                style={inputStyle}
                value={item.repoUrl || ''}
                onChange={(e) => {
                  const newItems = [...opensourceItems]
                  newItems[idx] = { ...item, repoUrl: e.target.value }
                  onUpdate(newItems)
                }}
                placeholder="如：https://github.com/kubernetes/kubernetes"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.18)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
          ))}
          <button
            onClick={() => onUpdate([...opensourceItems, { title: '', subtitle: '', items: [], repoUrl: '' }])}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(167, 139, 250, 0.15)',
              border: '2px dashed rgba(167, 139, 250, 0.4)',
              borderRadius: '12px',
              color: '#a78bfa',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + 添加开源项目
          </button>
        </div>
      )

    default:
      return null
  }
}

/**
 * 主编辑器组件
 */
export default function ResumeEditor({ resumeData, onSave, saving }: Props) {
  const [sections, setSections] = useState<ResumeSection[]>(defaultSections)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoad = useRef(true) // 跟踪是否为首次加载
  
  // AI 导入相关状态
  const [aiImportModal, setAiImportModal] = useState<{ open: boolean; sectionId: string; sectionTitle: string; sectionType: string }>({
    open: false,
    sectionId: '',
    sectionTitle: '',
    sectionType: ''
  })
  const [importing, setImporting] = useState<string>('') // 正在导入的模块 ID

  // 展开/收起全部
  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedIds(new Set())
      setAllExpanded(false)
    } else {
      setExpandedIds(new Set(sections.map(s => s.id)))
      setAllExpanded(true)
    }
  }

  // 切换单个模块展开状态
  const toggleSection = (sectionId: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      // 更新 allExpanded 状态
      setAllExpanded(newSet.size === sections.length)
      return newSet
    })
  }

  // 打开 AI 导入弹窗
  const openAIImportModal = (section: ResumeSection) => {
    setAiImportModal({
      open: true,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionType: section.type
    })
  }

  // 执行 AI 导入
  const handleAIImport = async (text: string) => {
    if (!text.trim() || !aiImportModal.sectionId) return
    
    setImporting(aiImportModal.sectionId)
    
    try {
      const response = await fetch('/api/resume/parse-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          section_type: aiImportModal.sectionType
          // provider 不传，使用后端默认配置
        })
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || '解析失败')
      }
      
      const result = await response.json()
      
      // 更新对应模块的数据
      setSections(prev => prev.map(section => {
        if (section.id !== aiImportModal.sectionId) return section
        
        // 根据模块类型处理数据
        let newData = result.data
        
        // 特殊处理 contact 类型
        if (section.type === 'contact' && typeof newData === 'object') {
          newData = {
            name: newData.name || section.data?.name || '',
            phone: newData.phone || section.data?.phone || '',
            email: newData.email || section.data?.email || '',
            location: newData.location || section.data?.location || '',
            objective: newData.objective || section.data?.objective || ''
          }
        }
        
        // 特殊处理 projects/experience 类型：highlights → details
        if ((section.type === 'projects' || section.type === 'experience') && Array.isArray(newData)) {
          newData = newData.map((item: any) => ({
            ...item,
            details: item.details || item.highlights || [],
            // 移除 highlights 避免重复
            highlights: undefined
          }))
        }
        
        // 特殊处理数组类型，合并而不是替换
        if (Array.isArray(newData) && Array.isArray(section.data)) {
          // 如果现有数据为空或只有空项，直接替换
          const hasContent = section.data.some((item: any) => {
            if (typeof item === 'string') return item.trim()
            if (typeof item === 'object') return Object.values(item).some(v => v && String(v).trim())
            return false
          })
          if (!hasContent) {
            newData = newData
          } else {
            // 追加新数据
            newData = [...section.data, ...newData]
          }
        }
        
        return { ...section, data: newData }
      }))
      
      // 自动展开该模块
      setExpandedIds(prev => new Set([...prev, aiImportModal.sectionId]))
      
      // 关闭弹窗
      setAiImportModal({ open: false, sectionId: '', sectionTitle: '', sectionType: '' })
      
    } catch (err: any) {
      alert(`AI 导入失败: ${err.message || err}`)
    } finally {
      setImporting('')
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖动 8px 后才激活拖拽
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  /**
   * 从传入的简历数据初始化各模块
   */
  useEffect(() => {
    if (resumeData) {
      // 只在首次加载时折叠所有分组，保存后不折叠
      if (isInitialLoad.current) {
        setExpandedIds(new Set())
        setAllExpanded(false)
        isInitialLoad.current = false
      }
      // 获取自定义标题
      const customTitles = resumeData.sectionTitles || {}
      
      setSections(prev => prev.map(section => {
        // 应用自定义标题（如果有）
        const customTitle = customTitles[section.type]
        const baseSection = customTitle ? { ...section, title: customTitle } : section
        
        switch (section.type) {
          case 'contact':
            return {
              ...baseSection,
              data: {
                name: resumeData.name || '',
                phone: resumeData.contact?.phone || resumeData.phone || '',
                email: resumeData.contact?.email || resumeData.email || '',
                location: resumeData.contact?.location || resumeData.location || '',
                objective: resumeData.objective || resumeData.contact?.role || resumeData.求职意向 || '',
              }
            }
          case 'education':
            // 确保字段正确映射到前端格式
            const eduData = resumeData.education || []
            return { 
              ...baseSection, 
              data: eduData.map((item: any) => ({
                title: item.title || item.school || '',
                subtitle: item.subtitle || item.degree || '',
                major: item.major || '',
                date: item.date || item.duration || '',
                details: item.details || []
              }))
            }
          case 'experience':
            // 确保字段正确映射到前端格式
            const expData = resumeData.internships || resumeData.experience || []
            return { 
              ...baseSection, 
              data: expData.map((item: any) => ({
                title: item.title || item.company || '',
                subtitle: item.subtitle || item.position || '',
                date: item.date || item.duration || '',
                details: item.details || item.highlights || item.achievements || []
              }))
            }
          case 'projects':
            // 确保字段正确映射到前端格式
            const projData = resumeData.projects || []
            return { 
              ...baseSection, 
              data: projData.map((item: any) => ({
                title: item.title || item.name || '',
                subtitle: item.subtitle || item.role || '',
                date: item.date || '',
                details: item.details || item.highlights || [],
                repoUrl: item.repoUrl || ''
              }))
            }
          case 'skills':
            return { ...baseSection, data: resumeData.skills || [] }
          case 'opensource':
            const osData = resumeData.openSource || []
            return { 
              ...baseSection, 
              data: osData.map((item: any) => ({
                title: item.title || '',
                subtitle: item.subtitle || '',
                items: item.items || [],
                repoUrl: item.repoUrl || ''
              }))
            }
          case 'awards':
            return { ...baseSection, data: resumeData.awards || resumeData.honors || [] }
          case 'summary':
            return { ...baseSection, data: resumeData.summary || '' }
          default:
            return baseSection
        }
      }))
    }
  }, [resumeData])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        
        // 拖拽后防抖保存（500ms 内连续拖拽只触发一次）
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
        }
        saveTimerRef.current = setTimeout(() => {
          // 使用新顺序构建数据并保存
          const contactSection = newItems.find(s => s.type === 'contact')
          const educationSection = newItems.find(s => s.type === 'education')
          const experienceSection = newItems.find(s => s.type === 'experience')
          const projectsSection = newItems.find(s => s.type === 'projects')
          const skillsSection = newItems.find(s => s.type === 'skills')
          const awardsSection = newItems.find(s => s.type === 'awards')
          const summarySection = newItems.find(s => s.type === 'summary')
          
          // 转换教育经历格式
          const convertEducationFormat = (items: any[]) => {
            return items.map(item => ({
              school: item.title || item.school || '',
              degree: item.subtitle || item.degree || '',
              major: item.major || '',
              duration: item.date || item.duration || '',
              details: Array.isArray(item.details) ? item.details : [],  // 保存描述字段
              title: item.title || '',
              date: item.date || '',
            }))
          }
          
          // 转换工作经历格式
          const convertExperienceFormat = (items: any[]) => {
            return items.map(item => ({
              title: item.title || '',
              subtitle: item.subtitle || '',
              date: item.date || '',
              highlights: Array.isArray(item.details) ? item.details : (item.highlights || []),
            }))
          }
          
          // 转换项目经历格式
          const convertProjectsFormat = (items: any[]) => {
            return items.map(item => ({
              title: item.title || '',
              name: item.title || '',
              role: item.subtitle || '',
              subtitle: item.subtitle || '',
              date: item.date || '',
              highlights: Array.isArray(item.details) ? item.details : (item.highlights || []),
            }))
          }
          
          const newResumeData = {
            name: contactSection?.data?.name || '',
            contact: {
              phone: contactSection?.data?.phone || '',
              email: contactSection?.data?.email || '',
              location: contactSection?.data?.location || '',
            },
            objective: contactSection?.data?.objective || '',
            education: convertEducationFormat(educationSection?.data || []),
            internships: convertExperienceFormat(experienceSection?.data || []),
            projects: convertProjectsFormat(projectsSection?.data || []),
            skills: skillsSection?.data || [],
            awards: awardsSection?.data || [],
            summary: summarySection?.data || '',
          }
          
          const sectionOrder = newItems
            .filter(s => s.type !== 'contact')
            .map(s => {
              // 将 experience 映射为 internships（因为数据存在 internships 字段）
              if (s.type === 'experience') return 'internships'
              return s.type
            })
          
          onSave(newResumeData, sectionOrder)
        }, 500) // 防抖 500ms
        
        return newItems
      })
    }
  }

  function handleSectionUpdate(sectionId: string, data: any) {
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, data } : s
    ))
  }

  function handleTitleChange(sectionId: string, title: string) {
    setSections(prev => {
      const newSections = prev.map(s => 
        s.id === sectionId ? { ...s, title } : s
      )
      
      // 防抖自动保存（500ms 内连续修改只触发一次）
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = setTimeout(() => {
        // 自动触发保存
        triggerAutoSave(newSections)
      }, 500)
      
      return newSections
    })
  }
  
  // 自动保存函数（复用 handleSave 逻辑）
  function triggerAutoSave(currentSections: ResumeSection[]) {
    const contactSection = currentSections.find(s => s.type === 'contact')
    const educationSection = currentSections.find(s => s.type === 'education')
    const experienceSection = currentSections.find(s => s.type === 'experience')
    const projectsSection = currentSections.find(s => s.type === 'projects')
    const opensourceSection = currentSections.find(s => s.type === 'opensource')
    const skillsSection = currentSections.find(s => s.type === 'skills')
    const awardsSection = currentSections.find(s => s.type === 'awards')
    const summarySection = currentSections.find(s => s.type === 'summary')

    const convertEducationFormat = (items: any[]) => items.map(item => ({
      school: item.title || item.school || '',
      degree: item.subtitle || item.degree || '',
      major: item.major || '',
      duration: item.date || item.duration || '',
      details: Array.isArray(item.details) ? item.details : [],
      title: item.title || '',
      date: item.date || '',
    }))

    const convertExperienceFormat = (items: any[]) => items.map(item => ({
      title: item.title || '',
      subtitle: item.subtitle || '',
      date: item.date || '',
      highlights: Array.isArray(item.details) ? item.details : (item.highlights || []),
    }))

    const convertProjectsFormat = (items: any[]) => items.map(item => ({
      title: item.title || '',
      name: item.title || '',
      role: item.subtitle || '',
      subtitle: item.subtitle || '',
      date: item.date || '',
      highlights: Array.isArray(item.details) ? item.details : (item.highlights || []),
      repoUrl: item.repoUrl || '',
    }))

    const sectionTitles: Record<string, string> = {}
    currentSections.forEach(s => {
      if (s.type !== 'contact') {
        const defaultTitle = defaultSections.find(d => d.type === s.type)?.title
        if (s.title !== defaultTitle) {
          sectionTitles[s.type] = s.title
        }
      }
    })

    const newResumeData = {
      name: contactSection?.data?.name || '',
      contact: {
        phone: contactSection?.data?.phone || '',
        email: contactSection?.data?.email || '',
        location: contactSection?.data?.location || '',
      },
      objective: contactSection?.data?.objective || '',
      education: convertEducationFormat(educationSection?.data || []),
      internships: convertExperienceFormat(experienceSection?.data || []),
      projects: convertProjectsFormat(projectsSection?.data || []),
      openSource: opensourceSection?.data || [],
      skills: skillsSection?.data || [],
      awards: awardsSection?.data || [],
      summary: summarySection?.data || '',
      sectionTitles: Object.keys(sectionTitles).length > 0 ? sectionTitles : undefined,
    }

    const sectionOrder = currentSections
      .filter(s => s.type !== 'contact')
      .map(s => {
        if (s.type === 'experience') return 'internships'
        return s.type
      })

    onSave(newResumeData, sectionOrder)
  }

  function handleSave() {
    // 将编辑器数据转换回简历 JSON 格式
    const contactSection = sections.find(s => s.type === 'contact')
    const educationSection = sections.find(s => s.type === 'education')
    const experienceSection = sections.find(s => s.type === 'experience')
    const projectsSection = sections.find(s => s.type === 'projects')
    const opensourceSection = sections.find(s => s.type === 'opensource')
    const skillsSection = sections.find(s => s.type === 'skills')
    const awardsSection = sections.find(s => s.type === 'awards')
    const summarySection = sections.find(s => s.type === 'summary')

    // 转换教育经历格式：前端字段 → 后端字段
    const convertEducationFormat = (items: any[]) => {
      return items.map(item => ({
        school: item.title || item.school || '',      // title → school
        degree: item.subtitle || item.degree || '',   // subtitle → degree
        major: item.major || '',
        duration: item.date || item.duration || '',   // date → duration
        details: Array.isArray(item.details) ? item.details : [],  // 保存描述字段
        // 同时保留原字段以兼容
        title: item.title || '',
        date: item.date || '',
      }))
    }

    // 转换工作经历格式：details -> highlights
    const convertExperienceFormat = (items: any[]) => {
      return items.map(item => ({
        title: item.title || '',
        subtitle: item.subtitle || '',
        date: item.date || '',
        highlights: Array.isArray(item.details) ? item.details : (item.highlights || []),
      }))
    }

    // 转换项目经历格式：subtitle → role, details → highlights
    const convertProjectsFormat = (items: any[]) => {
      return items.map(item => ({
        title: item.title || '',
        name: item.title || '',                       // title 也作为 name
        role: item.subtitle || '',                    // subtitle → role
        subtitle: item.subtitle || '',                // 保留 subtitle
        date: item.date || '',
        highlights: Array.isArray(item.details) ? item.details : (item.highlights || []),
        repoUrl: item.repoUrl || '',                  // 仓库链接
      }))
    }

    // 构建自定义模块标题
    const sectionTitles: Record<string, string> = {}
    sections.forEach(s => {
      if (s.type !== 'contact') {
        const defaultTitle = defaultSections.find(d => d.type === s.type)?.title
        if (s.title !== defaultTitle) {
          sectionTitles[s.type] = s.title
        }
      }
    })

    const newResumeData = {
      name: contactSection?.data?.name || '',
      contact: {
        phone: contactSection?.data?.phone || '',
        email: contactSection?.data?.email || '',
        location: contactSection?.data?.location || '',
      },
      objective: contactSection?.data?.objective || '',
      education: convertEducationFormat(educationSection?.data || []),
      internships: convertExperienceFormat(experienceSection?.data || []),
      projects: convertProjectsFormat(projectsSection?.data || []),
      openSource: opensourceSection?.data || [],
      skills: skillsSection?.data || [],
      awards: awardsSection?.data || [],
      summary: summarySection?.data || '',
      sectionTitles: Object.keys(sectionTitles).length > 0 ? sectionTitles : undefined,
    }

    // 获取当前 section 顺序（排除 contact，因为它总是在头部）
    const sectionOrder = sections
      .filter(s => s.type !== 'contact')
      .map(s => {
        if (s.type === 'experience') return 'internships'
        return s.type
      })

    onSave(newResumeData, sectionOrder)
  }

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 编辑器标题 */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>✏️</span>
          可视化编辑
        </div>
        <button
          onClick={toggleAllExpanded}
          style={{
            padding: '4px 10px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
          }}
        >
          {allExpanded ? '收起全部' : '展开全部'}
        </button>
      </div>

      {/* 可滚动的模块列表 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => (
              <SortableSection
                key={section.id}
                section={section}
                expanded={expandedIds.has(section.id)}
                onToggle={() => toggleSection(section.id)}
                onUpdate={(data) => handleSectionUpdate(section.id, data)}
                onTitleChange={(title) => handleTitleChange(section.id, title)}
                onAIImport={() => openAIImportModal(section)}
                importing={importing === section.id}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* AI 导入弹窗 */}
      <AIImportModal
        isOpen={aiImportModal.open}
        sectionType={aiImportModal.sectionType}
        sectionTitle={aiImportModal.sectionTitle}
        onClose={() => setAiImportModal({ open: false, sectionId: '', sectionTitle: '', sectionType: '' })}
        onImport={handleAIImport}
        importing={!!importing}
      />

      {/* 保存按钮 */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(0, 0, 0, 0.2)',
      }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '14px',
            background: saving 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.4)',
            transition: 'all 0.3s ease',
          }}
        >
          {saving ? '保存中...' : '💾 保存并更新'}
        </button>
      </div>
    </div>
  )
}
