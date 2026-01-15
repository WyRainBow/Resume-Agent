import type { Resume } from '@/types/resume'
import type { ResumeData } from '@/pages/Workspace/v2/types'

export interface SavedResume {
  id: string
  name: string
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
}
