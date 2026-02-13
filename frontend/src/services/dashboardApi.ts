import axios from 'axios'
import type { ApplicationProgressEntry } from './applicationProgressApi'

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

type DashboardSummaryMetrics = {
  resume_query_ms: number
  progress_query_ms: number
  total_query_ms: number
}

type DashboardSummaryResponse = {
  resume_count: number
  entries: Array<Pick<ApplicationProgressEntry, 'progress' | 'application_date'>>
  metrics: DashboardSummaryMetrics
}

export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  const { data } = await apiClient.get<DashboardSummaryResponse>('/api/dashboard/summary', {
    headers: getAuthHeaders(),
  })
  return data
}

