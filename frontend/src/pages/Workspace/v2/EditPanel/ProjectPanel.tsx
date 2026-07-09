/**
 * 项目经历面板
 * 管理项目列表的增删改查
 */
import { useState } from 'react'
import { PlusCircle, Wand2, Trash2, CheckSquare, Square, GripVertical } from 'lucide-react'
import { Reorder } from 'framer-motion'
import { cn } from '../../../../lib/utils'
import { confirmDialog } from '@/lib/confirm'
import type { Project, GlobalSettings } from '../types'
import ProjectItem from './ProjectItem'

import type { ResumeData } from '../types'

import { AIImportButton } from '@/components/common/AIImportButton';

interface ProjectPanelProps {
  projects: Project[]
  onUpdate: (project: Project) => void
  onDelete: (id: string) => void
  onReorder: (projects: Project[]) => void
  onAIImport?: () => void  // AI 导入回调
  resumeData?: ResumeData  // 简历数据，用于 AI 润色
  globalSettings?: GlobalSettings
  updateGlobalSettings?: (settings: Partial<GlobalSettings>) => void
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
  resumeData,
  globalSettings,
  updateGlobalSettings,
}: ProjectPanelProps) => {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

  // 切换选择模式
  const toggleSelectMode = () => {
    if (selectMode) {
      setSelectedIds(new Set())
    }
    setSelectMode(!selectMode)
  }

  // 切换单个项目选择
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!(await confirmDialog({
      title: `确定删除选中的 ${selectedIds.size} 个项目吗？`,
      confirmText: '删除',
      danger: true,
    }))) return
    
    selectedIds.forEach(id => onDelete(id))
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  return (
    <div
      className={cn(
        'space-y-4 px-4 py-4 rounded-none fresh:rounded-md',
        'bg-white dark:bg-neutral-900/30'
      )}
    >
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-2">
        {/* AI 导入按钮 */}
        {onAIImport && (
          <AIImportButton 
            onClick={onAIImport}
            className="flex-1"
          />
        )}
        
        {/* 多选/删除按钮 */}
        <button
          onClick={toggleSelectMode}
          className={cn(
            'px-3 py-2 rounded-none fresh:rounded-md transition-all duration-200 flex items-center gap-1.5 text-sm',
            selectMode
              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              : 'bg-[#F1F2F5] text-gray-600 hover:bg-gray-200 dark:bg-[#2A2A2A] dark:text-neutral-300'
          )}
        >
          {selectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {selectMode ? '取消' : '多选'}
        </button>
        
        {selectMode && selectedIds.size > 0 && (
          <button
            onClick={handleBatchDelete}
            className="px-3 py-2 rounded-none fresh:rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-all duration-200 flex items-center gap-1.5 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            删除({selectedIds.size})
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400 px-1">
        <GripVertical className="w-3.5 h-3.5" />
        可拖拽调整顺序
      </div>

      {/* 项目列表 */}
      <Reorder.Group axis="y" values={projects} onReorder={onReorder} className="space-y-3">
        {projects.map((project) => (
          <div key={project.id} className="flex items-start gap-2">
            {selectMode && (
              <button
                onClick={() => toggleSelect(project.id)}
                className="mt-3 p-1 rounded hover:bg-[#F1F2F5] dark:hover:bg-[#2A2A2A]"
              >
                {selectedIds.has(project.id) ? (
                  <CheckSquare className="w-5 h-5 text-blue-500" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400" />
                )}
              </button>
            )}
            <div className="flex-1">
              <ProjectItem
                project={project}
                onUpdate={onUpdate}
                onDelete={onDelete}
                resumeData={resumeData}
                globalSettings={globalSettings}
                updateGlobalSettings={updateGlobalSettings}
              />
            </div>
          </div>
        ))}
      </Reorder.Group>

      {/* 添加按钮 */}
      <button
        onClick={handleCreate}
        className={cn(
          'w-full px-4 py-3 rounded-none fresh:rounded-md border-2 fresh:border border-dashed',
          'border-black fresh:border-slate-200 dark:border-white',
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
