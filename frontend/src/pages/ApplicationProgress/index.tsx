/**
 * 投递进展表：多维表格形式，白底 UI
 * 工具栏：撤销/重做/插入新行/置顶选中/删除选中/导出表格
 * 列：公司、投递链接、行业、标签、职位、地点、进展、进展状态、进展时间、备注、投递时间、内推码、使用的 PDF
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Undo2,
  Redo2,
  Plus,
  ArrowUp,
  Trash2,
  Download,
  GripVertical,
  ExternalLink,
  FileText,
  ChevronDown,
  Check,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getAllResumes } from '@/services/resumeStorage'
import type { SavedResume } from '@/services/storage/StorageAdapter'
import {
  listApplicationProgress,
  createApplicationProgress,
  updateApplicationProgress,
  deleteApplicationProgress,
  reorderApplicationProgress,
  type ApplicationProgressEntry,
  type ApplicationProgressPayload,
} from '@/services/applicationProgressApi'
import { cn } from '@/lib/utils'

const COLUMNS = [
  { key: 'company', label: '公司', width: '120px' },
  { key: 'application_link', label: '投递链接', width: '100px' },
  { key: 'industry', label: '行业', width: '90px' },
  { key: 'tags', label: '标签', width: '120px' },
  { key: 'position', label: '职位', width: '140px' },
  { key: 'location', label: '地点', width: '80px' },
  { key: 'progress', label: '进展', width: '90px' },
  { key: 'progress_status', label: '进展状态', width: '90px' },
  { key: 'progress_time', label: '进展时间', width: '110px' },
  { key: 'notes', label: '备注', width: '160px' },
  { key: 'application_date', label: '投递时间', width: '100px' },
  { key: 'referral_code', label: '内推码', width: '90px' },
  { key: 'resume_id', label: '使用的 PDF', width: '200px' },
] as const

const PROGRESS_OPTIONS = ['已投递', '笔试', '一面', '二面', '三面', 'AI面', '测评', 'HR终面']
const PROGRESS_STATUS_OPTIONS = ['等消息', '已过', '未过', '已放弃', '等我回复', '被调剂']

type DropdownOption = {
  value: string
  label: string
  hint?: string
}

function InlineDropdown({
  value,
  options,
  placeholder,
  disabled,
  autoOpen,
  onSelect,
  onClose,
}: {
  value: string | null
  options: DropdownOption[]
  placeholder: string
  disabled?: boolean
  autoOpen?: boolean
  onSelect: (value: string | null) => void
  onClose?: () => void
}) {
  const [open, setOpen] = useState(Boolean(autoOpen) && !disabled)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (autoOpen && !disabled) {
      setOpen(true)
    }
  }, [autoOpen, disabled])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (rootRef.current.contains(event.target as Node)) return
      setOpen(false)
      onClose?.()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [onClose])

  const selected = options.find((opt) => opt.value === (value ?? ''))

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          'w-full h-9 rounded-lg border px-3 text-left flex items-center justify-between gap-2 transition-colors',
          'bg-white dark:bg-slate-900',
          disabled
            ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
            : 'border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:border-indigo-400 dark:hover:border-indigo-500'
        )}
      >
        <span className={cn('truncate text-sm', selected ? 'font-medium' : 'text-slate-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn('w-4 h-4 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
          <button
            type="button"
            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-sm text-slate-500"
            onClick={() => {
              onSelect(null)
              setOpen(false)
              onClose?.()
            }}
          >
            {placeholder}
          </button>
          <div className="max-h-60 overflow-auto">
            {options.map((opt) => {
              const active = opt.value === (value ?? '')
              return (
                <button
                  type="button"
                  key={opt.value}
                  className={cn(
                    'w-full text-left px-3 py-2.5 transition-colors text-sm flex items-start gap-2',
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                  )}
                  onClick={() => {
                    onSelect(opt.value)
                    setOpen(false)
                    onClose?.()
                  }}
                >
                  <span className="pt-0.5">
                    {active ? <Check className="w-3.5 h-3.5" /> : <span className="inline-block w-3.5 h-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{opt.label}</span>
                    {opt.hint && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{opt.hint}</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function SortableTableRow({
  row,
  columns,
  resumes,
  selectedIds,
  editingCell,
  onToggleSelect,
  onEditingCell,
  onCellChange,
  renderCell,
}: {
  row: ApplicationProgressEntry
  columns: readonly { key: string; label: string; width: string }[]
  resumes: SavedResume[]
  selectedIds: Set<string>
  editingCell: { id: string; key: string } | null
  onToggleSelect: (id: string) => void
  onEditingCell: (cell: { id: string; key: string } | null) => void
  onCellChange: (id: string, key: string, value: string | string[] | null) => void
  renderCell: (row: ApplicationProgressEntry, col: { key: string; label: string; width: string }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-b border-slate-100 dark:border-slate-800 hover:bg-[#F8FAFF] dark:hover:bg-slate-800/60 transition-colors',
        selectedIds.has(row.id) && 'bg-indigo-50/50 dark:bg-indigo-900/10',
        isDragging && 'opacity-50 bg-slate-100 dark:bg-slate-800'
      )}
    >
      <td className="p-2">
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => onToggleSelect(row.id)}
          className="rounded"
        />
      </td>
      <td className="p-2 text-slate-400 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4" />
      </td>
      {columns.map((col) => (
        <td
          key={col.key}
          className="p-2 border-r border-slate-100 dark:border-slate-800 align-top"
          onDoubleClick={() => onEditingCell({ id: row.id, key: col.key })}
        >
          {renderCell(row, col)}
        </td>
      ))}
    </tr>
  )
}

export default function ApplicationProgressPage() {
  const { isAuthenticated, openModal } = useAuth()
  const [entries, setEntries] = useState<ApplicationProgressEntry[]>([])
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null)
  const [history, setHistory] = useState<ApplicationProgressEntry[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [listResult, resumesResult] = await Promise.allSettled([
        listApplicationProgress(),
        getAllResumes(),
      ])

      if (listResult.status === 'fulfilled') {
        let nextEntries = listResult.value
        if (nextEntries.length === 0) {
          try {
            const seeded = await createApplicationProgress({
              sort_order: 0,
              company: '字节跳动',
              application_link: 'https://jobs.bytedance.com/campus/position/application',
            })
            nextEntries = [seeded]
          } catch (seedError) {
            console.error(seedError)
          }
        }
        setEntries(nextEntries)
        setHistory([nextEntries])
        setHistoryIndex(0)
      } else {
        console.error(listResult.reason)
        setEntries([])
      }

      if (resumesResult.status === 'fulfilled') {
        setResumes(resumesResult.value)
      } else {
        console.error(resumesResult.reason)
        setResumes([])
      }
    } catch (e) {
      console.error(e)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!isAuthenticated) {
      openModal('login')
    }
  }, [isAuthenticated, openModal])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(entries.map((e) => e.id)))
  }

  const handleInsertRow = async () => {
    if (!isAuthenticated) {
      openModal('login')
      return
    }
    try {
      const created = await createApplicationProgress({ sort_order: 0 })
      setEntries((prev) => [created, ...prev])
      setEditingCell({ id: created.id, key: 'company' })
      // 后台拉取一次，确保与服务端排序/数据一致
      void loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteSelected = async () => {
    if (!isAuthenticated || selectedIds.size === 0) return
    try {
      for (const id of selectedIds) {
        await deleteApplicationProgress(id)
      }
      setSelectedIds(new Set())
      await loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handlePinSelected = async () => {
    if (!isAuthenticated || selectedIds.size === 0) return
    const pinned = entries.filter((e) => selectedIds.has(e.id))
    const rest = entries.filter((e) => !selectedIds.has(e.id))
    const newOrder = [...pinned, ...rest].map((e) => e.id)
    try {
      await reorderApplicationProgress(newOrder)
      await loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = entries.findIndex((e) => e.id === active.id)
      const newIndex = entries.findIndex((e) => e.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const newOrder = arrayMove(entries.map((e) => e.id), oldIndex, newIndex)
      try {
        await reorderApplicationProgress(newOrder)
        await loadData()
      } catch (e) {
        console.error(e)
      }
    },
    [entries, loadData]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const renderCell = useCallback(
    (row: ApplicationProgressEntry, col: { key: string; label: string; width: string }) => {
      if (editingCell?.id === row.id && editingCell?.key === col.key) {
        if (col.key === 'resume_id') {
          const hasResumes = resumes.length > 0
          const resumeOptions: DropdownOption[] = resumes.map((r) => ({
            value: r.id,
            label: r.alias || r.name,
            hint: r.alias && r.alias !== r.name ? r.name : undefined,
          }))
          return (
            <InlineDropdown
              value={row.resume_id ?? null}
              options={resumeOptions}
              placeholder={hasResumes ? '未选择（不使用 PDF）' : '暂无可选 PDF'}
              disabled={!hasResumes}
              autoOpen
              onSelect={(val) => handleCellChange(row.id, col.key, val)}
              onClose={() => setEditingCell(null)}
            />
          )
        }
        if (col.key === 'tags') {
          return (
            <input
              type="text"
              className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
              defaultValue={((row.tags ?? []) as string[]).join(', ')}
              onBlur={(e) => {
                const raw = e.target.value.trim()
                const value = raw ? raw.split(/[,，;；\s]+/).map((s) => s.trim()).filter(Boolean) : []
                handleCellChange(row.id, col.key, value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              autoFocus
            />
          )
        }
        if (col.key === 'progress') {
          const options: DropdownOption[] = PROGRESS_OPTIONS.map((o) => ({ value: o, label: o }))
          return (
            <InlineDropdown
              value={row.progress ?? null}
              options={options}
              placeholder="未设置"
              autoOpen
              onSelect={(val) => handleCellChange(row.id, col.key, val)}
              onClose={() => setEditingCell(null)}
            />
          )
        }
        if (col.key === 'progress_status') {
          const options: DropdownOption[] = PROGRESS_STATUS_OPTIONS.map((o) => ({ value: o, label: o }))
          return (
            <InlineDropdown
              value={row.progress_status ?? null}
              options={options}
              placeholder="未设置"
              autoOpen
              onSelect={(val) => handleCellChange(row.id, col.key, val)}
              onClose={() => setEditingCell(null)}
            />
          )
        }
        return (
          <input
            type="text"
            className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
            defaultValue={String((row as Record<string, unknown>)[col.key] ?? '')}
            onBlur={(e) => {
              const v = e.target.value.trim() || null
              handleCellChange(row.id, col.key, v)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            autoFocus
          />
        )
      }
      if (col.key === 'application_link') {
        const val = (row as Record<string, unknown>)[col.key]
        return val ? (
          <a
            href={val as string}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            前往链接 <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-slate-400">-</span>
        )
      }
      if (col.key === 'progress') {
        const value = row.progress
        return value ? (
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {value}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        )
      }
      if (col.key === 'progress_status') {
        const value = row.progress_status
        if (!value) return <span className="text-slate-400">-</span>
        const toneClass =
          value === '已过'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : value === '未过' || value === '已放弃'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-slate-200 bg-slate-100 text-slate-700'
        return (
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border', toneClass)}>
            {value}
          </span>
        )
      }
      if (col.key === 'tags') {
        return (
          <div className="flex flex-wrap gap-1">
            {((row.tags ?? []) as string[]).map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
              >
                {t}
              </span>
            ))}
            {(!row.tags || row.tags.length === 0) && <span className="text-slate-400">-</span>}
          </div>
        )
      }
      if (col.key === 'resume_id') {
        const matchedResume = row.resume_id ? resumes.find((r) => r.id === row.resume_id) : null
        if (!matchedResume) {
          return <span className="text-slate-400">未选择 PDF</span>
        }
        const primary = matchedResume.alias || matchedResume.name
        const secondary =
          matchedResume.alias && matchedResume.alias !== matchedResume.name ? matchedResume.name : ''
        return (
          <div className="inline-flex items-center gap-2 max-w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2 py-1">
            <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-800 dark:text-slate-200 truncate font-medium">{primary}</div>
              {secondary && (
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{secondary}</div>
              )}
            </div>
          </div>
        )
      }
      return (
        <span className="text-slate-700 dark:text-slate-300">
          {(row as Record<string, unknown>)[col.key] != null
            ? String((row as Record<string, unknown>)[col.key])
            : '-'}
        </span>
      )
    },
    [editingCell, resumes, handleCellChange, setEditingCell]
  )

  const handleExportCsv = () => {
    const headers = ['公司', '投递链接', '行业', '标签', '职位', '地点', '进展', '进展状态', '进展时间', '备注', '投递时间', '内推码', '使用的 PDF']
    const rows = entries.map((e) => [
      e.company ?? '',
      e.application_link ?? '',
      e.industry ?? '',
      (e.tags ?? []).join(';'),
      e.position ?? '',
      e.location ?? '',
      e.progress ?? '',
      e.progress_status ?? '',
      e.progress_time ?? '',
      e.notes ?? '',
      e.application_date ?? '',
      e.referral_code ?? '',
      resumes.find((r) => r.id === e.resume_id)?.alias || resumes.find((r) => r.id === e.resume_id)?.name || '',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `投递进展表_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleCellChange(id: string, key: string, value: string | string[] | null) {
    const entry = entries.find((e) => e.id === id)
    if (!entry) return
    setEditingCell(null)
    const payload: ApplicationProgressPayload = {}
    if (key === 'tags') {
      payload.tags = Array.isArray(value) ? value : (value ? [value] : [])
    } else {
      (payload as Record<string, unknown>)[key] = value ?? null
    }
    try {
      await updateApplicationProgress(id, payload)
      await loadData()
    } catch (e) {
      console.error(e)
    }
  }

  if (!isAuthenticated) {
    return (
      <WorkspaceLayout>
        <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400">
          <p>请先登录后使用投递进展表。</p>
        </div>
      </WorkspaceLayout>
    )
  }

  return (
    <WorkspaceLayout>
      <div className="h-full flex flex-col bg-[#F6F8FC] dark:bg-slate-900">
        {/* 工具栏 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/70 backdrop-blur shrink-0">
          <button
            type="button"
            className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            title="撤销"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            title="重做"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleInsertRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            插入新行
          </button>
          <button
            type="button"
            onClick={handlePinSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-sm"
          >
            <ArrowUp className="w-4 h-4" />
            置顶选中
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            删除选中
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm"
          >
            <Download className="w-4 h-4" />
            导出表格
          </button>
        </div>

        {/* 标题 */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            我的投递进展记录表（双击可编辑）
          </h1>
        </div>

        {/* 表格 */}
        <div className="flex-1 overflow-auto p-3">
          {loading ? (
            <div className="p-8 text-center text-slate-500">加载中...</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-100/95 dark:bg-slate-800 z-10 backdrop-blur">
                  <tr>
                    <th className="border-b border-slate-200 dark:border-slate-700 p-2 w-10">
                      <input
                        type="checkbox"
                        checked={entries.length > 0 && selectedIds.size === entries.length}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="border-b border-slate-200 dark:border-slate-700 p-2 w-10" />
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="border-b border-slate-200 dark:border-slate-700 p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap"
                        style={{ minWidth: col.width }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <SortableContext
                  items={entries.map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody>
                    {entries.map((row) => (
                      <SortableTableRow
                        key={row.id}
                        row={row}
                        columns={COLUMNS}
                        resumes={resumes}
                        selectedIds={selectedIds}
                        editingCell={editingCell}
                        onToggleSelect={toggleSelect}
                        onEditingCell={setEditingCell}
                        onCellChange={handleCellChange}
                        renderCell={renderCell}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
              </div>
            </DndContext>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  )
}
