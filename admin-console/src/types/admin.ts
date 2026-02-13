export type Role = 'admin' | 'member' | 'user'

export type AdminUser = {
  id: number
  username: string
  email?: string
  role: Role
  last_login_ip?: string
  api_quota?: number | null
  created_at?: string
  updated_at?: string
}

export type Member = {
  id: number
  name: string
  username?: string
  position?: string
  team?: string
  status: string
  user_id?: number | null
  user_role?: Role
  created_at?: string
  updated_at?: string
}

export type APIRequestLog = {
  id: number
  trace_id: string
  request_id: string
  method: string
  path: string
  status_code: number
  latency_ms: number
  user_id?: number
  ip?: string
  created_at?: string
}

export type APIErrorLog = {
  id: number
  request_log_id?: number
  trace_id: string
  error_type?: string
  error_message: string
  service?: string
  created_at?: string
}

export type TraceSpan = {
  span_id: string
  parent_span_id?: string | null
  span_name: string
  start_time: string
  end_time: string
  duration_ms: number
  status: string
  tags?: Record<string, unknown>
}
