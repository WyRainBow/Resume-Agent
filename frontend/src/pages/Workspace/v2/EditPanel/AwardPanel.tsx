/**
 * 荣誉奖项面板
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, Wand2, ChevronDown, Eye, Trash2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { Award } from '../types'
import Field from './Field'

interface AwardPanelProps {
  awards: Award[]
  onUpdate: (award: Award) => void
  onDelete: (id: string) => void
  onReorder: (awards: Award[]) => void
  onAIImport?: () => void
}

const generateId = () => {
  return `award_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 奖项条目组件
function AwardItem({
  award,
  onUpdate,
  onDelete,
}: {
  award: Award
  onUpdate: (award: Award) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const handleChange = (field: keyof Award, value: string | boolean) => {
    onUpdate({ ...award, [field]: value })
  }

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden transition-opacity',
        'bg-white hover:border-primary',
        'dark:bg-neutral-900/30 dark:border-neutral-800 dark:hover:border-primary',
        'border-gray-100',
        award.visible === false && 'opacity-40'
      )}
    >
      <div className="min-w-0">
        {/* 标题行 */}
        <div
          className={cn('px-4 py-4 flex items-center justify-between cursor-pointer select-none', expanded && 'bg-gray-50 dark:bg-neutral-800/50')}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <h3 className={cn('font-medium truncate', 'text-gray-700 dark:text-neutral-200')}>
              {award.title || '未命名奖项'}
            </h3>
          </div>

          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onUpdate({ ...award, visible: !award.visible })
              }}
              className={cn('p-1.5 rounded-md', 'hover:bg-gray-100 dark:hover:bg-neutral-800')}
            >
              <Eye className={cn('w-4 h-4', award.visible !== false ? 'text-primary' : 'text-gray-300')} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(award.id)
              }}
              className={cn('p-1.5 rounded-md', 'hover:bg-red-50 dark:hover:bg-red-900/50', 'text-red-600 dark:text-red-400')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
              <ChevronDown className="w-5 h-5 text-gray-500 dark:text-neutral-400" />
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
              <div className="px-4 pb-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="h-px w-full bg-gray-100 dark:bg-neutral-800" />
                <div className="space-y-5">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0 * 0.05, ease: 'easeOut' }}
                    className="grid grid-cols-2 gap-4"
                  >
                    <Field index={0} label="奖项名称" value={award.title} onChange={(v) => handleChange('title', v)} placeholder="如：国家奖学金" />
                    <Field index={1} label="颁发机构" value={award.issuer || ''} onChange={(v) => handleChange('issuer', v)} placeholder="如：教育部" />
                  </motion.div>
                  <Field index={2} label="获奖时间" value={award.date || ''} onChange={(v) => handleChange('date', v)} placeholder="如：2023.09" />
                  <Field index={3} label="奖项描述" value={award.description || ''} onChange={(v) => handleChange('description', v)} type="textarea" placeholder="简要描述..." />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function AwardPanel({ awards, onUpdate, onDelete, onReorder, onAIImport }: AwardPanelProps) {
  const handleCreate = () => {
    const newItem: Award = {
      id: generateId(),
      title: '新奖项',
      issuer: '',
      date: '',
      description: '',
      visible: true,
    }
    onReorder([...awards, newItem])
  }

  return (
    <div className={cn('space-y-4 px-4 py-4 rounded-lg', 'bg-white dark:bg-neutral-900/30')}>
      {onAIImport && (
        <button
          onClick={onAIImport}
          className="w-full px-4 py-2 rounded-lg bg-white text-black border border-slate-300 hover:bg-slate-50 shadow-sm transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Wand2 className="w-4 h-4" />
          AI 导入荣誉奖项
        </button>
      )}

      <div className="space-y-3">
        {awards.map((item) => (
          <AwardItem key={item.id} award={item} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>

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
        添加荣誉奖项
      </button>
    </div>
  )
}
