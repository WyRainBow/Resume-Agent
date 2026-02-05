import type { Resume } from '@/types/resume'
import type { ResumeData } from '@/pages/Workspace/v2/types'

export interface SavedResume {
  id: string
  name: string
  alias?: string  // 备注/别名，用于标识简历用途（如"投递腾讯"）
  data: Resume | ResumeData
  createdAt: number
  updatedAt: number
}

export interface StorageAdapter {
  getAllResumes(): Promise<SavedResume[]>
  getCurrentResumeId(): string | null
  setCurrentResumeId(id: string | null): void
  getResume(id: string): Promise<SavedResume | null>
  saveResume(resume: Resume | ResumeData, id?: string): Promise<SavedResume>
  deleteResume(id: string): Promise<boolean>
  renameResume(id: string, newName: string): Promise<boolean>
  duplicateResume(id: string): Promise<SavedResume | null>
  updateResumeAlias(id: string, alias: string): Promise<boolean>
}
