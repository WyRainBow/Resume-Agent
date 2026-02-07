/**
 * 开源经历面板
 */
import { useState } from 'react'
import { Reorder, motion, AnimatePresence, useDragControls } from 'framer-motion'
import { PlusCircle, Wand2, ChevronDown, Eye, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { OpenSource, GlobalSettings } from '../types'
import Field from './Field'

interface OpenSourcePanelProps {
  openSources: OpenSource[]
  onUpdate: (openSource: OpenSource) => void
  onDelete: (id: string) => void
  onReorder: (openSources: OpenSource[]) => void
  onAIImport?: () => void
  globalSettings?: GlobalSettings
  updateGlobalSettings?: (settings: Partial<GlobalSettings>) => void
}

const generateId = () => {
  return `opensource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 开源经历条目组件
function OpenSourceItem({
  openSource,
  onUpdate,
  onDelete,
  setDraggingId,
  resumeData,
  globalSettings,
  updateGlobalSettings,
}: {
  openSource: OpenSource
  onUpdate: (openSource: OpenSource) => void
  onDelete: (id: string) => void
  setDraggingId: (id: string | null) => void
  resumeData?: ResumeData
  globalSettings?: GlobalSettings
  updateGlobalSettings?: (settings: Partial<GlobalSettings>) => void
}) {
  const dragControls = useDragControls()
  const [expanded, setExpanded] = useState(false)

  const handleChange = (field: keyof OpenSource, value: string | boolean) => {
    onUpdate({ ...openSource, [field]: value })
  }

  return (
    <Reorder.Item
      id={openSource.id}
      value={openSource}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={() => setDraggingId(null)}
      className={cn(
        'rounded-lg border overflow-hidden flex group transition-opacity',
        'bg-white hover:border-primary',
        'dark:bg-neutral-900/30 dark:border-neutral-800 dark:hover:border-primary',
        'border-gray-100',
        openSource.visible === false && 'opacity-40'
      )}
    >
      {/* 拖拽手柄 */}
      <div
        onPointerDown={(event) => {
          if (expanded) return
          dragControls.start(event)
          setDraggingId(openSource.id)
        }}
        className={cn(
          'w-12 flex items-center justify-center border-r shrink-0 touch-none',
          'border-gray-100 dark:border-neutral-800',
          expanded ? 'cursor-not-allowed' : 'cursor-grab hover:bg-gray-50 dark:hover:bg-neutral-800/50'
        )}
      >
        <GripVertical className={cn('w-4 h-4 text-gray-400 dark:text-neutral-400', expanded && 'opacity-50')} />
      </div>

      <div className="flex-1 min-w-0">
        {/* 标题行 */}
        <div
          className={cn('px-4 py-4 flex items-center justify-between cursor-pointer select-none', expanded && 'bg-gray-50 dark:bg-neutral-800/50')}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <h3 className={cn('font-medium truncate', 'text-gray-700 dark:text-neutral-200')}>
              {openSource.name || '未命名项目'}
            </h3>
          </div>

          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onUpdate({ ...openSource, visible: !openSource.visible })
              }}
              className={cn('p-1.5 rounded-md', 'hover:bg-gray-100 dark:hover:bg-neutral-800')}
            >
              <Eye className={cn('w-4 h-4', openSource.visible !== false ? 'text-primary' : 'text-gray-300')} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(openSource.id)
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
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="项目名称" value={openSource.name} onChange={(v) => handleChange('name', v)} placeholder="如：Seata-go" />
                    <Field label="角色" value={openSource.role || ''} onChange={(v) => handleChange('role', v)} placeholder="如：贡献者" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-500 dark:text-neutral-400">仓库地址</label>
                        {updateGlobalSettings && (
                          <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-md p-0.5">
                            <button
                              onClick={() => updateGlobalSettings({ openSourceRepoDisplay: 'below' })}
                              className={cn(
                                'px-2 py-0.5 text-[10px] font-medium rounded transition-all',
                                (globalSettings?.openSourceRepoDisplay || 'below') === 'below'
                                  ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                  : 'text-gray-400 dark:text-neutral-500 hover:text-gray-600'
                              )}
                            >
                              下方
                            </button>
                            <button
                              onClick={() => updateGlobalSettings({ openSourceRepoDisplay: 'inline' })}
                              className={cn(
                                'px-2 py-0.5 text-[10px] font-medium rounded transition-all',
                                globalSettings?.openSourceRepoDisplay === 'inline'
                                  ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                  : 'text-gray-400 dark:text-neutral-500 hover:text-gray-600'
                              )}
                            >
                              标题旁
                            </button>
                          </div>
                        )}
                      </div>
                      <Field value={openSource.repo || ''} onChange={(v) => handleChange('repo', v)} placeholder="GitHub 链接" />
                    </div>
                    <Field label="时间" value={openSource.date || ''} onChange={(v) => handleChange('date', v)} placeholder="如：2024.01 - 至今" />
                  </div>
                  <Field 
                    label="贡献描述" 
                    value={openSource.description} 
                    onChange={(v) => handleChange('description', v)} 
                    type="editor" 
                    placeholder="描述你的开源贡献..."
                    resumeData={resumeData}
                    polishPath={resumeData?.openSource ? `openSource[${resumeData.openSource.findIndex(os => os.id === openSource.id)}].description` : undefined}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  )
}

export default function OpenSourcePanel({ openSources, onUpdate, onDelete, onReorder, onAIImport, resumeData, globalSettings, updateGlobalSettings }: OpenSourcePanelProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const handleCreate = () => {
    const newItem: OpenSource = {
      id: generateId(),
      name: '新开源项目',
      role: '',
      repo: '',
      date: '',
      description: '',
      visible: true,
    }
    onReorder([...openSources, newItem])
  }

  return (
    <div className={cn('space-y-4 px-4 py-4 rounded-lg', 'bg-white dark:bg-neutral-900/30')}>
      {onAIImport && (
        <button
          onClick={onAIImport}
          className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-purple-400 to-pink-500 hover:from-pink-500 hover:to-purple-400 text-white shadow-md transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Wand2 className="w-4 h-4" />
          AI 导入开源经历
        </button>
      )}

      <Reorder.Group axis="y" values={openSources} onReorder={onReorder} className="space-y-3">
        {openSources.map((item) => (
          <OpenSourceItem key={item.id} openSource={item} onUpdate={onUpdate} onDelete={onDelete} setDraggingId={setDraggingId} resumeData={resumeData} globalSettings={globalSettings} updateGlobalSettings={updateGlobalSettings} />
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
        添加开源经历
      </button>
    </div>
  )
}

