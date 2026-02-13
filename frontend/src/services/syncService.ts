import axios from 'axios'
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import type { SavedResume } from './storage/StorageAdapter'

const STORAGE_KEY = 'resume_resumes'
const TOKEN_KEY = 'auth_token'

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
})

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

function readLocalResumes(): SavedResume[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export async function syncLocalToDatabase(): Promise<SavedResume[]> {
  const localResumes = readLocalResumes()
  if (localResumes.length === 0) {
    return []
  }
  const payload = {
    resumes: localResumes.map(r => ({
      id: r.id,
      name: r.name,
      alias: r.alias,  // 包含备注/别名
      template_type: r.templateType || (r.data as any)?.templateType || 'latex',  // 包含模板类型
      data: r.data,
      created_at: new Date(r.createdAt).toISOString(),
      updated_at: new Date(r.updatedAt).toISOString()
    }))
  }

  const { data } = await apiClient.post('/api/resumes/sync', payload, { headers: getAuthHeaders() })

  const merged: SavedResume[] = Array.isArray(data) ? data.map((item: any) => ({
    id: item.id,
    name: item.name,
    alias: item.alias,  // 解析备注/别名
    templateType: item.template_type || (item.data as any)?.templateType || 'latex',  // 解析模板类型
    data: item.data,
    createdAt: item.created_at ? Date.parse(item.created_at) : Date.now(),
    updatedAt: item.updated_at ? Date.parse(item.updated_at) : Date.now()
  })) : []

  // 更新本地缓存
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  return merged
}
