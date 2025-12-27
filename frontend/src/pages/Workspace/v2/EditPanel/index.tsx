/**
 * 编辑面板组件（第二列）
 * 根据当前选中的模块动态渲染对应的编辑面板
 * 支持两种模式：编辑模式（手动编辑）和对话模式（AI 对话生成）
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { MenuSection, ResumeData, BasicInfo, Project, Experience, Education, OpenSource, Award, GlobalSettings } from '../types'
import BasicPanel from './BasicPanel'
import ProjectPanel from './ProjectPanel'
import ExperiencePanel from './ExperiencePanel'
import EducationPanel from './EducationPanel'
import SkillPanel from './SkillPanel'
import OpenSourcePanel from './OpenSourcePanel'
import AwardPanel from './AwardPanel'
import EditModeSelector, { type EditMode } from './EditModeSelector'
import ConversationPanel from './ConversationPanel'

interface EditPanelProps {
  activeSection: string
  menuSections: MenuSection[]
  resumeData: ResumeData
  setResumeData: (data: ResumeData | ((prev: ResumeData) => ResumeData)) => void
  // 更新回调
  updateBasicInfo: (data: Partial<BasicInfo>) => void
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
  updateMenuSections: (sections: MenuSection[]) => void
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void
  // AI 导入回调
  onAIImport?: (section: string) => void
}

export function EditPanel({
  activeSection,
  menuSections,
  resumeData,
  setResumeData,
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
  updateMenuSections,
  updateGlobalSettings,
  onAIImport,
}: EditPanelProps) {
  // 编辑模式状态
  const [editMode, setEditMode] = useState<EditMode>('edit')

  // 处理对话完成
  const handleConversationComplete = (data: ResumeData) => {
    setResumeData(data)
    // 完成后自动切换到编辑模式
    setEditMode('edit')
  }

  // 根据 activeSection 渲染对应面板
  const renderFields = () => {
    switch (activeSection) {
      case 'basic':
        return (
          <BasicPanel
            basic={resumeData.basic}
            onUpdate={updateBasicInfo}
          />
        )

      case 'skills':
        return (
          <SkillPanel
            skillContent={resumeData.skillContent}
            onUpdate={updateSkillContent}
            onAIImport={onAIImport ? () => onAIImport('skills') : undefined}
            resumeData={resumeData}
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
            onAIImport={onAIImport ? () => onAIImport('experience') : undefined}
          />
        )

      case 'projects':
        return (
          <ProjectPanel
            projects={resumeData.projects}
            onUpdate={updateProject}
            onDelete={deleteProject}
            onReorder={reorderProjects}
            onAIImport={onAIImport ? () => onAIImport('projects') : undefined}
          />
        )

      case 'education':
        return (
          <EducationPanel
            educations={resumeData.education}
            onUpdate={updateEducation}
            onDelete={deleteEducation}
            onReorder={reorderEducations}
            onAIImport={onAIImport ? () => onAIImport('education') : undefined}
          />
        )

      case 'openSource':
        return (
          <OpenSourcePanel
            openSources={resumeData.openSource || []}
            onUpdate={updateOpenSource}
            onDelete={deleteOpenSource}
            onReorder={reorderOpenSources}
            onAIImport={onAIImport ? () => onAIImport('openSource') : undefined}
          />
        )

      case 'awards':
        return (
          <AwardPanel
            awards={resumeData.awards || []}
            onUpdate={updateAward}
            onDelete={deleteAward}
            onReorder={reorderAwards}
            onAIImport={onAIImport ? () => onAIImport('awards') : undefined}
          />
        )

      default:
        // 自定义模块（后续扩展）
        if (activeSection?.startsWith('custom')) {
          return (
            <div className="p-6 text-center text-gray-500">
              自定义模块编辑（开发中）
            </div>
          )
        }
        return <BasicPanel basic={resumeData.basic} onUpdate={updateBasicInfo} />
    }
  }

  // 获取当前模块信息
  const currentSection = menuSections.find((s) => s.id === activeSection)

  return (
    <motion.div
      className={cn(
        'h-full border-r overflow-hidden flex flex-col',
        'bg-gray-50 border-gray-100',
        'dark:bg-neutral-950 dark:border-neutral-800'
      )}
    >
      <div className="p-4 flex-shrink-0">
        {/* 模式切换选择器 */}
        <EditModeSelector
          currentMode={editMode}
          onModeChange={setEditMode}
        />

        {/* 模块标题 - 仅在编辑模式下显示 */}
        {editMode === 'edit' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'mb-4 p-4 rounded-lg border',
              'bg-white border-gray-100',
              'dark:bg-neutral-900/50 dark:border-neutral-800'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{currentSection?.icon}</span>

              {activeSection === 'basic' ? (
                <span className="text-lg font-semibold text-primary">
                  {currentSection?.title}
                </span>
              ) : (
                <div className="flex items-center flex-1">
                  <input
                    className={cn(
                      'flex-1 text-lg font-medium bg-transparent outline-none text-primary',
                      'border-b border-transparent focus:border-primary pb-1'
                    )}
                    type="text"
                    value={currentSection?.title || ''}
                    onChange={(e) => {
                      const newSections = menuSections.map((s) =>
                        s.id === activeSection ? { ...s, title: e.target.value } : s
                      )
                      updateMenuSections(newSections)
                    }}
                  />
                  <Pencil size={16} className="text-primary ml-2" />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {editMode === 'conversation' ? (
          /* 对话模式 */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
          >
            <ConversationPanel
              resumeData={resumeData}
              onConversationComplete={handleConversationComplete}
            />
          </motion.div>
        ) : (
          /* 编辑模式 */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-lg',
              'bg-white border-gray-100',
              'dark:bg-neutral-900/50 dark:border-neutral-800'
            )}
          >
            {renderFields()}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export default EditPanel


