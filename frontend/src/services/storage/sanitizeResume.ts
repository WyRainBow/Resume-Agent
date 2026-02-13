import type { Resume } from '@/types/resume'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import type { SavedResume } from './StorageAdapter'

type ResumeLike = Resume | ResumeData

function clone<T>(value: T): T {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value)
    }
  } catch {
    // ignore and fallback to JSON clone
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    // 最后兜底：返回原对象，避免上层读取简历列表失败
    return value
  }
}

export function stripPhotoFromResumeData(resume: ResumeLike): ResumeLike {
  const sanitized = clone(resume) as any
  if (sanitized?.basic && typeof sanitized.basic === 'object') {
    delete sanitized.basic.photo
  }
  return sanitized as ResumeLike
}

export function stripPhotoFromSavedResume(item: SavedResume): SavedResume {
  return {
    ...item,
    data: stripPhotoFromResumeData(item.data),
  }
}
