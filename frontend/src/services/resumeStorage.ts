import type { Resume } from '../types/resume'
import type { ResumeData } from '../pages/Workspace/v2/types'

const STORAGE_KEY = 'resume_resumes'
const CURRENT_KEY = 'resume_current'

export interface SavedResume {
  id: string
  name: string
  data: Resume | ResumeData  // 支持新旧两种格式
  createdAt: number
  updatedAt: number
}

/**
 * 获取所有保存的简历
 */
export function getAllResumes(): SavedResume[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * 获取当前编辑的简历ID
 */
export function getCurrentResumeId(): string | null {
  return localStorage.getItem(CURRENT_KEY)
}

/**
 * 设置当前编辑的简历ID
 */
export function setCurrentResumeId(id: string | null) {
  if (id) {
    localStorage.setItem(CURRENT_KEY, id)
  } else {
    localStorage.removeItem(CURRENT_KEY)
  }
}

/**
 * 获取指定简历
 */
export function getResume(id: string): SavedResume | null {
  const resumes = getAllResumes()
  return resumes.find(r => r.id === id) || null
}

/**
 * 保存简历（新建或更新）
 * 支持 Resume 和 ResumeData 两种格式
 */
export function saveResume(resume: Resume | ResumeData, id?: string): SavedResume {
  const resumes = getAllResumes()
  const now = Date.now()
  
  // 从 resume 中提取名称（支持新旧两种格式）
  const resumeName = (resume as any).basic?.name || (resume as any).name || '未命名简历'
  
  if (id) {
    // 更新现有简历
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
  
  // 新建简历
  const newResume: SavedResume = {
    id: `resume_${now}_${Math.random().toString(36).substr(2, 9)}`,
    name: resumeName,
    data: resume,
    createdAt: now,
    updatedAt: now
  }
  resumes.push(newResume)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes))
  setCurrentResumeId(newResume.id)
  return newResume
}

/**
 * 删除简历
 */
export function deleteResume(id: string): boolean {
  const resumes = getAllResumes()
  const filtered = resumes.filter(r => r.id !== id)
  if (filtered.length !== resumes.length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    if (getCurrentResumeId() === id) {
      setCurrentResumeId(filtered.length > 0 ? filtered[0].id : null)
    }
    return true
  }
  return false
}

/**
 * 重命名简历
 */
export function renameResume(id: string, newName: string): boolean {
  const resumes = getAllResumes()
  const index = resumes.findIndex(r => r.id === id)
  if (index >= 0) {
    resumes[index].name = newName
    resumes[index].updatedAt = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes))
    return true
  }
  return false
}

/**
 * 复制简历
 */
export function duplicateResume(id: string): SavedResume | null {
  const original = getResume(id)
  if (original) {
    const copied = JSON.parse(JSON.stringify(original.data)) as Resume
    copied.name = `${original.name} (副本)`
    return saveResume(copied)
  }
  return null
}
