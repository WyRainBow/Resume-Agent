/**
 * 工作经历条目组件
 */
import { useState, useCallback } from 'react'
import { motion, Reorder, useDragControls, AnimatePresence } from 'framer-motion'
import { ChevronDown, Eye, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { Experience, ResumeData, GlobalSettings } from '../types'
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
  resumeData?: ResumeData  // 简历数据，用于 AI 润色
  globalSettings?: GlobalSettings
  updateGlobalSettings?: (settings: Partial<GlobalSettings>) => void
}

const COMPANY_FONT_SIZE_OPTIONS = [
  { value: 13, label: '13' },
  { value: 14, label: '14' },
  { value: 15, label: '15' },
  { value: 16, label: '16' },
  { value: 17, label: '17' },
  { value: 18, label: '18' },
  { value: 20, label: '20' },
  { value: 22, label: '22' },
  { value: 24, label: '24' },
  { value: 26, label: '26' },
  { value: 28, label: '28' },
]

const ExperienceEditor = ({
  experience,
  onSave,
  resumeData,
  globalSettings,
  updateGlobalSettings,
}: {
  experience: Experience
  onSave: (experience: Experience) => void
  resumeData?: ResumeData
  globalSettings?: GlobalSettings
  updateGlobalSettings?: (settings: Partial<GlobalSettings>) => void
}) => {
  const handleChange = (field: keyof Experience, value: string | boolean) => {
    onSave({
      ...experience,
      [field]: value,
    })
  }

  // 构建 polishPath，使用方括号格式：experience[0].details
  const polishPath = resumeData?.experience
    ? `experience[${resumeData.experience.findIndex(e => e.id === experience.id)}].details`
    : undefined

  return (
    <div className="space-y-5">
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-400">公司名称</label>
              {updateGlobalSettings && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 dark:text-neutral-500">字号</span>
                    <select
                      value={globalSettings?.companyNameFontSize || 15}
                      onChange={(e) => updateGlobalSettings({ companyNameFontSize: Number(e.target.value) })}
                      className="px-1.5 py-0.5 text-[10px] rounded border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {COMPANY_FONT_SIZE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}px</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <Field
              value={experience.company}
              onChange={(value) => handleChange('company', value)}
              placeholder="请输入公司名称"
              formatButtons={['bold']}
            />
          </div>
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
          resumeData={resumeData}
          polishPath={polishPath}
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
  resumeData,
  globalSettings,
  updateGlobalSettings,
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
                <ExperienceEditor experience={experience} onSave={onUpdate} resumeData={resumeData} globalSettings={globalSettings} updateGlobalSettings={updateGlobalSettings} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  )
}

export default ExperienceItem


