/**
 * ResumeEditor 主组件
 * 可视化简历编辑器，支持拖拽排序、AI 导入等功能
 */
import React, { useState, useEffect, useRef } from 'react'
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
} from '@dnd-kit/sortable'

import type { ResumeSection, ResumeEditorProps } from './types'
import { defaultSections } from './constants'
import { AIImportModal } from './AIImportModal'
import { SortableSection } from './SortableSection'

export default function ResumeEditor({ resumeData, onSave, onSaveAndRender, saving }: ResumeEditorProps) {
  const [sections, setSections] = useState<ResumeSection[]>(defaultSections)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoad = useRef(true)
  
  // AI 导入相关状态
  const [aiImportModal, setAiImportModal] = useState<{ open: boolean; sectionId: string; sectionTitle: string; sectionType: string }>({
    open: false,
    sectionId: '',
    sectionTitle: '',
    sectionType: ''
  })
  const [importing, setImporting] = useState<string>('')

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

  // 保存 AI 解析结果
  const handleAISave = (parsedData: any) => {
    if (!aiImportModal.sectionId) return
    
    setSections(prev => prev.map(section => {
      if (section.id !== aiImportModal.sectionId) return section
      
      let newData = parsedData
      
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
          highlights: undefined
        }))
      }
      
      // 特殊处理数组类型，合并而不是替换
      if (Array.isArray(newData) && Array.isArray(section.data)) {
        const hasContent = section.data.some((item: any) => {
          if (typeof item === 'string') return item.trim()
          if (typeof item === 'object') return Object.values(item).some(v => v && String(v).trim())
          return false
        })
        if (hasContent) {
          newData = [...section.data, ...newData]
        }
      }
      
      return { ...section, data: newData }
    }))
    
    // 自动展开该模块
    setExpandedIds(prev => new Set([...prev, aiImportModal.sectionId]))
    
    // 关闭弹窗
    setAiImportModal({ open: false, sectionId: '', sectionTitle: '', sectionType: '' })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 从传入的简历数据初始化各模块
  useEffect(() => {
    if (resumeData) {
      if (isInitialLoad.current) {
        setExpandedIds(new Set())
        setAllExpanded(false)
        isInitialLoad.current = false
      }
      
      const customTitles = resumeData.sectionTitles || {}
      
      setSections(prev => prev.map(section => {
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
            const eduData = resumeData.education || []
            return { 
              ...baseSection, 
              data: eduData.map((item: any) => ({
                title: item.title || item.school || '',
                subtitle: item.subtitle || item.major || '',
                degree: item.degree || '',
                date: item.date || item.duration || '',
                details: item.details || []
              }))
            }
          case 'experience':
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
                items: item.items || item.highlights || [],
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
        
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
        }
        saveTimerRef.current = setTimeout(() => {
          triggerAutoSave(newItems)
        }, 500)
        
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
      
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = setTimeout(() => {
        triggerAutoSave(newSections)
      }, 500)
      
      return newSections
    })
  }
  
  // 自动保存函数
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
      title: item.title || item.school || '',
      subtitle: item.subtitle || item.major || '',
      degree: item.degree || '',
      date: item.date || item.duration || '',
      details: Array.isArray(item.details) ? item.details : [],
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

  async function handleSave() {
    // 构建最新的简历数据
    const contactSection = sections.find(s => s.type === 'contact')
    const educationSection = sections.find(s => s.type === 'education')
    const experienceSection = sections.find(s => s.type === 'experience')
    const projectsSection = sections.find(s => s.type === 'projects')
    const opensourceSection = sections.find(s => s.type === 'opensource')
    const skillsSection = sections.find(s => s.type === 'skills')
    const awardsSection = sections.find(s => s.type === 'awards')
    const summarySection = sections.find(s => s.type === 'summary')

    const convertEducationFormat = (items: any[]) => items.map(item => ({
      title: item.title || item.school || '',
      subtitle: item.subtitle || item.major || '',
      degree: item.degree || '',
      date: item.date || item.duration || '',
      details: Array.isArray(item.details) ? item.details : [],
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

    // 先触发数据保存
    triggerAutoSave(sections)
    
    // 再触发 PDF 渲染，传入最新数据
    if (onSaveAndRender) {
      await onSaveAndRender(newResumeData)
    }
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
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
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
        onSave={handleAISave}
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
          {saving ? '保存中...' : '保存并更新'}
        </button>
      </div>
    </div>
  )
}

// 导出类型和常量供外部使用
export type { ResumeSection, ResumeEditorProps } from './types'
export { defaultSections } from './constants'
