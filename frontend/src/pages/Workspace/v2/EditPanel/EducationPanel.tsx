/**
 * 教育经历面板
 */
import { useState } from 'react'
import { Reorder } from 'framer-motion'
import { PlusCircle, Wand2, ChevronDown, Eye, GripVertical, Trash2 } from 'lucide-react'
import { motion, useDragControls, AnimatePresence } from 'framer-motion'
import { cn } from '../../../../lib/utils'
import type { Education } from '../types'
import Field from './Field'
import { MonthYearRangePicker } from '../shared/MonthYearRangePicker'

interface EducationPanelProps {
  educations: Education[]
  onUpdate: (education: Education) => void
  onDelete: (id: string) => void
  onReorder: (educations: Education[]) => void
  onAIImport?: () => void
}

const generateId = () => {
  return `edu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 教育经历条目
 */
const EducationItem = ({
  education,
  onUpdate,
  onDelete,
  setDraggingId,
}: {
  education: Education
  onUpdate: (education: Education) => void
  onDelete: (id: string) => void
  setDraggingId: (id: string | null) => void
}) => {
  const dragControls = useDragControls()
  const [expanded, setExpanded] = useState(false)

  return (
    <Reorder.Item
      id={education.id}
      value={education}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={() => setDraggingId(null)}
      className={cn(
        'rounded-lg border overflow-hidden flex group transition-opacity',
        'bg-white hover:border-primary',
        'dark:bg-neutral-900/30 dark:border-neutral-800',
        'border-gray-100',
        education.visible === false && 'opacity-40'
      )}
    >
      <div
        onPointerDown={(event) => {
          if (expanded) return
          dragControls.start(event)
          setDraggingId(education.id)
        }}
        onPointerUp={() => setDraggingId(null)}
        className={cn(
          'w-12 flex items-center justify-center border-r shrink-0 touch-none',
          'border-gray-100 dark:border-neutral-800',
          expanded ? 'cursor-not-allowed' : 'cursor-grab hover:bg-gray-50'
        )}
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'px-4 py-4 flex items-center justify-between cursor-pointer',
            expanded && 'bg-gray-50 dark:bg-neutral-800/50'
          )}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate text-gray-700 dark:text-neutral-200">
              {education.school || '未命名学校'}
            </h3>
            {education.major && (
              <p className="text-sm text-gray-500 truncate">{education.major}</p>
            )}
          </div>

          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onUpdate({ ...education, visible: !education.visible })
              }}
              className="p-1.5 rounded-md hover:bg-gray-100"
            >
              <Eye className={cn('w-4 h-4', education.visible !== false ? 'text-primary' : 'text-gray-300')} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(education.id)
              }}
              className="p-1.5 rounded-md hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
              <ChevronDown className="w-5 h-5 text-gray-500" />
            </motion.div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="h-px w-full bg-gray-100 dark:bg-neutral-800" />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="学校"
                    value={education.school}
                    onChange={(v) => onUpdate({ ...education, school: v })}
                    placeholder="请输入学校名称"
                  />
                  <Field
                    label="专业"
                    value={education.major}
                    onChange={(v) => onUpdate({ ...education, major: v })}
                    placeholder="请输入专业"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="学位"
                    value={education.degree}
                    onChange={(v) => onUpdate({ ...education, degree: v })}
                    placeholder="如：本科、硕士"
                  />
                  <Field
                    label="GPA"
                    value={education.gpa || ''}
                    onChange={(v) => onUpdate({ ...education, gpa: v })}
                    placeholder="如：3.8/4.0"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <MonthYearRangePicker
                    label="入学 / 毕业时间"
                    value={[education.startDate, education.endDate]
                      .map((s) => (!s || s === '至今' ? s : s.replace(/\./g, '-').trim()))
                      .join(' - ')}
                    onChange={(v) => {
                      const [start, end] = (v || '').split(' - ').map((p) => (p || '').trim())
                      onUpdate({ ...education, startDate: start, endDate: end })
                    }}
                  />
                </div>
                <Field
                  label="补充说明"
                  value={education.description || ''}
                  onChange={(v) => onUpdate({ ...education, description: v })}
                  type="editor"
                  placeholder="如：荣誉奖项、相关课程等"
                  educationData={education}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  )
}

const EducationPanel = ({
  educations,
  onUpdate,
  onDelete,
  onReorder,
  onAIImport,
}: EducationPanelProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const handleCreate = () => {
    const newEdu: Education = {
      id: generateId(),
      school: '新学校',
      major: '',
      degree: '',
      startDate: '',
      endDate: '',
      visible: true,
    }
    onReorder([...educations, newEdu])
  }

  return (
    <div className={cn('space-y-4 px-4 py-4 rounded-lg', 'bg-white dark:bg-neutral-900/30')}>
      {onAIImport && (
        <button
          onClick={onAIImport}
          className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-purple-400 to-pink-500 hover:from-pink-500 hover:to-purple-400 text-white shadow-md transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Wand2 className="w-4 h-4" />
          AI 导入教育经历
        </button>
      )}

      <Reorder.Group axis="y" values={educations} onReorder={onReorder} className="space-y-3">
        {educations.map((edu) => (
          <EducationItem
            key={edu.id}
            education={edu}
            onUpdate={onUpdate}
            onDelete={onDelete}
            setDraggingId={setDraggingId}
          />
        ))}
      </Reorder.Group>

      <button
        onClick={handleCreate}
        className={cn(
          'w-full px-4 py-3 rounded-lg border-2 border-dashed',
          'border-gray-200 dark:border-neutral-700',
          'hover:border-primary hover:bg-primary/5',
          'flex items-center justify-center gap-2',
          'text-gray-500 dark:text-neutral-400'
        )}
      >
        <PlusCircle className="w-4 h-4" />
        添加教育经历
      </button>
    </div>
  )
}

export default EducationPanel


