/**
 * 投递进展表 API
 */
import axios from 'axios'

const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || ''
const API_BASE = rawApiBase
  ? (rawApiBase.startsWith('http') ? rawApiBase : `https://${rawApiBase}`)
  : (import.meta.env.PROD ? '' : 'http://localhost:9000')

const apiClient = axios.create({ baseURL: API_BASE })
const TOKEN_KEY = 'auth_token'

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface ApplicationProgressEntry {
  id: string
  user_id: number
  sort_order: number
  company?: string | null
  application_link?: string | null
  industry?: string | null
  tags?: string[] | null
  position?: string | null
  location?: string | null
  progress?: string | null
  progress_status?: string | null
  progress_time?: string | null
  notes?: string | null
  application_date?: string | null
  referral_code?: string | null
  link2?: string | null
  resume_id?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ApplicationProgressPayload {
  company?: string | null
  application_link?: string | null
  industry?: string | null
  tags?: string[] | null
  position?: string | null
  location?: string | null
  progress?: string | null
  progress_status?: string | null
  progress_time?: string | null
  notes?: string | null
  application_date?: string | null
  referral_code?: string | null
  link2?: string | null
  resume_id?: string | null
  sort_order?: number | null
}

export interface ApplicationProgressAIParsePayload {
  company?: string | null
  application_link?: string | null
  industry?: string | null
  position?: string | null
  location?: string | null
  progress?: string | null
  notes?: string | null
  application_date?: string | null
  referral_code?: string | null
}

export async function listApplicationProgress(): Promise<ApplicationProgressEntry[]> {
  const { data } = await apiClient.get<ApplicationProgressEntry[]>(
    '/api/application-progress',
    { headers: getAuthHeaders() }
  )
  return data
}

export async function createApplicationProgress(
  payload: ApplicationProgressPayload
): Promise<ApplicationProgressEntry> {
  const { data } = await apiClient.post<ApplicationProgressEntry>(
    '/api/application-progress',
    payload,
    { headers: getAuthHeaders() }
  )
  return data
}

export async function updateApplicationProgress(
  id: string,
  payload: ApplicationProgressPayload
): Promise<ApplicationProgressEntry> {
  const { data } = await apiClient.patch<ApplicationProgressEntry>(
    `/api/application-progress/${id}`,
    payload,
    { headers: getAuthHeaders() }
  )
  return data
}

export async function deleteApplicationProgress(id: string): Promise<void> {
  await apiClient.delete(`/api/application-progress/${id}`, {
    headers: getAuthHeaders(),
  })
}

export async function reorderApplicationProgress(order: string[]): Promise<void> {
  await apiClient.patch(
    '/api/application-progress/reorder',
    { order },
    { headers: getAuthHeaders() }
  )
}

export async function aiParseApplicationProgress(
  text?: string,
  provider?: string,
  model?: string,
  imageDataUrl?: string
): Promise<ApplicationProgressAIParsePayload> {
  const { data } = await apiClient.post<ApplicationProgressAIParsePayload>(
    '/api/application-progress/ai-parse',
    { text, provider, model, image_data_url: imageDataUrl },
    { headers: getAuthHeaders() }
  )
  return data
}
