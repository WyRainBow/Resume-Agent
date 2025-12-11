/**
 * 各模块的编辑器组件
 */
import React from 'react'
import type { SectionEditorProps, ResumeSection } from './types'
import { DateRangePicker } from './DateRangePicker'

export function SectionEditor({ section, onUpdate }: SectionEditorProps) {
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
                <DateRangePicker
                  value={item.date || item.duration || ''}
                  onChange={(newDate) => {
                    const newItems = [...eduItems]
                    newItems[index] = { ...item, date: newDate, duration: newDate }
                    onUpdate(newItems)
                  }}
                />
              </div>
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
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
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
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
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
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
              />
              {section.type === 'projects' && (
                <>
                  <label style={labelStyle}>仓库链接（可选）</label>
                  <input
                    style={inputStyle}
                    value={item.repoUrl || ''}
                    onChange={(e) => {
                      const newItems = [...items]
                      newItems[index] = { ...item, repoUrl: e.target.value }
                      onUpdate(newItems)
                    }}
                    placeholder="如：https://github.com/user/repo"
                    onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
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
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(167, 139, 250, 0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(167, 139, 250, 0.15)'}
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
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
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
              <label style={labelStyle}>仓库链接（可选）</label>
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
