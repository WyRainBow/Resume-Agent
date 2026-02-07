/**
 * 滚动编辑模式组件
 * 所有模块在一个页面中从上到下排列，可以滚动查看和编辑
 */
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Check, X } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { ResumeData, MenuSection, GlobalSettings, BasicInfo, Project, Experience, Education, OpenSource, Award } from './types'
import BasicPanel from './EditPanel/BasicPanel'
import ProjectPanel from './EditPanel/ProjectPanel'
import ExperiencePanel from './EditPanel/ExperiencePanel'
import EducationPanel from './EditPanel/EducationPanel'
import SkillPanel from './EditPanel/SkillPanel'
import OpenSourcePanel from './EditPanel/OpenSourcePanel'
import AwardPanel from './EditPanel/AwardPanel'

interface ScrollEditModeProps {
  menuSections: MenuSection[]
  resumeData: ResumeData
  updateBasicInfo: (info: Partial<BasicInfo>) => void
  updateProject: (project: Project) => void
  deleteProject: (id: string) => void
  reorderProjects: (projects: Project[]) => void
  updateExperience: (experience: Experience) => void
  deleteExperience: (id: string) => void
  reorderExperiences: (experiences: Experience[]) => void
  updateEducation: (education: Education) => void
  deleteEducation: (id: string) => void
  reorderEducations: (educations: Education[]) => void
  updateOpenSource: (openSource: OpenSource) => void
  deleteOpenSource: (id: string) => void
  reorderOpenSources: (openSources: OpenSource[]) => void
  updateAward: (award: Award) => void
  deleteAward: (id: string) => void
  reorderAwards: (awards: Award[]) => void
  updateSkillContent: (content: string) => void
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void
  updateMenuSections: (sections: MenuSection[]) => void
  handleAIImport?: (section: string) => void
}

export default function ScrollEditMode({
  menuSections,
  resumeData,
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
  updateSkillContent,
  updateGlobalSettings,
  updateMenuSections,
  handleAIImport,
}: ScrollEditModeProps) {
  // 根据 menuSections 的顺序获取启用的模块
  const enabledSections = menuSections
    .filter(section => section.enabled)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  
  // 跟踪正在编辑的模块 ID
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 当进入编辑模式时，聚焦输入框
  useEffect(() => {
    if (editingSectionId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingSectionId])

  // 开始编辑标题
  const handleStartEdit = (section: MenuSection) => {
    if (section.id === 'basic') return // 基本信息不可编辑
    setEditingSectionId(section.id)
    setEditingTitle(section.title)
  }

  // 保存标题
  const handleSaveTitle = (sectionId: string) => {
    if (!editingTitle.trim()) {
      // 如果标题为空，恢复原值
      const section = menuSections.find(s => s.id === sectionId)
      setEditingTitle(section?.title || '')
      setEditingSectionId(null)
      return
    }
    
    const newSections = menuSections.map(s =>
      s.id === sectionId ? { ...s, title: editingTitle.trim() } : s
    )
    updateMenuSections(newSections)
    setEditingSectionId(null)
  }

  // 取消编辑
  const handleCancelEdit = (sectionId: string) => {
    const section = menuSections.find(s => s.id === sectionId)
    setEditingTitle(section?.title || '')
    setEditingSectionId(null)
  }

  const renderSection = (section: MenuSection) => {
    switch (section.id) {
      case 'basic':
        return (
          <BasicPanel
            basic={resumeData.basic}
            onUpdate={updateBasicInfo}
          />
        )

      case 'education':
        return (
          <EducationPanel
            educations={resumeData.education}
            onUpdate={updateEducation}
            onDelete={deleteEducation}
            onReorder={reorderEducations}
            onAIImport={handleAIImport ? () => handleAIImport('education') : undefined}
          />
        )

      case 'experience':
        return (
          <ExperiencePanel
            experiences={resumeData.experience}
            onUpdate={updateExperience}
            onDelete={deleteExperience}
            onReorder={reorderExperiences}
            globalSettings={resumeData.globalSettings}
            updateGlobalSettings={updateGlobalSettings}
            onAIImport={handleAIImport ? () => handleAIImport('experience') : undefined}
          />
        )

      case 'projects':
        return (
          <ProjectPanel
            projects={resumeData.projects}
            onUpdate={updateProject}
            onDelete={deleteProject}
            onReorder={reorderProjects}
            onAIImport={handleAIImport ? () => handleAIImport('projects') : undefined}
          />
        )

      case 'skills':
        return (
          <SkillPanel
            skillContent={resumeData.skillContent}
            onUpdate={updateSkillContent}
            onAIImport={handleAIImport ? () => handleAIImport('skills') : undefined}
            resumeData={resumeData}
          />
        )

      case 'openSource':
        return (
          <OpenSourcePanel
            openSources={resumeData.openSource || []}
            onUpdate={updateOpenSource}
            onDelete={deleteOpenSource}
            onReorder={reorderOpenSources}
            onAIImport={handleAIImport ? () => handleAIImport('openSource') : undefined}
            globalSettings={resumeData.globalSettings}
            updateGlobalSettings={updateGlobalSettings}
          />
        )

      case 'awards':
        return (
          <AwardPanel
            awards={resumeData.awards || []}
            onUpdate={updateAward}
            onDelete={deleteAward}
            onReorder={reorderAwards}
            onAIImport={handleAIImport ? () => handleAIImport('awards') : undefined}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto py-8 px-6 space-y-8">
        {enabledSections.map((section, index) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={cn(
              'rounded-2xl border overflow-hidden shadow-sm group',
              'bg-white border-slate-200',
              'dark:bg-slate-900 dark:border-slate-700',
              'hover:shadow-md transition-shadow duration-200'
            )}
          >
            {/* 模块标题 */}
            <div className={cn(
              'px-8 py-5 border-b',
              'bg-gradient-to-r from-slate-50 to-white',
              'dark:from-slate-800 dark:to-slate-900',
              'border-slate-200 dark:border-slate-700'
            )}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{section.icon}</span>
                {editingSectionId === section.id ? (
                  // 编辑模式
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSaveTitle(section.id)
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          handleCancelEdit(section.id)
                        }
                      }}
                      onBlur={() => handleSaveTitle(section.id)}
                      className={cn(
                        'flex-1 text-xl font-bold bg-transparent outline-none',
                        'text-slate-900 dark:text-slate-100',
                        'border-b-2 border-primary pb-1'
                      )}
                    />
                    <button
                      onClick={() => handleSaveTitle(section.id)}
                      className={cn(
                        'p-1.5 rounded-md',
                        'hover:bg-green-100 dark:hover:bg-green-900/30',
                        'text-green-600 dark:text-green-400',
                        'transition-colors'
                      )}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCancelEdit(section.id)}
                      className={cn(
                        'p-1.5 rounded-md',
                        'hover:bg-red-100 dark:hover:bg-red-900/30',
                        'text-red-600 dark:text-red-400',
                        'transition-colors'
                      )}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  // 显示模式
                  <div className="flex items-center gap-2 flex-1">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex-1">
                  {section.title}
                </h2>
                    {section.id !== 'basic' && (
                      <button
                        onClick={() => handleStartEdit(section)}
                        className={cn(
                          'p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity',
                          'hover:bg-slate-100 dark:hover:bg-slate-700',
                          'text-slate-600 dark:text-slate-400'
                        )}
                        title="编辑标题"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 模块内容 */}
            <div className="p-8">
              {renderSection(section)}
            </div>
          </motion.div>
        ))}
        
        {/* 底部留白 */}
        <div className="h-8" />
      </div>
    </div>
  )
}

