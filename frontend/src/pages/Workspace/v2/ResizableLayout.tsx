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
        'w-1 cursor-col-resize hover:bg-purple-400 active:bg-purple-500 transition-colors',
        'bg-gray-200 dark:bg-neutral-700',
        className
      )}
      onMouseDown={handleMouseDown}
    />
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
    <div className="h-[calc(100vh-56px)] flex">
      {/* 第一列：SidePanel */}
      <div 
        className="h-full overflow-y-auto bg-gray-50 dark:bg-neutral-900"
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
        className="h-full overflow-y-auto bg-white dark:bg-neutral-900"
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
          onAIImport={handleAIImport}
        />
      </div>

      {/* 分隔线2 */}
      <DragHandle onDrag={handleDrag2} />

      {/* 第三列：PreviewPanel */}
      <div className="flex-1 h-full overflow-hidden bg-gray-100 dark:bg-neutral-800">
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

