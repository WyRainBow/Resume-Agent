/**
 * 工作经历面板
 */
import { useState } from 'react'
import { Reorder } from 'framer-motion'
import { PlusCircle, Wand2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { Experience } from '../types'
import ExperienceItem from './ExperienceItem'

interface ExperiencePanelProps {
  experiences: Experience[]
  onUpdate: (experience: Experience) => void
  onDelete: (id: string) => void
  onReorder: (experiences: Experience[]) => void
  onAIImport?: () => void
}

const generateId = () => {
  return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const ExperiencePanel = ({
  experiences,
  onUpdate,
  onDelete,
  onReorder,
  onAIImport,
}: ExperiencePanelProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const handleCreate = () => {
    const newExp: Experience = {
      id: generateId(),
      company: '新公司',
      position: '',
      date: '',
      details: '',
      visible: true,
    }
    onReorder([...experiences, newExp])
  }

  return (
    <div className={cn('space-y-4 px-4 py-4 rounded-lg', 'bg-white dark:bg-neutral-900/30')}>
      {onAIImport && (
        <button
          onClick={onAIImport}
          className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-purple-400 to-pink-500 hover:from-pink-500 hover:to-purple-400 text-white shadow-md transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Wand2 className="w-4 h-4" />
          AI 导入工作经历
        </button>
      )}

      <Reorder.Group axis="y" values={experiences} onReorder={onReorder} className="space-y-3">
        {experiences.map((exp) => (
          <ExperienceItem
            key={exp.id}
            experience={exp}
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
          'transition-colors duration-200',
          'flex items-center justify-center gap-2',
          'text-gray-500 dark:text-neutral-400'
        )}
      >
        <PlusCircle className="w-4 h-4" />
        添加工作经历
      </button>
    </div>
  )
}

export default ExperiencePanel


