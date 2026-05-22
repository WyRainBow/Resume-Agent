import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle, FileText, Image, LayoutTemplate, ListChecks, Search, Tags } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import {
  DEFAULT_RESUME_DIRECTION_TEMPLATE_ID,
  RESUME_DIRECTION_TEMPLATES,
  type PhotoPlacement,
} from '@/data/resumeDirectionTemplates'
import { setCurrentResumeId } from '@/services/resumeStorage'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'resume_v2_data'

const PHOTO_PLACEMENT_LABEL: Record<PhotoPlacement, string> = {
  left: '照片左侧',
  right: '照片右侧',
  none: '无照片优先',
}

export default function TemplatesPage() {
  const navigate = useNavigate()
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_RESUME_DIRECTION_TEMPLATE_ID)
  const [keyword, setKeyword] = useState('')

  const templates = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return RESUME_DIRECTION_TEMPLATES
    return RESUME_DIRECTION_TEMPLATES.filter((template) => {
      const haystack = [
        template.name,
        template.description,
        template.category,
        ...template.tags,
        ...template.bestFor,
        ...template.sections.map((section) => `${section.title} ${section.guidance}`),
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [keyword])

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === selectedTemplateId) ||
      RESUME_DIRECTION_TEMPLATES.find((template) => template.id === selectedTemplateId) ||
      templates[0] ||
      RESUME_DIRECTION_TEMPLATES[0],
    [selectedTemplateId, templates],
  )

  const handleUseTemplate = (templateId: string) => {
    setCurrentResumeId(null)
    localStorage.removeItem(STORAGE_KEY)
    navigate(`/workspace/latex?directionTemplateId=${encodeURIComponent(templateId)}`, {
      state: { directionTemplateId: templateId },
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
                简历方向模板
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">模板广场</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                选择一个方向模板，新建一份带有对应模块标题、结构顺序和照片位置设置的 LaTeX 简历。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索方向、能力或模块"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 sm:w-64"
                />
              </label>
              <button
                type="button"
                disabled={!selectedTemplate}
                onClick={() => selectedTemplate && handleUseTemplate(selectedTemplate.id)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                使用模板
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="min-w-0">
              {templates.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  没有匹配的模板
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
                          'group flex min-h-[430px] flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                          selected ? 'border-slate-950 ring-2 ring-slate-950/10' : 'border-slate-200',
                        )}
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100 p-4">
                          <div className="h-full rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                            <div
                              className={cn(
                                'relative min-h-16 border-b border-slate-200 pb-3',
                                template.photoPlacement === 'left' && 'pl-16',
                                template.photoPlacement === 'right' && 'pr-16',
                              )}
                            >
                              {template.photoPlacement !== 'none' ? (
                                <div
                                  className={cn(
                                    'absolute top-0 h-14 w-11 rounded-sm border border-slate-300 bg-slate-100',
                                    template.photoPlacement === 'left' ? 'left-0' : 'right-0',
                                  )}
                                >
                                  <Image className="m-auto mt-4 h-5 w-5 text-slate-400" />
                                </div>
                              ) : null}
                              <div className="h-3 w-24 rounded bg-slate-900" />
                              <div className="mt-2 h-2 w-32 rounded bg-slate-300" />
                              <div className="mt-1 h-2 w-28 rounded bg-slate-200" />
                            </div>
                            <div className="mt-4 space-y-3">
                              {template.sections.slice(1, 6).map((section) => (
                                <div key={section.id}>
                                  <div className="h-2.5 w-20 rounded bg-emerald-700" />
                                  <div className="mt-2 space-y-1">
                                    <div className="h-1.5 w-full rounded bg-slate-200" />
                                    <div className="h-1.5 w-4/5 rounded bg-slate-200" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {selected ? (
                            <div className="absolute right-3 top-3 rounded-full bg-slate-950 p-1.5 text-white shadow">
                              <CheckCircle className="h-4 w-4" />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-slate-500" />
                              <h2 className="text-base font-semibold text-slate-950">{template.name}</h2>
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-600">
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

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <Tags className="h-4 w-4 text-slate-500" />
                        分类
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{selectedTemplate.category}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <Image className="h-4 w-4 text-slate-500" />
                        照片
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {PHOTO_PLACEMENT_LABEL[selectedTemplate.photoPlacement]}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-sm font-semibold text-slate-900">适合场景</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedTemplate.bestFor.map((item) => (
                        <span key={item} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <ListChecks className="h-4 w-4 text-slate-500" />
                      模块结构
                    </p>
                    <div className="mt-3 space-y-3">
                      {selectedTemplate.sections.slice(0, 6).map((section) => (
                        <div key={section.id}>
                          <p className="text-sm font-medium text-slate-800">{section.title}</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-500">{section.guidance}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUseTemplate(selectedTemplate.id)}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    新建并编辑
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
