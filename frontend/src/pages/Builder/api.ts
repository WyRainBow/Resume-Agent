/**
 * Builder 模块的配置类 API(Settings 页消费)。
 * 后端端点:backend/routes/config.py(/config/keys 为 admin 专属)与 routes/health.py。
 */
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import { getAuthHeaders } from '@/lib/authHeaders'

export type ProviderId = 'deepseek' | 'zhipu' | 'doubao'

export interface KeyStatus {
  configured: boolean
  preview: string
}

export type KeysStatus = Record<ProviderId, KeyStatus>

export interface TestKeyResult {
  configured: boolean
  ok?: boolean
  error?: string
}

export type TestKeysResult = Record<ProviderId, TestKeyResult>

export interface AiConfig {
  defaultProvider: string
  defaultModel: string
  models: Record<string, string>
  supportedModels: Record<string, string[]> | string[]
}

export interface SaveKeysPayload {
  deepseek_key?: string
  zhipu_key?: string
  doubao_key?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // 非 JSON 错误体,保留状态码信息
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export function getKeysStatus(): Promise<KeysStatus> {
  return request<KeysStatus>('/api/config/keys')
}

export function saveKeys(payload: SaveKeysPayload): Promise<{ success: boolean; message: string }> {
  return request('/api/config/keys', { method: 'POST', body: JSON.stringify(payload) })
}

export function testKeys(): Promise<TestKeysResult> {
  return request<TestKeysResult>('/api/ai/test-keys')
}

export function getAiConfig(): Promise<AiConfig> {
  return request<AiConfig>('/api/ai/config')
}

export interface ConfigStats {
  db_ok: boolean
  resumes: number
  users: number
  deepseek_base_url: string
}

export function getConfigStats(): Promise<ConfigStats> {
  return request<ConfigStats>('/api/config/stats')
}

export function deleteKey(provider: ProviderId): Promise<{ success: boolean; message: string }> {
  return request(`/api/config/keys/${provider}`, { method: 'DELETE' })
}

export function clearAllKeys(): Promise<{ success: boolean; message: string }> {
  return request('/api/config/keys', { method: 'DELETE' })
}

export async function pingBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/health`)
    return res.ok
  } catch {
    return false
  }
}
