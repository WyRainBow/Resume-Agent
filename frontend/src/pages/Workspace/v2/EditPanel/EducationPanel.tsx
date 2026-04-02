/**
 * 教育经历面板
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { PlusCircle, ChevronDown, Eye, Trash2, Check, GripVertical, X, Image, Plus, Loader2 } from 'lucide-react'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import { cn } from '../../../../lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Education } from '../types'
import Field from './Field'
import { MonthYearRangePicker } from '../shared/MonthYearRangePicker'
import { FontSizePicker } from '../shared/FontSizePicker'
import {
  type SchoolLogo,
  type SchoolLogoGroup,
  fetchSchoolLogos,
  getCachedSchoolLogoGroups,
  getCachedSchoolLogos,
  getLastSchoolLogoError,
  getSchoolLogoByKey,
  getSchoolLogoUrl,
  matchSchoolLogo,
  refreshSchoolLogos,
  uploadSchoolLogo,
} from '../constants/schoolLogos'

import { AIImportButton } from '@/components/common/AIImportButton';

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

/** 学历选项：仅 大专、本科、硕士 */
const DEGREE_OPTIONS = ['大专', '本科', '硕士'] as const
const SCHOOL_FONT_SIZE_OPTIONS = [13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28]

const markdownToHtml = (text: string): string => {
  if (!text) return ''
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function normalizeMonthValue(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s || s === 'undefined' || s === 'null') return ''
  if (s === '至今') return '至今'
  const m = s.match(/^(\d{4})[.\-/](\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`
  return /^\d{4}-\d{2}$/.test(s) ? s : ''
}

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

function SchoolLogoSelector({
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
  const [logos, setLogos] = useState<SchoolLogo[]>(getCachedSchoolLogos())
  const [groups, setGroups] = useState<SchoolLogoGroup[]>(getCachedSchoolLogoGroups())
  const [logoLoadError, setLogoLoadError] = useState<string | null>(getLastSchoolLogoError())
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchSchoolLogos().then((list) => {
      const grouped = getCachedSchoolLogoGroups()
      if (list.length > 0) {
        setLogos(list)
        setGroups(grouped)
        setLogoLoadError(null)
      } else {
        setLogoLoadError(getLastSchoolLogoError())
      }
    })
  }, [])

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

  useEffect(() => {
    if (!open) {
      setActiveGroupKey(null)
      setSearch('')
    }
  }, [open])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeGroupKey) return
    e.target.value = ''
    setUploading(true)
    try {
      const newLogo = await uploadSchoolLogo(file, activeGroupKey)
      const updated = await refreshSchoolLogos()
      setLogos(updated)
      setGroups(getCachedSchoolLogoGroups())
      onSelect(newLogo.key)
      setOpen(false)
      setSearch('')
    } catch (err: any) {
      alert(err.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }, [activeGroupKey, onSelect])

  const filteredLogos = search
    ? logos.filter(
        (logo) =>
          logo.name.toLowerCase().includes(search.toLowerCase()) ||
          logo.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase()))
      )
    : logos
  const activeGroup = groups.find((group) => group.key === activeGroupKey) || null
  const visibleLogos = activeGroup
    ? activeGroup.logos.filter((logo) => {
        if (!search) return true
        const keywordMatched = (logo.keywords || []).some((k) => k.toLowerCase().includes(search.toLowerCase()))
        return logo.name.toLowerCase().includes(search.toLowerCase()) || keywordMatched
      })
    : []

  const selectedLogoUrl = selectedKey ? getSchoolLogoUrl(selectedKey) : null

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
          <span>{selectedKey ? '学校 Logo' : '+ 学校 Logo'}</span>
        </button>
        {selectedKey && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="rounded-md p-1 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/30"
            title="移除学校 Logo"
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
            {activeGroup && (
              <div className="border-b border-slate-100 p-3 dark:border-neutral-800">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveGroupKey(null)
                      setSearch('')
                    }}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
                  >
                    返回上一级
                  </button>
                  <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">{activeGroup.name}</span>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`搜索 ${activeGroup.name} 学校...`}
                  autoFocus
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/35 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                />
              </div>
            )}

            <div className="max-h-56 overflow-y-auto p-3">
              {logos.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {logoLoadError ? `学校 Logo 列表加载失败：${logoLoadError}` : '正在加载学校 Logo 列表...'}
                </div>
              ) : !activeGroup ? (
                <div className="grid grid-cols-3 gap-2">
                  {groups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => {
                        setActiveGroupKey(group.key)
                        setSearch('')
                      }}
                      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20"
                    >
                      <div className="text-2xl">📁</div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-neutral-200">{group.name}</div>
                      <div className="text-[10px] text-slate-400">{group.logos.length} 个</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {visibleLogos.map((logo) => {
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
                        <img src={logo.url} alt={logo.name} className="h-8 w-8 object-contain" loading="lazy" />
                        <span className="w-full truncate text-[10px] leading-tight text-gray-600 dark:text-neutral-400">
                          {logo.name}
                        </span>
                      </button>
                    )
                  })}
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
                        title={`上传到 ${activeGroup.name}`}
                      >
                        {uploading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
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
              {logos.length > 0 && activeGroup && visibleLogos.length === 0 && (
                <div className="py-4 text-center text-xs text-slate-400">
                  未找到匹配的学校
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * 教育经历条目
 */
const EducationItem = ({
  education,
  onUpdate,
  onDelete,
}: {
  education: Education
  onUpdate: (education: Education) => void
  onDelete: (id: string) => void
}) => {
  const { user } = useAuth()
  const roleFromToken = getAuthRoleFromToken()
  const canUploadLogo = !!user && (roleFromToken === 'admin' || roleFromToken === 'member')
  const [expanded, setExpanded] = useState(false)
  const [degreeOpen, setDegreeOpen] = useState(false)
  const [schoolLogosLoaded, setSchoolLogosLoaded] = useState(getCachedSchoolLogos().length > 0)
  const degreeWrapRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()
  const autoMatchedKey = !education.schoolLogo ? matchSchoolLogo(education.school || '') : null
  const effectiveLogoKey = education.schoolLogo || autoMatchedKey
  const schoolLogoUrl = effectiveLogoKey ? getSchoolLogoUrl(effectiveLogoKey) : null
  const schoolLogoSize = education.schoolLogoSize || 20
  const schoolLogoPercent = ((schoolLogoSize - 10) / (48 - 10)) * 100

  useEffect(() => {
    if (schoolLogosLoaded) return
    fetchSchoolLogos().then(() => setSchoolLogosLoaded(true))
  }, [schoolLogosLoaded])

  useEffect(() => {
    if (!degreeOpen) return
    const handler = (e: MouseEvent) => {
      if (degreeWrapRef.current?.contains(e.target as Node)) return
      setDegreeOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [degreeOpen])

  return (
    <Reorder.Item
      id={education.id}
      value={education}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        'rounded-lg border overflow-hidden transition-opacity',
        'bg-white hover:border-primary',
        'dark:bg-neutral-900/30 dark:border-neutral-800',
        'border-gray-100',
        education.visible === false && 'opacity-40'
      )}
      whileDrag={{ scale: 1.02 }}
    >
      <div className="min-w-0">
        <div
          className={cn(
            'px-4 py-4 flex items-center justify-between cursor-pointer',
            expanded && 'bg-gray-50 dark:bg-neutral-800/50'
          )}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div
              onPointerDown={(event) => dragControls.start(event)}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                'w-6 -ml-1 mr-0 flex items-center justify-center touch-none shrink-0',
                'cursor-grab hover:bg-gray-100 dark:hover:bg-neutral-800/50 rounded'
              )}
            >
              <GripVertical className={cn('w-4 h-4', 'text-gray-300 dark:text-neutral-600')} />
            </div>
            {schoolLogoUrl && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-800">
                <img src={schoolLogoUrl} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <h3
                className="truncate font-medium text-gray-700 dark:text-neutral-200"
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(education.school || '未命名学校')
                }}
              />
              {education.major && (
                <p className="text-sm text-gray-500 truncate">{education.major}</p>
              )}
            </div>
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
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0 * 0.05, ease: 'easeOut' }}
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <div className="mb-2 rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5 dark:border-neutral-700 dark:bg-neutral-900/50">
                      <div className="flex min-w-0 items-center gap-2">
                        <label className="shrink-0 text-xs font-semibold tracking-wide text-slate-600 dark:text-neutral-300">
                          学校
                        </label>
                        <SchoolLogoSelector
                          selectedKey={education.schoolLogo}
                          onSelect={(key) => onUpdate({ ...education, schoolLogo: key })}
                          onClear={() => onUpdate({ ...education, schoolLogo: '', schoolLogoSize: undefined })}
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
                              value={schoolLogoSize}
                              onChange={(e) => {
                                if (!education.schoolLogo && autoMatchedKey) {
                                  onUpdate({ ...education, schoolLogo: autoMatchedKey, schoolLogoSize: Number(e.target.value) })
                                  return
                                }
                                onUpdate({ ...education, schoolLogoSize: Number(e.target.value) })
                              }}
                              className="h-2 w-20 cursor-pointer appearance-none rounded-full bg-transparent accent-indigo-500 sm:w-24 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-indigo-500"
                              style={{
                                background: `linear-gradient(to right, rgb(99 102 241) ${schoolLogoPercent}%, rgb(203 213 225) ${schoolLogoPercent}%)`,
                              }}
                              title={`学校 Logo 大小: ${schoolLogoSize}px`}
                            />
                            <span className="inline-flex min-w-[38px] items-center justify-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                              {schoolLogoSize}px
                            </span>
                            {education.schoolLogoSize && (
                              <button
                                type="button"
                                onClick={() => onUpdate({ ...education, schoolLogoSize: undefined })}
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
                    {autoMatchedKey && (
                      <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-sky-200/80 bg-gradient-to-r from-sky-50/80 to-cyan-50/80 px-2.5 py-1.5 shadow-sm shadow-sky-100/60 dark:border-sky-800/60 dark:from-sky-900/20 dark:to-cyan-900/10 dark:shadow-none">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/80 bg-white/90 dark:border-sky-800/60 dark:bg-neutral-900">
                          <img src={getSchoolLogoUrl(autoMatchedKey)!} alt="" className="h-4 w-4 object-contain" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-sky-500/90 dark:text-sky-400/80">
                            学校 Logo 匹配
                          </div>
                          <div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                            已匹配 {getSchoolLogoByKey(autoMatchedKey)?.name}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onUpdate({ ...education, schoolLogo: autoMatchedKey })}
                          className="inline-flex h-7 items-center rounded-lg border border-indigo-200 bg-white px-2.5 text-[11px] font-semibold text-indigo-600 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm dark:border-indigo-700/70 dark:bg-neutral-900 dark:text-indigo-300 dark:hover:border-indigo-600"
                        >
                          使用
                        </button>
                      </div>
                    )}
                    <Field
                      index={0}
                      value={education.school}
                      onChange={(v) => onUpdate({ ...education, school: v })}
                      placeholder="请输入学校名称"
                      formatButtons={['bold']}
                      rightActions={
                        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 dark:border-neutral-700 dark:bg-neutral-800">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400">字号</span>
                          <FontSizePicker
                            value={education.schoolNameFontSize ?? 15}
                            onChange={(size) => onUpdate({ ...education, schoolNameFontSize: size })}
                            options={SCHOOL_FONT_SIZE_OPTIONS}
                          />
                        </div>
                      }
                    />
                  </div>
                  <Field
                    index={1}
                    label="专业"
                    value={education.major}
                    onChange={(v) => onUpdate({ ...education, major: v })}
                    placeholder="请输入专业"
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 2 * 0.05, ease: 'easeOut' }}
                  className="grid grid-cols-2 gap-4"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 2 * 0.05, ease: 'easeOut' }}
                    className="space-y-2" ref={degreeWrapRef}
                  >
                    <label className="text-sm text-gray-600 dark:text-neutral-300">
                      学历<span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDegreeOpen((v) => !v)
                        }}
                        className={cn(
                          'w-full px-3 py-2 rounded-md border text-left flex items-center justify-between',
                          'bg-white border-gray-200 text-gray-700',
                          'dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200',
                          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                          degreeOpen && 'border-primary ring-2 ring-primary/20'
                        )}
                      >
                        <span className={education.degree ? '' : 'text-gray-400 dark:text-neutral-500'}>
                          {education.degree || '请选择学历'}
                        </span>
                        <ChevronDown className={cn('w-4 h-4 text-gray-400 shrink-0', degreeOpen && 'rotate-180')} />
                      </button>
                      <AnimatePresence>
                        {degreeOpen && (
                          <motion.ul
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1 max-h-48 overflow-auto"
                          >
                            {DEGREE_OPTIONS.map((opt) => (
                              <li key={opt}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onUpdate({ ...education, degree: opt })
                                    setDegreeOpen(false)
                                  }}
                                  className={cn(
                                    'w-full px-3 py-2 text-left flex items-center justify-between text-sm',
                                    education.degree === opt
                                      ? 'bg-gray-100 dark:bg-neutral-800 text-primary'
                                      : 'hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-gray-700 dark:text-neutral-200'
                                  )}
                                >
                                  {opt}
                                  {education.degree === opt && <Check className="w-4 h-4 text-primary shrink-0" />}
                                </button>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                  <Field
                    index={3}
                    label="GPA"
                    value={education.gpa || ''}
                    onChange={(v) => onUpdate({ ...education, gpa: v })}
                    placeholder="如：3.8/4.0"
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 4 * 0.05, ease: 'easeOut' }}
                >
                  <MonthYearRangePicker
                    label="入学 / 毕业时间"
                    value={`${normalizeMonthValue(education.startDate)} - ${normalizeMonthValue(education.endDate)}`}
                    onChange={(v) => {
                      const [start, end] = (v || '').split(' - ').map((p) => (p || '').trim())
                      onUpdate({ ...education, startDate: start, endDate: end })
                    }}
                  />
                </motion.div>
                <Field
                  index={5}
                  label="补充说明（可以填写校园经历、GPA、四六级等）"
                  value={education.description || ''}
                  onChange={(v) => onUpdate({ ...education, description: v })}
                  type="editor"
                  placeholder="如：荣誉奖项、相关课程等"
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
        <AIImportButton 
          onClick={onAIImport}
          className="w-full"
        />
      )}

      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400 px-1">
        <GripVertical className="w-3.5 h-3.5" />
        可拖拽调整顺序
      </div>

      <Reorder.Group axis="y" values={educations} onReorder={onReorder} className="space-y-3">
        {educations.map((edu) => (
          <EducationItem
            key={edu.id}
            education={edu}
            onUpdate={onUpdate}
            onDelete={onDelete}
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
