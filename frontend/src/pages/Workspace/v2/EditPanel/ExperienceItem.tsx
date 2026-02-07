/**
 * 工作经历条目组件
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, Reorder, useDragControls, AnimatePresence } from 'framer-motion'
import { ChevronDown, Eye, GripVertical, Trash2, X, Image } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { Experience, ResumeData, GlobalSettings } from '../types'
import Field from './Field'
import {
  type CompanyLogo,
  fetchLogos,
  getCachedLogos,
  getLogoUrl,
  getLogoByKey,
  matchCompanyLogo,
} from '../constants/companyLogos'

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

/**
 * Logo 选择器组件
 */
function LogoSelector({
  selectedKey,
  onSelect,
  onClear,
}: {
  selectedKey?: string
  onSelect: (key: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [logos, setLogos] = useState<CompanyLogo[]>(getCachedLogos())
  const panelRef = useRef<HTMLDivElement>(null)

  // 加载 Logo 列表
  useEffect(() => {
    fetchLogos().then((list) => {
      if (list.length > 0) setLogos(list)
    })
  }, [])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filteredLogos = search
    ? logos.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase()))
      )
    : logos

  const selectedLogoUrl = selectedKey ? getLogoUrl(selectedKey) : null

  return (
    <div className="relative" ref={panelRef}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 text-[10px] rounded-md border transition-colors',
            selectedKey
              ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
              : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'
          )}
        >
          {selectedLogoUrl ? (
            <img src={selectedLogoUrl} alt="" className="w-4 h-4 object-contain" />
          ) : (
            <Image className="w-3 h-3" />
          )}
          <span>{selectedKey ? 'Logo' : '+ Logo'}</span>
        </button>
        {selectedKey && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
            title="移除 Logo"
          >
            <X className="w-3 h-3 text-red-400" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 top-full left-0 mt-1 w-72 rounded-lg shadow-lg border overflow-hidden',
              'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700'
            )}
          >
            {/* 搜索框 */}
            <div className="p-2 border-b border-gray-100 dark:border-neutral-800">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索公司..."
                autoFocus
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400"
              />
            </div>

            {/* Logo 网格 */}
            <div className="p-2 max-h-48 overflow-y-auto">
              {logos.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-4">
                  正在加载 Logo 列表...
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {filteredLogos.map((logo) => {
                    const isSelected = selectedKey === logo.key
                    return (
                      <button
                        key={logo.key}
                        type="button"
                        onClick={() => {
                          onSelect(logo.key)
                          setOpen(false)
                          setSearch('')
                        }}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center',
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-400'
                            : 'hover:bg-gray-50 dark:hover:bg-neutral-800'
                        )}
                        title={logo.name}
                      >
                        <img
                          src={logo.url}
                          alt={logo.name}
                          className="w-8 h-8 object-contain"
                          loading="lazy"
                        />
                        <span className="text-[10px] text-gray-600 dark:text-neutral-400 truncate w-full leading-tight">
                          {logo.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              {logos.length > 0 && filteredLogos.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-4">
                  未找到匹配的公司
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
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
  const handleChange = (field: keyof Experience, value: string | boolean | number | undefined) => {
    const updated = { ...experience, [field]: value }
    // 清除空字符串的 companyLogo
    if (field === 'companyLogo' && value === '') {
      delete updated.companyLogo
      delete updated.companyLogoSize // 同时清除单独设置的大小
    }
    // 清除 undefined 值
    if (value === undefined) {
      delete (updated as any)[field]
    }
    onSave(updated)
  }

  // 构建 polishPath，使用方括号格式：experience[0].details
  const polishPath = resumeData?.experience
    ? `experience[${resumeData.experience.findIndex(e => e.id === experience.id)}].details`
    : undefined

  // 自动匹配 Logo 提示
  const autoMatchedKey = !experience.companyLogo ? matchCompanyLogo(experience.company) : null

  return (
    <div className="space-y-5">
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500 dark:text-neutral-400">公司名称</label>
                <LogoSelector
                  selectedKey={experience.companyLogo}
                  onSelect={(key) => handleChange('companyLogo', key)}
                  onClear={() => handleChange('companyLogo', '')}
                />
                {experience.companyLogo && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 dark:text-neutral-500">大小</span>
                    <input
                      type="range"
                      min={10}
                      max={48}
                      step={1}
                      value={experience.companyLogoSize || globalSettings?.companyLogoSize || 20}
                      onChange={(e) => handleChange('companyLogoSize', Number(e.target.value))}
                      className="w-14 h-3 accent-indigo-500"
                      title={`Logo 大小: ${experience.companyLogoSize || globalSettings?.companyLogoSize || 20}px`}
                    />
                    <span className="text-[10px] text-gray-500 dark:text-neutral-400 min-w-[28px]">
                      {experience.companyLogoSize || globalSettings?.companyLogoSize || 20}px
                    </span>
                    {experience.companyLogoSize && (
                      <button
                        type="button"
                        onClick={() => handleChange('companyLogoSize', undefined)}
                        className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-800"
                        title="恢复默认大小"
                      >
                        <X className="w-2.5 h-2.5 text-gray-400" />
                      </button>
                    )}
                  </div>
                )}
              </div>
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
            {/* 自动匹配提示 */}
            {autoMatchedKey && (
              <div className="flex items-center gap-1.5 mb-1 px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <img src={getLogoUrl(autoMatchedKey)!} alt="" className="w-4 h-4 object-contain" />
                <span className="text-[10px] text-amber-700 dark:text-amber-400">
                  检测到匹配 Logo - {getLogoByKey(autoMatchedKey)?.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleChange('companyLogo', autoMatchedKey)}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium ml-auto"
                >
                  使用
                </button>
              </div>
            )}
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
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {experience.companyLogo && getLogoUrl(experience.companyLogo) && (
              <img
                src={getLogoUrl(experience.companyLogo)!}
                alt=""
                className="w-5 h-5 object-contain shrink-0"
              />
            )}
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


