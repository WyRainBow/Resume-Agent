import type { Resume } from '@/types/resume'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import type { SavedResume, StorageAdapter, StorageOperationContext } from './StorageAdapter'
import { stripPhotoFromResumeData, stripPhotoFromSavedResume } from './sanitizeResume'

const STORAGE_KEY = 'resume_resumes'
const CURRENT_KEY = 'resume_current'

export class LocalStorageAdapter implements StorageAdapter {
  private readAllResumes(): SavedResume[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      const parsed = data ? (JSON.parse(data) as SavedResume[]) : []
      const sanitized = parsed.map(stripPhotoFromSavedResume)
      if (data && JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
      }
      return sanitized
    } catch {
      return []
    }
  }

  async getAllResumes(_context?: StorageOperationContext): Promise<SavedResume[]> {
    return this.readAllResumes()
  }

  getCurrentResumeId(): string | null {
    return localStorage.getItem(CURRENT_KEY)
  }

  setCurrentResumeId(id: string | null): void {
    if (id) {
      localStorage.setItem(CURRENT_KEY, id)
    } else {
      localStorage.removeItem(CURRENT_KEY)
    }
  }

  async getResume(id: string, _context?: StorageOperationContext): Promise<SavedResume | null> {
    const resumes = this.readAllResumes()
    return resumes.find(r => r.id === id) || null
  }

  async saveResume(
    resume: Resume | ResumeData,
    id?: string,
    _context?: StorageOperationContext,
  ): Promise<SavedResume> {
    const resumes = this.readAllResumes()
    const now = Date.now()
    const resumeName = (resume as any).basic?.name || (resume as any).name || '未命名简历'
    // 从 ResumeData 中提取 templateType，默认为 'latex'
    const templateType = (resume as ResumeData).templateType || 'latex'
    const sanitizedResume = stripPhotoFromResumeData(resume)

    if (id) {
      const index = resumes.findIndex(r => r.id === id)
      if (index >= 0) {
        resumes[index] = {
          ...resumes[index],
          name: resumeName,
          templateType,
          data: sanitizedResume,
          updatedAt: now
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes))
        return resumes[index]
      }
    }

    const newResume: SavedResume = {
      id: id || `resume_${now}_${Math.random().toString(36).substr(2, 9)}`,
      name: resumeName,
      templateType,
      data: sanitizedResume,
      createdAt: now,
      updatedAt: now
    }
    resumes.push(newResume)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes))
    this.setCurrentResumeId(newResume.id)
    return newResume
  }

  async deleteResume(id: string, _context?: StorageOperationContext): Promise<boolean> {
    const resumes = this.readAllResumes()
    const filtered = resumes.filter(r => r.id !== id)
    if (filtered.length !== resumes.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      if (this.getCurrentResumeId() === id) {
        this.setCurrentResumeId(filtered.length > 0 ? filtered[0].id : null)
      }
      return true
    }
    return false
  }

  async renameResume(
    id: string,
    newName: string,
    _context?: StorageOperationContext,
  ): Promise<boolean> {
    const resumes = this.readAllResumes()
    const index = resumes.findIndex(r => r.id === id)
    if (index >= 0) {
      resumes[index].name = newName
      resumes[index].updatedAt = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes))
      return true
    }
    return false
  }

  async duplicateResume(id: string, context?: StorageOperationContext): Promise<SavedResume | null> {
    const original = this.readAllResumes().find(r => r.id === id) || null
    if (original) {
      const copied = JSON.parse(JSON.stringify(original.data)) as Resume | ResumeData
      const copiedName = `${original.name} (副本)`
      if ('basic' in copied && copied.basic) copied.basic.name = copiedName
      else (copied as Resume).name = copiedName
      return this.saveResume(copied, undefined, context)
    }
    return null
  }

  async updateResumeAlias(
    id: string,
    alias: string,
    _context?: StorageOperationContext,
  ): Promise<boolean> {
    const resumes = this.readAllResumes()
    const index = resumes.findIndex(r => r.id === id)
    if (index >= 0) {
      resumes[index].alias = alias
      resumes[index].updatedAt = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes))
      return true
    }
    return false
  }

  async updateResumePinned(
    id: string,
    pinned: boolean,
    _context?: StorageOperationContext,
  ): Promise<boolean> {
    const resumes = this.readAllResumes()
    const index = resumes.findIndex(r => r.id === id)
    if (index >= 0) {
      resumes[index].pinned = pinned
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes))
      return true
    }
    return false
  }

  clearAllResumes(): void {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(CURRENT_KEY)
  }
}
