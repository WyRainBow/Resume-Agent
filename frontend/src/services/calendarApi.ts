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

export type CalendarView = 'day' | 'week' | 'month'

export interface CalendarEvent {
  id: string
  user_id: number
  title: string
  starts_at: string
  ends_at: string
  is_all_day: boolean
  location?: string | null
  notes?: string | null
  color?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface CalendarEventPayload {
  title: string
  starts_at: string
  ends_at: string
  is_all_day?: boolean
  location?: string | null
  notes?: string | null
  color?: string | null
}

export async function listCalendarEvents(start: string, end: string): Promise<CalendarEvent[]> {
  const { data } = await apiClient.get<CalendarEvent[]>('/api/calendar/events', {
    params: { start, end },
    headers: getAuthHeaders(),
  })
  return data
}

export async function createCalendarEvent(payload: CalendarEventPayload): Promise<CalendarEvent> {
  const { data } = await apiClient.post<CalendarEvent>('/api/calendar/events', payload, {
    headers: getAuthHeaders(),
  })
  return data
}

export async function updateCalendarEvent(id: string, payload: Partial<CalendarEventPayload>): Promise<CalendarEvent> {
  const { data } = await apiClient.patch<CalendarEvent>(`/api/calendar/events/${id}`, payload, {
    headers: getAuthHeaders(),
  })
  return data
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiClient.delete(`/api/calendar/events/${id}`, {
    headers: getAuthHeaders(),
  })
}
