import { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ArrowRight, CheckCircle, FileText, Image, LayoutTemplate, ListChecks, Search, Tags } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import {
  createResumeFromDirectionTemplate,
  DEFAULT_RESUME_DIRECTION_TEMPLATE_ID,
  RESUME_DIRECTION_TEMPLATES,
  resolveDirectionTemplateEngine,
  type PhotoPlacement,
  type ResumeDirectionTemplate,
  type ResumeRenderEngine,
} from '@/data/resumeDirectionTemplates'
import { setCurrentResumeId } from '@/services/resumeStorage'
import { cn } from '@/lib/utils'
import { renderPDF } from '@/services/api'
import { convertToBackendFormat } from '@/pages/Workspace/v2/utils/convertToBackend'
import { initPDF } from '@/components/PDFEditor/pdfWorkerConfig'

const STORAGE_KEY = 'resume_v2_data'
type TemplateGroup = {
  engine: ResumeRenderEngine
  title: string
  description: string
  templates: ResumeDirectionTemplate[]
}

const PHOTO_PLACEMENT_LABEL: Record<PhotoPlacement, string> = {
  left: '照片左侧',
  right: '照片右侧',
  none: '无照片优先',
}

const latexPreviewPdfCache = new Map<string, Promise<Blob>>()

const stripPreviewText = (value = '') =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <div className="border-b border-slate-300 pb-0.5 text-[7px] font-bold text-slate-900">{title}</div>
      {children}
    </section>
  )
}

function PreviewPhotoSlot() {
  return (
    <div className="flex h-9 w-8 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-slate-100 text-[6px] font-semibold text-slate-400">
      照片
    </div>
  )
}

function loadLatexPreviewPdf(template: ResumeDirectionTemplate): Promise<Blob> {
  const cached = latexPreviewPdfCache.get(template.id)
  if (cached) return cached

  const promise = (async () => {
    const resumeData = createResumeFromDirectionTemplate(template.id)
    const backendData = convertToBackendFormat(resumeData)
    return renderPDF(
      backendData as any,
      false,
      backendData.sectionOrder,
      undefined,
      'local',
      resumeData.templateId,
    )
  })()

  promise.catch(() => {
    latexPreviewPdfCache.delete(template.id)
  })
  latexPreviewPdfCache.set(template.id, promise)
  return promise
}

function RenderedLatexPreview({ template }: { template: ResumeDirectionTemplate }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null

    const renderPreview = async () => {
      setStatus('loading')

      try {
        initPDF()
        const blob = await loadLatexPreviewPdf(template)
        if (cancelled) return

        const data = await blob.arrayBuffer()
        const loadingTask = pdfjsLib.getDocument({
          data,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          disableStream: true,
          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
        })
        pdfDocument = await loadingTask.promise
        if (cancelled) return

        const page = await pdfDocument.getPage(1)
        if (cancelled || !canvasRef.current) return

        const baseViewport = page.getViewport({ scale: 1 })
        const deviceRatio = Math.min(window.devicePixelRatio || 1, 2)
        const renderScale = (420 / baseViewport.width) * deviceRatio
        const viewport = page.getViewport({ scale: renderScale })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        context.clearRect(0, 0, canvas.width, canvas.height)

        const renderTask = page.render({ canvasContext: context, viewport })
        renderTaskRef.current = renderTask
        await renderTask.promise
        renderTaskRef.current = null
        if (!cancelled) setStatus('ready')
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (!message.includes('Rendering cancelled')) {
          console.warn('[templates] LaTeX preview render failed:', error)
          if (!cancelled) setStatus('error')
        }
      }
    }

    void renderPreview()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
      void pdfDocument?.destroy()
    }
  }, [template])

  return (
    <div className="relative flex h-full w-full items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm transition duration-300 group-hover:scale-[1.01]">
      <canvas ref={canvasRef} className={cn('h-full w-full object-contain', status !== 'ready' && 'opacity-0')} />
      {status === 'loading' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
          <span className="text-xs font-medium">渲染预览中</span>
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
          <FileText className="h-10 w-10" />
          <span className="text-xs font-medium">预览生成失败</span>
        </div>
      ) : null}
    </div>
  )
}

function InlineTemplatePreview({ template }: { template: ResumeDirectionTemplate }) {
  const sample = template.sampleResume
  const reservePhoto = template.photoPlacement !== 'none'
  const education = sample?.education[0]
  const experience = sample?.experience[0]
  const project = sample?.projects[0]
  const customItem = sample?.customData ? Object.values(sample.customData).flat()[0] : undefined
  const skillText = stripPreviewText(sample?.skillContent).slice(0, 96)
  const summaryText = stripPreviewText(sample?.selfEvaluation).slice(0, 86)

  if (!sample) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm">
        <FileText className="h-12 w-12" />
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-md border border-slate-200 bg-white p-3 text-[8px] leading-snug text-slate-700 shadow-sm transition duration-300 group-hover:scale-[1.01]">
      <div className="border-b border-slate-300 pb-2">
        <div className="flex items-start justify-between gap-2">
          {reservePhoto && template.photoPlacement === 'left' ? <PreviewPhotoSlot /> : null}
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-[15px] font-bold leading-none text-slate-950">{sample.basic.name}</h4>
            <p className="mt-1 truncate text-[9px] font-semibold text-slate-700">{sample.basic.title}</p>
          </div>
          <p
            className="mt-1 max-w-[88px] whitespace-pre-line text-right text-[7px] leading-tight text-slate-500"
          >
            {`${sample.basic.phone}\n${sample.basic.email}\n${sample.basic.location}`}
          </p>
          {reservePhoto && template.photoPlacement === 'right' ? <PreviewPhotoSlot /> : null}
        </div>
      </div>

      <div className="mt-2 space-y-2">
        {education ? (
          <PreviewSection title="教育背景">
            <div className="flex justify-between gap-2">
              <span className="truncate font-semibold text-slate-900">{education.school}</span>
              <span className="shrink-0 text-slate-500">{education.startDate}</span>
            </div>
            <p className="truncate text-slate-600">{education.degree} · {education.major}</p>
          </PreviewSection>
        ) : null}

        {experience ? (
          <PreviewSection title={template.sections.find((section) => section.id === 'experience')?.title || '经历'}>
            <div className="flex justify-between gap-2">
              <span className="truncate font-semibold text-slate-900">{experience.company}</span>
              <span className="shrink-0 text-slate-500">{experience.date.split(' - ')[0]}</span>
            </div>
            <p className="truncate text-slate-600">{experience.position}</p>
            <p className="line-clamp-2 text-slate-500">{stripPreviewText(experience.details)}</p>
          </PreviewSection>
        ) : null}

        {customItem ? (
          <PreviewSection title={template.sections.find((section) => section.id.startsWith('custom_'))?.title || customItem.title}>
            <p className="truncate font-semibold text-slate-900">{customItem.title}</p>
            <p className="line-clamp-2 text-slate-500">{stripPreviewText(customItem.description)}</p>
          </PreviewSection>
        ) : null}

        {project ? (
          <PreviewSection title={template.sections.find((section) => section.id === 'projects')?.title || '项目'}>
            <p className="truncate font-semibold text-slate-900">{project.name}</p>
            <p className="truncate text-slate-600">{project.role}</p>
            <p className="line-clamp-2 text-slate-500">{stripPreviewText(project.description)}</p>
          </PreviewSection>
        ) : null}

        <PreviewSection title={template.sections.find((section) => section.id === 'skills')?.title || '能力'}>
          <p className="line-clamp-2 text-slate-500">{skillText}</p>
        </PreviewSection>

        <PreviewSection title={template.sections.find((section) => section.id === 'selfEvaluation')?.title || '总结'}>
          <p className="line-clamp-2 text-slate-500">{summaryText}</p>
        </PreviewSection>
      </div>
    </div>
  )
}

function TemplateResumePreview({ template }: { template: ResumeDirectionTemplate }) {
  if (resolveDirectionTemplateEngine(template) === 'latex') {
    return <RenderedLatexPreview template={template} />
  }

  return <InlineTemplatePreview template={template} />
}

export default function TemplatesPage() {
  const navigate = useNavigate()
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_RESUME_DIRECTION_TEMPLATE_ID)
  const [keyword, setKeyword] = useState('')

  const filteredTemplates = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return RESUME_DIRECTION_TEMPLATES.filter((template) => {
      if (!query) return true
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

  const templateGroups = useMemo<TemplateGroup[]>(
    () => [
      {
        engine: 'latex',
        title: 'LaTeX 模板',
        description: '适合稳定排版、PDF 生成和正式投递场景。',
        templates: filteredTemplates.filter((template) => resolveDirectionTemplateEngine(template) === 'latex'),
      },
      {
        engine: 'html',
        title: 'HTML 模板',
        description: '适合实时预览、浏览器导出和快速在线编辑。',
        templates: filteredTemplates.filter((template) => resolveDirectionTemplateEngine(template) === 'html'),
      },
    ],
    [filteredTemplates],
  )

  const selectedTemplate = useMemo(
    () =>
      filteredTemplates.find((template) => template.id === selectedTemplateId) ||
      RESUME_DIRECTION_TEMPLATES.find((template) => template.id === selectedTemplateId) ||
      filteredTemplates[0] ||
      RESUME_DIRECTION_TEMPLATES[0],
    [selectedTemplateId, filteredTemplates],
  )

  const handleUseTemplate = (templateId: string) => {
    const directionTemplate = RESUME_DIRECTION_TEMPLATES.find((template) => template.id === templateId)
    const engine = directionTemplate ? resolveDirectionTemplateEngine(directionTemplate) : 'latex'
    const workspacePath = engine === 'html' ? '/workspace/html' : '/workspace/latex'
    setCurrentResumeId(null)
    localStorage.removeItem(STORAGE_KEY)
    navigate(`${workspacePath}?directionTemplateId=${encodeURIComponent(templateId)}`, {
      state: { directionTemplateId: templateId },
    })
  }

  return (
    <WorkspaceLayout>
      <div className="h-full min-h-0 overflow-auto bg-slate-50">
        <div className="mx-auto flex min-h-full w-full max-w-[1800px] flex-col px-4 py-6 sm:px-6 2xl:px-8">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 shadow-sm">
                <LayoutTemplate className="h-4 w-4" />
                简历方向模板
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">模板广场</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                选择一个方向模板，新建一份带有对应模块标题、结构顺序和照片位置设置的简历。
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

          <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0">
              {filteredTemplates.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  没有匹配的模板
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  {templateGroups.map((group) => (
                    <div key={group.engine} className="space-y-3">
                      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-slate-950">{group.title}</h2>
                          <p className="mt-1 text-sm text-slate-600">{group.description}</p>
                        </div>
                        <span className="w-fit rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {group.templates.length} 个模板
                        </span>
                      </div>

                      {group.templates.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                          当前搜索没有匹配的 {group.title}
                        </div>
                      ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                          {group.templates.map((template) => {
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
                                <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100 p-3">
                                  <TemplateResumePreview template={template} />
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
                                      <h3 className="text-base font-semibold text-slate-950">{template.name}</h3>
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
                    </div>
                  ))}
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
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedTemplate.category} / {resolveDirectionTemplateEngine(selectedTemplate) === 'html' ? 'HTML' : 'LaTeX'}
                      </p>
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
