/**
 * 项目经历条目组件
 * 支持拖拽排序、展开/收起、显示/隐藏、删除
 */
import { useState, useCallback } from 'react'
import { motion, Reorder, useDragControls, AnimatePresence } from 'framer-motion'
import { ChevronDown, Eye, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { Project } from '../types'
import Field from './Field'
import { MonthYearRangePicker } from '../shared/MonthYearRangePicker'

interface ProjectItemProps {
  project: Project
  onUpdate: (project: Project) => void
  onDelete: (id: string) => void
  setDraggingId: (id: string | null) => void
}

/**
 * 项目编辑表单
 */
const ProjectEditor = ({
  project,
  onSave,
  resumeData,
}: {
  project: Project
  onSave: (project: Project) => void
  resumeData?: ResumeData
}) => {
  const handleChange = (field: keyof Project, value: string | boolean) => {
    onSave({
      ...project,
      [field]: value,
    })
  }

  // 构建 polishPath，使用方括号格式：projects[0].description
  const polishPath = resumeData?.projects
    ? `projects[${resumeData.projects.findIndex(p => p.id === project.id)}].description`
    : undefined

  return (
    <div className="space-y-5">
      <div className="grid gap-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0 * 0.05, ease: 'easeOut' }}
          className="grid grid-cols-2 gap-4"
        >
          <Field
            index={0}
            label="项目名称"
            value={project.name}
            onChange={(value) => handleChange('name', value)}
            placeholder="请输入项目名称"
          />
          <Field
            index={1}
            label="项目角色"
            value={project.role}
            onChange={(value) => handleChange('role', value)}
            placeholder="请输入你的角色"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 2 * 0.05, ease: 'easeOut' }}
          className="grid grid-cols-2 gap-4"
        >
          <Field
            index={2}
            label="项目链接"
            value={project.link || ''}
            onChange={(value) => handleChange('link', value)}
            placeholder="项目链接（可选）"
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 3 * 0.05, ease: 'easeOut' }}
          >
            <MonthYearRangePicker
              label="项目时间"
              value={(project.date || '')
                .split(' - ')
                .map((s) => (s && s !== '至今' ? s.trim().replace(/\./g, '-') : s?.trim() || ''))
                .join(' - ')}
              onChange={(value) => handleChange('date', value)}
            />
          </motion.div>
        </motion.div>
        <Field
          index={4}
          label="项目描述"
          value={project.description}
          onChange={(value) => handleChange('description', value)}
          type="editor"
          placeholder="请描述你在项目中的工作内容..."
          resumeData={resumeData}
          polishPath={polishPath}
        />
      </div>
    </div>
  )
}

const ProjectItem = ({
  project,
  onUpdate,
  onDelete,
  setDraggingId,
  resumeData,
}: ProjectItemProps) => {
  const dragControls = useDragControls()
  const [expanded, setExpanded] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleVisibilityToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isUpdating) return

      setIsUpdating(true)
      setTimeout(() => {
        onUpdate({
          ...project,
          visible: !project.visible,
        })
        setIsUpdating(false)
      }, 10)
    },
    [project, onUpdate, isUpdating]
  )

  return (
    <Reorder.Item
      id={project.id}
      value={project}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={() => setDraggingId(null)}
      className={cn(
        'rounded-lg border overflow-hidden flex group transition-opacity',
        'bg-white hover:border-primary',
        'dark:bg-neutral-900/30 dark:border-neutral-800 dark:hover:border-primary',
        'border-gray-100',
        // 隐藏时显示淡透明
        !project.visible && 'opacity-40'
      )}
    >
      {/* 拖拽手柄 */}
      <div
        onPointerDown={(event) => {
          if (expanded) return
          dragControls.start(event)
          setDraggingId(project.id)
        }}
        onPointerUp={() => setDraggingId(null)}
        onPointerCancel={() => setDraggingId(null)}
        className={cn(
          'w-12 flex items-center justify-center border-r shrink-0 touch-none',
          'border-gray-100 dark:border-neutral-800',
          expanded
            ? 'cursor-not-allowed'
            : 'cursor-grab hover:bg-gray-50 dark:hover:bg-neutral-800/50'
        )}
      >
        <GripVertical
          className={cn(
            'w-4 h-4',
            'text-gray-400 dark:text-neutral-400',
            expanded && 'opacity-50',
            'transform transition-transform group-hover:scale-110'
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        {/* 标题行 */}
        <div
          className={cn(
            'px-4 py-4 flex items-center justify-between cursor-pointer select-none',
            expanded && 'bg-gray-50 dark:bg-neutral-800/50'
          )}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                'font-medium truncate',
                'text-gray-700 dark:text-neutral-200'
              )}
            >
              {project.name || '未命名项目'}
            </h3>
          </div>

          <div className="flex items-center gap-2 ml-4 shrink-0">
            {/* 显示/隐藏 */}
            <button
              disabled={isUpdating}
              onClick={handleVisibilityToggle}
              className={cn(
                'p-1.5 rounded-md',
                'hover:bg-gray-100 dark:hover:bg-neutral-800'
              )}
            >
              <Eye className={cn('w-4 h-4', project.visible ? 'text-primary' : 'text-gray-300')} />
            </button>

            {/* 删除 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(project.id)
              }}
              className={cn(
                'p-1.5 rounded-md',
                'hover:bg-red-50 dark:hover:bg-red-900/50',
                'text-red-600 dark:text-red-400'
              )}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* 展开/收起 */}
            <motion.div
              initial={false}
              animate={{ rotate: expanded ? 180 : 0 }}
            >
              <ChevronDown
                className={cn(
                  'w-5 h-5',
                  'text-gray-500 dark:text-neutral-400'
                )}
              />
            </motion.div>
          </div>
        </div>

        {/* 展开内容 */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  'px-4 pb-4 space-y-4',
                  'border-gray-100 dark:border-neutral-800'
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={cn('h-px w-full', 'bg-gray-100 dark:bg-neutral-800')} />
                <ProjectEditor
                  project={project}
                  onSave={onUpdate}
                  resumeData={resumeData}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  )
}

export default ProjectItem


