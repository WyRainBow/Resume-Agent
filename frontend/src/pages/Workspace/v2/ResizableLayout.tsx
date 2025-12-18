/**
 * 可拖拽三列布局组件
 */
import { useState, useRef, useCallback } from 'react'
import { cn } from '../../../lib/utils'
import SidePanel from './SidePanel'
import EditPanel from './EditPanel'
import PreviewPanel from './PreviewPanel'
import type { ResumeData, MenuSection, GlobalSettings, BasicInfo, Project, Experience, Education, OpenSource, Award } from './types'

interface ResizableLayoutProps {
  resumeData: ResumeData
  activeSection: string
  setActiveSection: (id: string) => void
  toggleSectionVisibility: (id: string) => void
  updateMenuSections: (sections: MenuSection[]) => void
  reorderSections: (sections: MenuSection[]) => void
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void
  addCustomSection: () => void
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
  handleAIImport: (section: string) => void
  pdfBlob: Blob | null
  loading: boolean
  progress: string
  handleRender: () => void
  handleDownload: () => void
}

// 拖拽分隔线组件
function DragHandle({ 
  onDrag, 
  className 
}: { 
  onDrag: (delta: number) => void
  className?: string 
}) {
  const isDragging = useRef(false)
  const startX = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - startX.current
      startX.current = e.clientX
      onDrag(delta)
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [onDrag])

  return (
    <div
      className={cn(
        'w-[3px] cursor-col-resize transition-all duration-200 group relative',
        'bg-gradient-to-b from-slate-200/60 via-slate-300/40 to-slate-200/60',
        'dark:from-slate-700/60 dark:via-slate-600/40 dark:to-slate-700/60',
        'hover:from-indigo-400/80 hover:via-purple-400/80 hover:to-indigo-400/80',
        'active:from-indigo-500 active:via-purple-500 active:to-indigo-500',
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* 拖拽指示器 */}
      <div className="absolute inset-y-0 -left-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-indigo-500/50" />
      </div>
    </div>
  )
}

export default function ResizableLayout(props: ResizableLayoutProps) {
  const {
    resumeData,
    activeSection,
    setActiveSection,
    toggleSectionVisibility,
    updateMenuSections,
    reorderSections,
    updateGlobalSettings,
    addCustomSection,
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
    handleAIImport,
    pdfBlob,
    loading,
    progress,
    handleRender,
    handleDownload,
  } = props

  // 列宽状态
  const [col1Width, setCol1Width] = useState(350)
  const [col2Width, setCol2Width] = useState(550)

  // 拖拽处理
  const handleDrag1 = useCallback((delta: number) => {
    setCol1Width(w => Math.max(250, Math.min(500, w + delta)))
  }, [])

  const handleDrag2 = useCallback((delta: number) => {
    setCol2Width(w => Math.max(400, Math.min(700, w + delta)))
  }, [])

  return (
    <div className="h-[calc(100vh-64px)] flex relative z-10">
      {/* 第一列：SidePanel */}
      <div 
        className={cn(
          "h-full overflow-y-auto",
          "bg-white/60 dark:bg-slate-900/60",
          "backdrop-blur-sm",
          "border-r border-white/30 dark:border-slate-700/30"
        )}
        style={{ width: col1Width, flexShrink: 0 }}
      >
        <SidePanel
          menuSections={resumeData.menuSections}
          activeSection={activeSection}
          globalSettings={resumeData.globalSettings}
          setActiveSection={setActiveSection}
          toggleSectionVisibility={toggleSectionVisibility}
          updateMenuSections={updateMenuSections}
          reorderSections={reorderSections}
          updateGlobalSettings={updateGlobalSettings}
          addCustomSection={addCustomSection}
        />
      </div>

      {/* 分隔线1 */}
      <DragHandle onDrag={handleDrag1} />

      {/* 第二列：EditPanel */}
      <div 
        className={cn(
          "h-full overflow-y-auto",
          "bg-white/80 dark:bg-slate-900/80",
          "backdrop-blur-sm"
        )}
        style={{ width: col2Width, flexShrink: 0 }}
      >
        <EditPanel
          activeSection={activeSection}
          menuSections={resumeData.menuSections}
          resumeData={resumeData}
          updateBasicInfo={updateBasicInfo}
          updateProject={updateProject}
          deleteProject={deleteProject}
          reorderProjects={reorderProjects}
          updateExperience={updateExperience}
          deleteExperience={deleteExperience}
          reorderExperiences={reorderExperiences}
          updateEducation={updateEducation}
          deleteEducation={deleteEducation}
          reorderEducations={reorderEducations}
          updateOpenSource={updateOpenSource}
          deleteOpenSource={deleteOpenSource}
          reorderOpenSources={reorderOpenSources}
          updateAward={updateAward}
          deleteAward={deleteAward}
          reorderAwards={reorderAwards}
          updateSkillContent={updateSkillContent}
          updateMenuSections={updateMenuSections}
          updateGlobalSettings={updateGlobalSettings}
          onAIImport={handleAIImport}
        />
      </div>

      {/* 分隔线2 */}
      <DragHandle onDrag={handleDrag2} />

      {/* 第三列：PreviewPanel */}
      <div className={cn(
        "flex-1 h-full overflow-hidden",
        "bg-slate-100/80 dark:bg-slate-800/80",
        "backdrop-blur-sm",
        "border-l border-white/30 dark:border-slate-700/30"
      )}>
        <PreviewPanel
          pdfBlob={pdfBlob}
          loading={loading}
          progress={progress}
          onRender={handleRender}
          onDownload={handleDownload}
        />
      </div>
    </div>
  )
}

