import axios from 'axios'
import type { SavedResume } from './storage/StorageAdapter'

const STORAGE_KEY = 'resume_resumes'
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

// 处理 API_BASE，确保有协议前缀
const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || ''
let API_BASE = ''
if (rawApiBase) {
  API_BASE = rawApiBase.startsWith('http') ? rawApiBase : `https://${rawApiBase}`
} else {
  if (import.meta.env.PROD) {
    API_BASE = ''
  } else {
    API_BASE = 'http://localhost:9000'
  }
}

const apiClient = axios.create({
  baseURL: API_BASE
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
  const payload = {
    resumes: localResumes.map(r => ({
      id: r.id,
      name: r.name,
      data: r.data,
      created_at: new Date(r.createdAt).toISOString(),
      updated_at: new Date(r.updatedAt).toISOString()
    }))
  }

  const { data } = await apiClient.post('/api/resumes/sync', payload, { headers: getAuthHeaders() })

  const merged: SavedResume[] = Array.isArray(data) ? data.map((item: any) => ({
    id: item.id,
    name: item.name,
    data: item.data,
    createdAt: item.created_at ? Date.parse(item.created_at) : Date.now(),
    updatedAt: item.updated_at ? Date.parse(item.updated_at) : Date.now()
  })) : []

  // 更新本地缓存
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  return merged
}
