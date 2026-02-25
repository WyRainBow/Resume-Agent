/**
 * 工作经历条目组件
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, Reorder, useDragControls, AnimatePresence } from 'framer-motion'
import { ChevronDown, Eye, GripVertical, Trash2, X, Image, Plus, Loader2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Experience, ResumeData, GlobalSettings } from '../types'
import Field from './Field'
import { MonthYearRangePicker } from '../shared/MonthYearRangePicker'
import {
  type CompanyLogo,
  fetchLogos,
  getCachedLogos,
  getLogoUrl,
  getLogoByKey,
  getLastLogoError,
  matchCompanyLogo,
  uploadLogo,
  refreshLogos,
} from '../constants/companyLogos'

function getAuthRoleFromToken(): string {
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) return ''
    const payload = token.split('.')[1]
    if (!payload) return ''
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return String(decoded?.role || '').toLowerCase()
  } catch {
    return ''
  }
}

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
 * canUploadLogo: 仅允许 member/admin 显示上传按钮
 */
function LogoSelector({
  selectedKey,
  onSelect,
  onClear,
  canUploadLogo = false,
}: {
  selectedKey?: string
  onSelect: (key: string) => void
  onClear: () => void
  canUploadLogo?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [logos, setLogos] = useState<CompanyLogo[]>(getCachedLogos())
  const [logoLoadError, setLogoLoadError] = useState<string | null>(getLastLogoError())
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // 加载 Logo 列表
  useEffect(() => {
    fetchLogos().then((list) => {
      if (list.length > 0) {
        setLogos(list)
        setLogoLoadError(null)
      } else {
        setLogoLoadError(getLastLogoError())
      }
    })
  }, [])

  // 上传 Logo
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 重置 input，允许重复选择同一文件
    e.target.value = ''

    setUploading(true)
    try {
      const newLogo = await uploadLogo(file)
      // 刷新列表
      const updated = await refreshLogos()
      setLogos(updated)
      // 自动选中刚上传的
      onSelect(newLogo.key)
      setOpen(false)
      setSearch('')
    } catch (err: any) {
      alert(err.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }, [onSelect])

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
    <div className="relative shrink-0" ref={panelRef}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-all duration-200',
            selectedKey
              ? 'border-indigo-300/90 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300'
          )}
        >
          {selectedLogoUrl ? (
            <img src={selectedLogoUrl} alt="" className="h-4 w-4 object-contain" />
          ) : (
            <Image className="h-3.5 w-3.5" />
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
            className="rounded-md p-1 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/30"
            title="移除 Logo"
          >
            <X className="h-3.5 w-3.5 text-rose-400" />
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
              'absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border shadow-xl',
              'bg-white/95 backdrop-blur border-slate-200 dark:bg-neutral-900 dark:border-neutral-700'
            )}
          >
            {/* 搜索框 */}
            <div className="border-b border-slate-100 p-3 dark:border-neutral-800">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索公司..."
                autoFocus
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/35 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              />
            </div>

            {/* Logo 网格 */}
            <div className="max-h-56 overflow-y-auto p-3">
              {logos.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {logoLoadError ? `Logo 列表加载失败：${logoLoadError}` : '正在加载 Logo 列表...'}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
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
                          'flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-center transition-all duration-150',
                          isSelected
                            ? 'bg-indigo-50 ring-1 ring-indigo-300 dark:bg-indigo-900/30 dark:ring-indigo-700'
                            : 'hover:bg-slate-50 dark:hover:bg-neutral-800'
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
                  {/* 上传自定义 Logo：仅允许指定用户 */}
                  {canUploadLogo && (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-2.5 text-center transition-all',
                          uploading
                            ? 'cursor-wait border-slate-200 opacity-50 dark:border-neutral-700'
                            : 'cursor-pointer border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-neutral-700 dark:hover:bg-indigo-900/10'
                        )}
                        title="上传自定义 Logo"
                      >
                        {uploading ? (
                          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                        ) : (
                          <Plus className="h-5 w-5 text-slate-400 dark:text-neutral-500" />
                        )}
                        <span className="text-[10px] leading-tight text-slate-400 dark:text-neutral-500">
                          {uploading ? '上传中' : '上传'}
                        </span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleUpload}
                        className="hidden"
                      />
                    </>
                  )}
                </div>
              )}
              {logos.length > 0 && filteredLogos.length === 0 && (
                <div className="py-4 text-center text-xs text-slate-400">
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
  const { user } = useAuth()
  const roleFromToken = getAuthRoleFromToken()
  const canUploadLogo = !!user && (roleFromToken === 'admin' || roleFromToken === 'member')

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
  const effectiveLogoKey = experience.companyLogo || autoMatchedKey
  const logoSize = experience.companyLogoSize || globalSettings?.companyLogoSize || 20
  const logoSizePercent = ((logoSize - 10) / (48 - 10)) * 100

  return (
    <div className="space-y-5">
      <div className="grid gap-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0 * 0.05, ease: 'easeOut' }}
          className="grid grid-cols-2 gap-4"
        >
          <div>
            <div className="mb-2 rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5 dark:border-neutral-700 dark:bg-neutral-900/50">
              <div className="flex min-w-0 items-center gap-2">
                  <label className="shrink-0 text-xs font-semibold tracking-wide text-slate-600 dark:text-neutral-300">公司名称</label>
                <LogoSelector
                  selectedKey={experience.companyLogo}
                  onSelect={(key) => handleChange('companyLogo', key)}
                  onClear={() => handleChange('companyLogo', '')}
                  canUploadLogo={canUploadLogo}
                />
                {effectiveLogoKey && (
                  <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400">大小</span>
                    <input
                      type="range"
                      min={10}
                      max={48}
                      step={1}
                      value={logoSize}
                      onChange={(e) => {
                        // 仅自动匹配未落库时，拖动大小即视为确认使用该 Logo
                        if (!experience.companyLogo && autoMatchedKey) {
                          handleChange('companyLogo', autoMatchedKey)
                        }
                        handleChange('companyLogoSize', Number(e.target.value))
                      }}
                      className="h-2 w-20 cursor-pointer appearance-none rounded-full bg-transparent accent-indigo-500 sm:w-24 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-indigo-500"
                      style={{
                        background: `linear-gradient(to right, rgb(99 102 241) ${logoSizePercent}%, rgb(203 213 225) ${logoSizePercent}%)`,
                      }}
                      title={`Logo 大小: ${logoSize}px`}
                    />
                    <span className="inline-flex min-w-[38px] items-center justify-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                      {logoSize}px
                    </span>
                    {experience.companyLogoSize && (
                      <button
                        type="button"
                        onClick={() => handleChange('companyLogoSize', undefined)}
                        className="rounded-md p-0.5 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-700"
                        title="恢复默认大小"
                      >
                        <X className="h-3 w-3 text-slate-400" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* 自动匹配提示 */}
            {autoMatchedKey && (
              <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-sky-200/80 bg-gradient-to-r from-sky-50/80 to-cyan-50/80 px-2.5 py-1.5 shadow-sm shadow-sky-100/60 dark:border-sky-800/60 dark:from-sky-900/20 dark:to-cyan-900/10 dark:shadow-none">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/80 bg-white/90 dark:border-sky-800/60 dark:bg-neutral-900">
                  <img src={getLogoUrl(autoMatchedKey)!} alt="" className="h-4 w-4 object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-sky-500/90 dark:text-sky-400/80">
                    Logo 匹配
                  </div>
                  <div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                    已匹配 {getLogoByKey(autoMatchedKey)?.name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange('companyLogo', autoMatchedKey)}
                  className="inline-flex h-7 items-center rounded-lg border border-indigo-200 bg-white px-2.5 text-[11px] font-semibold text-indigo-600 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm dark:border-indigo-700/70 dark:bg-neutral-900 dark:text-indigo-300 dark:hover:border-indigo-600"
                >
                  使用
                </button>
              </div>
            )}
            <Field
              index={0}
              value={experience.company}
              onChange={(value) => handleChange('company', value)}
              placeholder="请输入公司名称"
              formatButtons={['bold']}
              rightActions={updateGlobalSettings ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 dark:border-neutral-700 dark:bg-neutral-800">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400">字号</span>
                  <select
                    value={globalSettings?.companyNameFontSize || 15}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => updateGlobalSettings({ companyNameFontSize: Number(e.target.value) })}
                    className="h-6 rounded-md border border-transparent bg-white px-1.5 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/35 dark:bg-neutral-700 dark:text-neutral-200"
                  >
                    {COMPANY_FONT_SIZE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}px</option>
                    ))}
                  </select>
                </div>
              ) : undefined}
            />
          </div>
          <Field
            index={1}
            label="职位"
            value={experience.position}
            onChange={(value) => handleChange('position', value)}
            placeholder="请输入职位"
            formatButtons={['bold']}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 2 * 0.05, ease: 'easeOut' }}
        >
          <MonthYearRangePicker
            label="在职时间"
            value={experience.date ?? ''}
            onChange={(value) => handleChange('date', value)}
          />
        </motion.div>
        <Field
          index={3}
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

export { ExperienceItem }
export default ExperienceItem
