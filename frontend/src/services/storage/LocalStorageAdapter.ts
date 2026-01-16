import type { Resume } from '@/types/resume'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import type { SavedResume, StorageAdapter } from './StorageAdapter'

const STORAGE_KEY = 'resume_resumes'
const CURRENT_KEY = 'resume_current'

export class LocalStorageAdapter implements StorageAdapter {
  async getAllResumes(): Promise<SavedResume[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
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

  async getResume(id: string): Promise<SavedResume | null> {
    const resumes = await this.getAllResumes()
    return resumes.find(r => r.id === id) || null
  }

  async saveResume(resume: Resume | ResumeData, id?: string): Promise<SavedResume> {
    const resumes = await this.getAllResumes()
    const now = Date.now()
    const resumeName = (resume as any).basic?.name || (resume as any).name || '未命名简历'

    if (id) {
      const index = resumes.findIndex(r => r.id === id)
      if (index >= 0) {
        resumes[index] = {
          ...resumes[index],
          name: resumeName,
          data: resume,
          updatedAt: now
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes))
        return resumes[index]
      }
    }

    const newResume: SavedResume = {
      id: id || `resume_${now}_${Math.random().toString(36).substr(2, 9)}`,
      name: resumeName,
      data: resume,
      createdAt: now,
      updatedAt: now
    }
    resumes.push(newResume)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes))
    this.setCurrentResumeId(newResume.id)
    return newResume
  }

  async deleteResume(id: string): Promise<boolean> {
    const resumes = await this.getAllResumes()
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

  async renameResume(id: string, newName: string): Promise<boolean> {
    const resumes = await this.getAllResumes()
    const index = resumes.findIndex(r => r.id === id)
    if (index >= 0) {
      resumes[index].name = newName
      resumes[index].updatedAt = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes))
      return true
    }
    return false
  }

  async duplicateResume(id: string): Promise<SavedResume | null> {
    const original = await this.getResume(id)
    if (original) {
      const copied = JSON.parse(JSON.stringify(original.data)) as Resume
      copied.name = `${original.name} (副本)`
      return this.saveResume(copied)
    }
    return null
  }
}
