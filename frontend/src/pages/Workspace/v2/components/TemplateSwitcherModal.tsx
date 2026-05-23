import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, FileText, RefreshCw, X } from 'lucide-react'
import {
  listResumeTemplates,
  normalizeHtmlTemplateId,
  normalizeLatexTemplateId,
  type ResumeTemplate,
  type ResumeTemplateType,
} from '@/services/resumeTemplates'
import { listHtmlTemplates } from '../html/templates/registry'
import { cn } from '@/lib/utils'

interface TemplateSwitcherModalProps {
  isOpen: boolean
  templateType?: ResumeTemplateType
  currentTemplateId?: string | null
  onClose: () => void
  onSelect: (templateId: string) => void
}

export function TemplateSwitcherModal({
  isOpen,
  templateType = 'latex',
  currentTemplateId,
  onClose,
  onSelect,
}: TemplateSwitcherModalProps) {
  const [templates, setTemplates] = useState<ResumeTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const normalizedCurrentTemplateId = templateType === 'html'
    ? normalizeHtmlTemplateId(currentTemplateId)
    : normalizeLatexTemplateId(currentTemplateId)

  const currentTemplate = useMemo(
    () => templates.find((template) => template.id === normalizedCurrentTemplateId),
    [normalizedCurrentTemplateId, templates],
  )

  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      setTemplates(templateType === 'html' ? listHtmlTemplates() : await listResumeTemplates('latex'))
    } catch (err) {
      console.error('[TemplateSwitcher] failed to load templates:', err)
      setError(err instanceof Error ? err.message : '模板加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen || templates.length > 0) return
    void loadTemplates()
  }, [isOpen, templateType, templates.length])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSelect = (templateId: string) => {
    onSelect(templateType === 'html' ? normalizeHtmlTemplateId(templateId) : normalizeLatexTemplateId(templateId))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
        aria-label="关闭模板选择"
      />
      <div className="relative flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              更换 {templateType === 'html' ? 'HTML' : 'LaTeX'} 模板
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              当前模板：{currentTemplate?.name || normalizedCurrentTemplateId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadTemplates()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              刷新
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {error ? (
          <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {loading && templates.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[360px] animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => {
                const selected = template.id === normalizedCurrentTemplateId
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelect(template.id)}
                    className={cn(
                      'group flex min-h-[360px] flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                      selected ? 'border-emerald-600 ring-2 ring-emerald-600/10' : 'border-slate-200',
                    )}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
                      {template.previewUrl ? (
                        <img
                          src={template.previewUrl}
                          alt={template.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <FileText className="h-10 w-10" />
                        </div>
                      )}
                      {selected ? (
                        <div className="absolute right-3 top-3 rounded-full bg-emerald-600 p-1.5 text-white shadow">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h3 className="text-base font-semibold text-slate-950">{template.name}</h3>
                      <p className="line-clamp-2 text-sm leading-5 text-slate-600">{template.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
