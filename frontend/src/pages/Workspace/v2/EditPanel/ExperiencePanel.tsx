/**
 * 工作经历面板
 */
import { useState } from 'react'
import { Reorder } from 'framer-motion'
import { PlusCircle, Wand2, List, ListOrdered } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { Experience, GlobalSettings, ResumeData } from '../types'
import ExperienceItem from './ExperienceItem'

import { AIImportButton } from '@/components/common/AIImportButton';

interface ExperiencePanelProps {
  experiences: Experience[]
  onUpdate: (experience: Experience) => void
  onDelete: (id: string) => void
  onReorder: (experiences: Experience[]) => void
  globalSettings?: GlobalSettings
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void
  onAIImport?: () => void
  resumeData?: ResumeData  // 简历数据，用于 AI 润色
}

const generateId = () => {
  return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const ExperiencePanel = ({
  experiences,
  onUpdate,
  onDelete,
  onReorder,
  globalSettings,
  updateGlobalSettings,
  onAIImport,
  resumeData,
}: ExperiencePanelProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  
  // 获取当前列表类型，默认为 'none'
  const listType = globalSettings?.experienceListType || 'none'

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

  const handleListTypeChange = (type: 'none' | 'unordered' | 'ordered') => {
    updateGlobalSettings({ experienceListType: type })
  }

  return (
    <div className={cn('space-y-4 px-4 py-4 rounded-lg', 'bg-white dark:bg-neutral-900/30')}>
      {onAIImport && (
        <AIImportButton 
          onClick={onAIImport}
          className="w-full"
        />
      )}

      {/* 列表类型切换按钮 */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-neutral-800/50">
        <span className="text-sm text-gray-600 dark:text-neutral-400 mr-2">列表样式：</span>
        <button
          onClick={() => handleListTypeChange('none')}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm transition-colors',
            'border',
            listType === 'none'
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-neutral-700 border-gray-200 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-600'
          )}
        >
          无列表
        </button>
        <button
          onClick={() => handleListTypeChange('unordered')}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1',
            'border',
            listType === 'unordered'
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-neutral-700 border-gray-200 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-600'
          )}
        >
          <List className="w-4 h-4" />
          无序列表
        </button>
        <button
          onClick={() => handleListTypeChange('ordered')}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1',
            'border',
            listType === 'ordered'
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-neutral-700 border-gray-200 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-600'
          )}
        >
          <ListOrdered className="w-4 h-4" />
          有序列表
        </button>
      </div>

      <Reorder.Group axis="y" values={experiences} onReorder={onReorder} className="space-y-3">
        {experiences.map((exp) => (
          <ExperienceItem
            key={exp.id}
            experience={exp}
            onUpdate={onUpdate}
            onDelete={onDelete}
            setDraggingId={setDraggingId}
            resumeData={resumeData}
            globalSettings={globalSettings}
            updateGlobalSettings={updateGlobalSettings}
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


