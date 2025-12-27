/**
 * 滚动编辑模式组件
 * 所有模块在一个页面中从上到下排列，可以滚动查看和编辑
 */
import { motion } from 'framer-motion'
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
  handleAIImport,
}: ScrollEditModeProps) {
  // 定义模块显示顺序（按照用户要求：教育经历、实习经历、工作经历等从上到下）
  const sectionOrder = [
    'basic',      // 基本信息（通常在最前面）
    'education',  // 教育经历（第一个）
    'experience', // 实习经历/工作经历（第二个）
    'projects',   // 项目经历（第三个）
    'skills',     // 技能
    'openSource', // 开源经历
    'awards',     // 荣誉奖项
  ]

  // 获取启用的模块，按顺序排列
  const enabledSections = sectionOrder
    .map(id => menuSections.find(s => s.id === id))
    .filter((section): section is MenuSection => 
      section !== undefined && section.enabled
    )

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
              'rounded-2xl border overflow-hidden shadow-sm',
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
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {section.title}
                </h2>
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

