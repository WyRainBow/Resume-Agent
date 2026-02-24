import axios from 'axios'
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import type { ApplicationProgressEntry } from './applicationProgressApi'

const apiClient = axios.create({ baseURL: getApiBaseUrl() })
const TOKEN_KEY = 'auth_token'

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()
  return config
})

type DashboardSummaryMetrics = {
  resume_query_ms: number
  progress_query_ms: number
  total_query_ms: number
}

type DashboardSummaryResponse = {
  resume_count: number
  entries: Array<Pick<ApplicationProgressEntry, 'progress' | 'application_date'>>
  interview_count?: number
  interview_count_this_week?: number
  metrics: DashboardSummaryMetrics
}

export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  const { data } = await apiClient.get<DashboardSummaryResponse>('/api/dashboard/summary', {
    headers: getAuthHeaders(),
  })
  return data
}
