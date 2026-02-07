import type { Resume } from '../types/resume'
import type { ResumeData } from '../pages/Workspace/v2/types'
import type { SavedResume } from './storage/StorageAdapter'
import { LocalStorageAdapter } from './storage/LocalStorageAdapter'
import { DatabaseAdapter } from './storage/DatabaseAdapter'

const localAdapter = new LocalStorageAdapter()
const databaseAdapter = new DatabaseAdapter()

function isAuthenticated() {
  return Boolean(localStorage.getItem('auth_token'))
}

function getAdapter() {
  return isAuthenticated() ? databaseAdapter : localAdapter
}

async function syncLocalCache(resumes: SavedResume[]) {
  // 用本地存储做缓存
  const existing = await localAdapter.getAllResumes()
  const merged = new Map<string, SavedResume>()

  for (const item of existing) {
    merged.set(item.id, item)
  }
  for (const item of resumes) {
    merged.set(item.id, item)
  }

  const list = Array.from(merged.values())
  try {
    localStorage.setItem('resume_resumes', JSON.stringify(list))
  } catch {
    // ignore
  }
}

export { SavedResume }

/**
 * 获取所有保存的简历
 */
export async function getAllResumes(): Promise<SavedResume[]> {
  const adapter = getAdapter()
  const list = await adapter.getAllResumes()
  if (isAuthenticated()) {
    await syncLocalCache(list)
  }
  return list
}

/**
 * 获取当前编辑的简历ID
 */
export function getCurrentResumeId(): string | null {
  return localAdapter.getCurrentResumeId()
}

/**
 * 设置当前编辑的简历ID
 */
export function setCurrentResumeId(id: string | null) {
  localAdapter.setCurrentResumeId(id)
}

/**
 * 获取指定简历
 */
export async function getResume(id: string): Promise<SavedResume | null> {
  const adapter = getAdapter()
  const resume = await adapter.getResume(id)
  if (resume && isAuthenticated()) {
    await syncLocalCache([resume])
  }
  return resume
}

/**
 * 保存简历（新建或更新）
 * 支持 Resume 和 ResumeData 两种格式
 */
export async function saveResume(resume: Resume | ResumeData, id?: string): Promise<SavedResume> {
  const adapter = getAdapter()
  const saved = await adapter.saveResume(resume, id)

  if (isAuthenticated()) {
    await localAdapter.saveResume(resume, saved.id)
  }

  return saved
}

/**
 * 删除简历
 */
export async function deleteResume(id: string): Promise<boolean> {
  const adapter = getAdapter()
  const result = await adapter.deleteResume(id)
  if (isAuthenticated()) {
    await localAdapter.deleteResume(id)
  }
  return result
}

/**
 * 重命名简历
 */
export async function renameResume(id: string, newName: string): Promise<boolean> {
  const adapter = getAdapter()
  const result = await adapter.renameResume(id, newName)
  if (isAuthenticated()) {
    await localAdapter.renameResume(id, newName)
  }
  return result
}

/**
 * 复制简历
 */
export async function duplicateResume(id: string): Promise<SavedResume | null> {
  const adapter = getAdapter()
  const result = await adapter.duplicateResume(id)
  if (result && isAuthenticated()) {
    await localAdapter.saveResume(result.data, result.id)
  }
  return result
}

/**
 * 更新简历备注/别名
 */
export async function updateResumeAlias(id: string, alias: string): Promise<boolean> {
  const adapter = getAdapter()
  const result = await adapter.updateResumeAlias(id, alias)
  if (isAuthenticated()) {
    await localAdapter.updateResumeAlias(id, alias)
  }
  return result
}

/**
 * 更新简历置顶状态（仅本地存储）
 */
export async function updateResumePinned(id: string, pinned: boolean): Promise<boolean> {
  return await localAdapter.updateResumePinned(id, pinned)
}
