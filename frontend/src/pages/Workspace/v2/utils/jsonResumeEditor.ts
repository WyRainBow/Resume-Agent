import type { ResumeData } from '../types'

export type ResumeJsonParseResult =
  | { ok: true; data: ResumeData }
  | { ok: false; error: string }

export function formatResumeJson(data: ResumeData): string {
  return JSON.stringify(data, null, 2)
}

export function parseResumeJsonDraft(draft: string): ResumeJsonParseResult {
  if (!draft.trim()) {
    return { ok: false, error: 'JSON 内容不能为空' }
  }

  try {
    const parsed = JSON.parse(draft)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'JSON 根节点必须是简历对象' }
    }
    return { ok: true, data: parsed as ResumeData }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'JSON 格式不正确',
    }
  }
}
