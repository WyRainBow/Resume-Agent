import axios from 'axios'
import { getApiBaseUrl } from '@/lib/runtimeEnv'

export const DEFAULT_LATEX_TEMPLATE_ID = 'classic'

export type ResumeTemplateType = 'latex'

export interface ResumeTemplate {
  id: string
  name: string
  description: string
  type: ResumeTemplateType
  category: string
  tags: string[]
  previewUrl: string | null
}

interface ResumeTemplateListResponse {
  data: ResumeTemplate[]
}

export function normalizeLatexTemplateId(templateId?: string | null): string {
  if (!templateId || templateId === 'default') {
    return DEFAULT_LATEX_TEMPLATE_ID
  }
  return templateId
}

function resolveTemplatePreviewUrl(previewUrl?: string | null): string | null {
  if (!previewUrl) return null
  if (/^https?:\/\//i.test(previewUrl)) return previewUrl
  return `${getApiBaseUrl()}${previewUrl.startsWith('/') ? previewUrl : `/${previewUrl}`}`
}

export async function listResumeTemplates(type: ResumeTemplateType = 'latex'): Promise<ResumeTemplate[]> {
  const url = `${getApiBaseUrl()}/api/resume-templates`
  const { data } = await axios.get<ResumeTemplateListResponse>(url, { params: { type } })
  return data.data.map((template) => ({
    ...template,
    id: normalizeLatexTemplateId(template.id),
    previewUrl: resolveTemplatePreviewUrl(template.previewUrl),
  }))
}
