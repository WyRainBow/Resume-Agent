/**
 * 编辑面板组件（第二列）
 * 根据当前选中的模块动态渲染对应的编辑面板
 */
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

interface EditPanelProps {
  activeSection: string
  menuSections: MenuSection[]
  resumeData: ResumeData
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
        'w-full h-full border-r overflow-y-auto',
        'bg-gray-50 border-gray-100',
        'dark:bg-neutral-950 dark:border-neutral-800'
      )}
    >
      <div className="p-4">
        {/* 模块标题 */}
        <motion.div
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

        {/* 编辑面板内容 */}
        <motion.div
          className={cn(
            'rounded-lg',
            'bg-white border-gray-100',
            'dark:bg-neutral-900/50 dark:border-neutral-800'
          )}
        >
          {renderFields()}
        </motion.div>
      </div>
    </motion.div>
  )
}

export default EditPanel


