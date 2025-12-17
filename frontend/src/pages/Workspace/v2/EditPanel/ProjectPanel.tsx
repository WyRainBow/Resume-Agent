/**
 * 项目经历面板
 * 管理项目列表的增删改查
 */
import { useState } from 'react'
import { Reorder } from 'framer-motion'
import { PlusCircle, Wand2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { Project } from '../types'
import ProjectItem from './ProjectItem'

interface ProjectPanelProps {
  projects: Project[]
  onUpdate: (project: Project) => void
  onDelete: (id: string) => void
  onReorder: (projects: Project[]) => void
  onAIImport?: () => void  // AI 导入回调
}

/**
 * 生成唯一 ID
 */
const generateId = () => {
  return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const ProjectPanel = ({
  projects,
  onUpdate,
  onDelete,
  onReorder,
  onAIImport,
}: ProjectPanelProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // 创建新项目
  const handleCreate = () => {
    const newProject: Project = {
      id: generateId(),
      name: '新项目',
      role: '',
      date: '',
      description: '',
      visible: true,
    }
    onReorder([...projects, newProject])
  }

  return (
    <div
      className={cn(
        'space-y-4 px-4 py-4 rounded-lg',
        'bg-white dark:bg-neutral-900/30'
      )}
    >
      {/* AI 导入按钮 */}
      {onAIImport && (
        <button
          onClick={onAIImport}
          className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-purple-400 to-pink-500 hover:from-pink-500 hover:to-purple-400 text-white shadow-md transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Wand2 className="w-4 h-4" />
          AI 导入项目经历
        </button>
      )}

      {/* 项目列表 */}
      <Reorder.Group
        axis="y"
        values={projects}
        onReorder={onReorder}
        className="space-y-3"
      >
        {projects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            onUpdate={onUpdate}
            onDelete={onDelete}
            setDraggingId={setDraggingId}
          />
        ))}
      </Reorder.Group>

      {/* 添加按钮 */}
      <button
        onClick={handleCreate}
        className={cn(
          'w-full px-4 py-3 rounded-lg border-2 border-dashed',
          'border-gray-200 dark:border-neutral-700',
          'hover:border-primary hover:bg-primary/5',
          'transition-colors duration-200',
          'flex items-center justify-center gap-2',
          'text-gray-500 dark:text-neutral-400'
        )}
      >
        <PlusCircle className="w-4 h-4" />
        添加项目
      </button>
    </div>
  )
}

export default ProjectPanel


