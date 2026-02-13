import axios from 'axios'
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import type { Resume } from '@/types/resume'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import type { SavedResume, StorageAdapter } from './StorageAdapter'

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
})

const CURRENT_KEY = 'resume_current'
const TOKEN_KEY = 'auth_token'

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
    }
    return Promise.reject(error)
  }
)

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()
  return config
})

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function toSavedResume(payload: any): SavedResume {
  // 尝试从 payload 或 data 中获取 templateType
  const templateType = payload.template_type || payload.data?.templateType || 'latex'
  return {
    id: payload.id,
    name: payload.name,
    alias: payload.alias || undefined,  // 确保 alias 被正确解析
    templateType,
    data: payload.data,
    createdAt: payload.created_at ? Date.parse(payload.created_at) : Date.now(),
    updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : Date.now()
  }
}

export class DatabaseAdapter implements StorageAdapter {
  async getAllResumes(): Promise<SavedResume[]> {
    const { data } = await apiClient.get('/api/resumes', { headers: getAuthHeaders() })
    return Array.isArray(data) ? data.map(toSavedResume) : []
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
    try {
      const { data } = await apiClient.get(`/api/resumes/${id}`, { headers: getAuthHeaders() })
      return toSavedResume(data)
    } catch {
      return null
    }
  }

  async saveResume(resume: Resume | ResumeData, id?: string): Promise<SavedResume> {
    const name = (resume as any).basic?.name || (resume as any).name || '未命名简历'
    // 从 ResumeData 中提取 templateType，默认为 'latex'
    const templateType = (resume as ResumeData).templateType || 'latex'
    try {
      if (id) {
        try {
          const { data } = await apiClient.put(
            `/api/resumes/${id}`,
            { id, name, template_type: templateType, data: resume },
            { headers: getAuthHeaders() }
          )
          return toSavedResume(data)
        } catch (error: any) {
          const status = error?.response?.status
          if (status !== 404) {
            throw error
          }
          // 如果不存在则创建（允许携带自定义 id）
          const { data } = await apiClient.post(
            '/api/resumes',
            { id, name, template_type: templateType, data: resume },
            { headers: getAuthHeaders() }
          )
          this.setCurrentResumeId(data.id)
          return toSavedResume(data)
        }
      }

      const { data } = await apiClient.post(
        '/api/resumes',
        { name, template_type: templateType, data: resume },
        { headers: getAuthHeaders() }
      )
      this.setCurrentResumeId(data.id)
      return toSavedResume(data)
    } catch (error: any) {
      console.error('保存到数据库失败:', error)
      // 如果保存失败，抛出错误以便上层处理
      throw new Error(error?.response?.data?.detail || error?.message || '保存失败')
    }
  }

  async deleteResume(id: string): Promise<boolean> {
    try {
      await apiClient.delete(`/api/resumes/${id}`, { headers: getAuthHeaders() })
      if (this.getCurrentResumeId() === id) {
        this.setCurrentResumeId(null)
      }
      return true
    } catch {
      return false
    }
  }

  async renameResume(id: string, newName: string): Promise<boolean> {
    const resume = await this.getResume(id)
    if (!resume) return false
    await apiClient.put(
      `/api/resumes/${id}`,
      { id, name: newName, data: resume.data },
      { headers: getAuthHeaders() }
    )
    return true
  }

  async duplicateResume(id: string): Promise<SavedResume | null> {
    const original = await this.getResume(id)
    if (!original) return null
    const copied = JSON.parse(JSON.stringify(original.data)) as Resume
    copied.name = `${original.name} (副本)`
    return this.saveResume(copied)
  }

  async updateResumeAlias(id: string, alias: string): Promise<boolean> {
    const resume = await this.getResume(id)
    if (!resume) return false
    try {
      await apiClient.put(
        `/api/resumes/${id}`,
        { id, name: resume.name, alias, data: resume.data },
        { headers: getAuthHeaders() }
      )
      return true
    } catch {
      return false
    }
  }

  async updateResumePinned(id: string, pinned: boolean): Promise<boolean> {
    // 置顶状态仅存储在本地，不同步到数据库
    // 通过 LocalStorageAdapter 实现
    return false
  }
}
