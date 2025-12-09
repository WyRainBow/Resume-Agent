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
 * 可排序的模块卡片
 */
function SortableSection({ 
  section, 
  expanded, 
  onToggle, 
  onUpdate,
  onTitleChange
}: { 
  section: ResumeSection
  expanded: boolean
  onToggle: () => void
  onUpdate: (data: any) => void
  onTitleChange: (title: string) => void
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
              {/* 第二行：学位 + 时间 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                <div>
                  <label style={labelStyle}>时间</label>
                  <input
                    style={inputStyle}
                    value={item.date || item.duration || ''}
                    onChange={(e) => {
                      const newItems = [...eduItems]
                      newItems[index] = { ...item, date: e.target.value, duration: e.target.value }
                      onUpdate(newItems)
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
                  />
                </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  <input
                    style={inputStyle}
                    value={item.date || ''}
                    onChange={(e) => {
                      const newItems = [...items]
                      newItems[index] = { ...item, date: e.target.value }
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
            .map(s => s.type)
          
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
      .map(s => s.type)

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
      .map(s => s.type)

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
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

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
