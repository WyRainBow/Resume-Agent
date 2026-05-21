import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle, FileText, LayoutTemplate, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import {
  listResumeTemplates,
  normalizeLatexTemplateId,
  type ResumeTemplate,
} from '@/services/resumeTemplates'
import { setCurrentResumeId } from '@/services/resumeStorage'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'resume_v2_data'

export default function TemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<ResumeTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || templates[0],
    [selectedTemplateId, templates],
  )

  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const nextTemplates = await listResumeTemplates('latex')
      setTemplates(nextTemplates)
      setSelectedTemplateId((current) => current || nextTemplates[0]?.id || null)
    } catch (err) {
      console.error('[Templates] failed to load resume templates:', err)
      setError(err instanceof Error ? err.message : '模板加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplates()
  }, [])

  const handleUseTemplate = (templateId: string) => {
    const normalizedTemplateId = normalizeLatexTemplateId(templateId)
    setCurrentResumeId(null)
    localStorage.removeItem(STORAGE_KEY)
    navigate(`/workspace/latex?templateId=${encodeURIComponent(normalizedTemplateId)}`, {
      state: { templateId: normalizedTemplateId },
    })
  }

  return (
    <WorkspaceLayout>
      <div className="h-full min-h-0 overflow-auto bg-slate-50">
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-6 py-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 shadow-sm">
                <LayoutTemplate className="h-4 w-4" />
                LaTeX 模板
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">模板广场</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                选择一个排版模板后进入编辑器，简历内容可以继续修改。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadTemplates()}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                刷新
              </button>
              <button
                type="button"
                disabled={!selectedTemplate}
                onClick={() => selectedTemplate && handleUseTemplate(selectedTemplate.id)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                使用模板
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </header>

          {error ? (
            <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0">
              {loading && templates.length === 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-[420px] animate-pulse rounded-lg border border-slate-200 bg-white" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {templates.map((template) => {
                    const selected = selectedTemplate?.id === template.id
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(template.id)}
                        onDoubleClick={() => handleUseTemplate(template.id)}
                        className={cn(
                          'group flex min-h-[420px] flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                          selected ? 'border-slate-950 ring-2 ring-slate-950/10' : 'border-slate-200',
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
                              <FileText className="h-12 w-12" />
                            </div>
                          )}
                          {selected ? (
                            <div className="absolute right-3 top-3 rounded-full bg-slate-950 p-1.5 text-white shadow">
                              <CheckCircle className="h-4 w-4" />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div>
                            <h2 className="text-base font-semibold text-slate-950">{template.name}</h2>
                            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                              {template.description}
                            </p>
                          </div>
                          <div className="mt-auto flex flex-wrap gap-2">
                            {template.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              {selectedTemplate ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">当前选择</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-950">{selectedTemplate.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTemplate.description}</p>
                  </div>
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-sm font-semibold text-slate-900">分类</p>
                    <p className="mt-1 text-sm text-slate-600">{selectedTemplate.category}</p>
                  </div>
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-sm font-semibold text-slate-900">标签</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedTemplate.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUseTemplate(selectedTemplate.id)}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    进入编辑
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">暂无可用模板</p>
              )}
            </aside>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  )
}
