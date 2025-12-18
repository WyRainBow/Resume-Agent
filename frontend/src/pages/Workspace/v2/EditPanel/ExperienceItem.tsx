/**
 * 工作经历条目组件
 */
import { useState, useCallback } from 'react'
import { motion, Reorder, useDragControls, AnimatePresence } from 'framer-motion'
import { ChevronDown, Eye, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { Experience } from '../types'
import Field from './Field'

// 将 Markdown 格式转换为 HTML（用于预览）
const markdownToHtml = (text: string): string => {
  if (!text) return ''
  // 将 **文本** 转换为 <strong>文本</strong>
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

// 渲染公司名称和职位（自动组合，支持 Markdown）
const renderCompanyPosition = (company: string, position: string): string => {
  const formattedCompany = markdownToHtml(company || '未命名公司')
  const formattedPosition = markdownToHtml(position || '')
  
  if (formattedPosition) {
    return `${formattedCompany} - ${formattedPosition}`
  }
  return formattedCompany
}

interface ExperienceItemProps {
  experience: Experience
  onUpdate: (experience: Experience) => void
  onDelete: (id: string) => void
  setDraggingId: (id: string | null) => void
}

const ExperienceEditor = ({
  experience,
  onSave,
}: {
  experience: Experience
  onSave: (experience: Experience) => void
}) => {
  const handleChange = (field: keyof Experience, value: string | boolean) => {
    onSave({
      ...experience,
      [field]: value,
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="公司名称"
            value={experience.company}
            onChange={(value) => handleChange('company', value)}
            placeholder="请输入公司名称"
            formatButtons={['bold']}
          />
          <Field
            label="职位"
            value={experience.position}
            onChange={(value) => handleChange('position', value)}
            placeholder="请输入职位"
            formatButtons={['bold']}
          />
        </div>
        <Field
          label="在职时间"
          value={experience.date}
          onChange={(value) => handleChange('date', value)}
          placeholder="如：2022.01 - 2023.06"
        />
        <Field
          label="工作内容"
          value={experience.details}
          onChange={(value) => handleChange('details', value)}
          type="editor"
          placeholder="请描述你的工作内容..."
        />
      </div>
    </div>
  )
}

const ExperienceItem = ({
  experience,
  onUpdate,
  onDelete,
  setDraggingId,
}: ExperienceItemProps) => {
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
          ...experience,
          visible: !experience.visible,
        })
        setIsUpdating(false)
      }, 10)
    },
    [experience, onUpdate, isUpdating]
  )

  return (
    <Reorder.Item
      id={experience.id}
      value={experience}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={() => setDraggingId(null)}
      className={cn(
        'rounded-lg border overflow-hidden flex group transition-opacity',
        'bg-white hover:border-primary',
        'dark:bg-neutral-900/30 dark:border-neutral-800 dark:hover:border-primary',
        'border-gray-100',
        !experience.visible && 'opacity-40'
      )}
    >
      <div
        onPointerDown={(event) => {
          if (expanded) return
          dragControls.start(event)
          setDraggingId(experience.id)
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
            expanded && 'opacity-50'
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'px-4 py-4 flex items-center justify-between cursor-pointer select-none',
            expanded && 'bg-gray-50 dark:bg-neutral-800/50'
          )}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <h3 
              className={cn('font-medium truncate', 'text-gray-700 dark:text-neutral-200')}
              dangerouslySetInnerHTML={{ 
                __html: renderCompanyPosition(experience.company, experience.position) 
              }}
            />
          </div>

          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button
              disabled={isUpdating}
              onClick={handleVisibilityToggle}
              className={cn('p-1.5 rounded-md', 'hover:bg-gray-100 dark:hover:bg-neutral-800')}
            >
              <Eye className={cn('w-4 h-4', experience.visible ? 'text-primary' : 'text-gray-300')} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(experience.id)
              }}
              className={cn('p-1.5 rounded-md', 'hover:bg-red-50 dark:hover:bg-red-900/50')}
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>

            <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
              <ChevronDown className="w-5 h-5 text-gray-500 dark:text-neutral-400" />
            </motion.div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className={cn('h-px w-full', 'bg-gray-100 dark:bg-neutral-800')} />
                <ExperienceEditor experience={experience} onSave={onUpdate} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  )
}

export default ExperienceItem


