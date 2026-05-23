import {
  DEFAULT_HTML_TEMPLATE_ID,
  normalizeHtmlTemplateId,
  type ResumeTemplate,
} from '@/services/resumeTemplates'

export type HtmlResumeTemplate = ResumeTemplate & { type: 'html' }

export const HTML_RESUME_TEMPLATES: HtmlResumeTemplate[] = [
  {
    id: DEFAULT_HTML_TEMPLATE_ID,
    name: '经典 HTML',
    description: '实时预览、浏览器导出 PDF 的单栏 HTML 简历模板。',
    type: 'html',
    category: '通用',
    tags: ['实时预览', '浏览器导出', '单栏'],
    previewUrl: '/product-preview.png',
  },
]

export function listHtmlTemplates(): HtmlResumeTemplate[] {
  return HTML_RESUME_TEMPLATES
}

export function resolveHtmlTemplate(templateId?: string | null): HtmlResumeTemplate {
  const normalizedTemplateId = normalizeHtmlTemplateId(templateId)
  return (
    HTML_RESUME_TEMPLATES.find((template) => template.id === normalizedTemplateId) ||
    HTML_RESUME_TEMPLATES[0]
  )
}

export { DEFAULT_HTML_TEMPLATE_ID, normalizeHtmlTemplateId }
