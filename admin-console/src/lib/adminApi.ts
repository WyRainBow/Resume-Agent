import { http } from './http'
import type { APIErrorLog, APIRequestLog, AdminUser, Member, TraceSpan } from '../types/admin'

export async function login(username: string, password: string) {
  const { data } = await http.post('/api/auth/login', { username, password })
  return data as { access_token: string }
}

export async function getOverview() {
  const { data } = await http.get('/api/admin/overview')
  return data as {
    total_users: number
    total_members: number
    requests_24h: number
    errors_24h: number
    error_rate_24h: number
    avg_latency_ms_24h: number
  }
}

export async function getUsers(params: Record<string, string | number | undefined>) {
  const { data } = await http.get('/api/admin/users', { params })
  return data as { items: AdminUser[]; total: number; page: number; page_size: number }
}

export async function updateUserRole(userId: number, role: string) {
  const { data } = await http.patch(`/api/admin/users/${userId}/role`, { role })
  return data as AdminUser
}

export async function updateUserQuota(userId: number, api_quota: number | null) {
  const { data } = await http.patch(`/api/admin/users/${userId}/quota`, { api_quota })
  return data as AdminUser
}

export async function getMembers(params: Record<string, string | number | undefined>) {
  const { data } = await http.get('/api/admin/members', { params })
  return data as { items: Member[]; total: number; page: number; page_size: number }
}

export type MemberUpsertPayload = {
  user_id: number
  position?: string
  team?: string
  status?: string
  user_role?: 'admin' | 'member' | 'user'
}

export async function createMember(payload: MemberUpsertPayload) {
  const { data } = await http.post('/api/admin/members', payload)
  return data as Member
}

export async function updateMember(memberId: number, payload: MemberUpsertPayload) {
  const { data } = await http.patch(`/api/admin/members/${memberId}`, payload)
  return data as Member
}

export async function deleteMember(memberId: number) {
  const { data } = await http.delete(`/api/admin/members/${memberId}`)
  return data as { success: boolean }
}

export async function getRequestLogs(params: Record<string, string | number | undefined>) {
  const { data } = await http.get('/api/admin/logs/requests', { params })
  return data as { items: APIRequestLog[]; total: number; page: number; page_size: number }
}

export async function getErrorLogs(params: Record<string, string | number | undefined>) {
  const { data } = await http.get('/api/admin/logs/errors', { params })
  return data as { items: APIErrorLog[]; total: number; page: number; page_size: number }
}

export async function getTraces(params: Record<string, string | number | undefined>) {
  const { data } = await http.get('/api/admin/traces', { params })
  return data as {
    items: Array<{
      trace_id: string
      latest_at?: string
      request_count: number
      error_count: number
      avg_latency_ms: number
    }>
    total: number
    page: number
    page_size: number
  }
}

export async function getTraceDetail(traceId: string) {
  const { data } = await http.get(`/api/admin/traces/${traceId}`)
  return data as { trace_id: string; spans: TraceSpan[] }
}

export async function getPermissionAudits(params: Record<string, string | number | undefined>) {
  const { data } = await http.get('/api/admin/permissions/audits', { params })
  return data as {
    items: Array<{
      id: number
      operator_user_id?: number
      target_user_id?: number
      operator_username?: string
      target_username?: string
      from_role?: string
      to_role?: string
      action: string
      created_at?: string
    }>
    total: number
    page: number
    page_size: number
  }
}

export async function getRuntimeStatus(params?: { service?: string }) {
  const { data } = await http.get('/api/admin/runtime/status', { params })
  return data as any
}

export async function getRuntimeLogs(params?: { service?: string; stream?: 'out' | 'error'; lines?: number }) {
  const { data } = await http.get('/api/admin/runtime/logs', { params })
  return data as {
    service: string
    stream: 'out' | 'error'
    lines: number
    path: string
    content: string
  }
}

export async function restartRuntimeService(payload?: { service?: string }) {
  const { data } = await http.post('/api/admin/runtime/actions/restart', payload || {})
  return data as { ok: boolean; service: string; result: any }
}

export async function execRuntimeCommand(payload: { command: string; timeout_sec?: number }) {
  const { data } = await http.post('/api/admin/runtime/actions/exec', payload)
  return data as { exit_code: number; stdout: string; stderr: string; duration_ms: number; argv?: string[] }
}
