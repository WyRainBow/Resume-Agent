import { getApiBaseUrl } from '@/lib/runtimeEnv'

export interface JDRecord {
  id: string
  title: string
  company_name?: string | null
  source_type: 'text' | 'url'
  source_url?: string | null
  raw_text: string
  structured_data?: Record<string, any> | null
  is_default: boolean
  fetched_at?: string | null
  last_used_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface JDAnalysisStage {
  stage: string
  label: string
  status: 'pending' | 'in_progress' | 'completed' | 'error'
  message?: string
}

export interface JDPatchBatch {
  patch_id: string
  module_key: string
  module_label: string
  summary: string
  paths: string[]
  before: Record<string, any>
  after: Record<string, any>
  status: 'pending' | 'applied' | 'rejected'
}

export interface LearningPhase {
  phase_name: string
  goal: string
  topics: string[]
  suggested_projects: string[]
  resume_ready_outcomes: string[]
}

export interface JDAnalysisResult {
  id: string
  jd_id: string
  resume_id: string
  match_score: number
  report: {
    structured_jd: Record<string, any>
    requirements: Record<string, any>
    match: {
      match_score: number
      summary: string
      core_gaps: string[]
      priority_updates: string[]
      current_must_have_stack: string[]
      future_stack: string[]
    }
  }
  learning_path: LearningPhase[]
  patch_batches: JDPatchBatch[]
  created_at?: string | null
}

interface CreateJDPayload {
  source_type: 'text' | 'url'
  raw_text?: string
  source_url?: string
  title?: string
  set_as_default?: boolean
  llm_profile?: string | null
}

interface UpdateJDPayload {
  title: string
}

interface JDAnalysisStreamPayload {
  jd_id: string
  resume_id: string
  resume_data: Record<string, any>
  llm_profile?: string | null
}

interface StreamHandlers {
  signal?: AbortSignal
  onStage?: (stage: JDAnalysisStage) => void
  onResult?: (result: JDAnalysisResult) => void
  onError?: (message: string) => void
  onDone?: () => void
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  })
  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `${response.status} ${response.statusText}`)
  }
  return await response.json()
}

function parseSSEBlock(block: string) {
  const lines = block.split('\n')
  let eventType = ''
  const dataLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:')) eventType = line.slice(6).trim()
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (!dataLines.length) return null
  const rawData = dataLines.join('\n').trim()
  if (!rawData) return null
  const parsed = JSON.parse(rawData)
  return {
    type: String(parsed?.type || eventType || ''),
    data: parsed?.data ?? parsed,
  }
}

export async function listJDs(): Promise<JDRecord[]> {
  const data = await requestJson<{ items: JDRecord[] }>('/api/jds')
  return data.items || []
}

export async function createJD(payload: CreateJDPayload): Promise<JDRecord> {
  return await requestJson<JDRecord>('/api/jds', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateJD(
  jdId: string,
  payload: UpdateJDPayload,
): Promise<JDRecord> {
  return await requestJson<JDRecord>(`/api/jds/${jdId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function setDefaultJD(jdId: string): Promise<JDRecord> {
  return await requestJson<JDRecord>(`/api/jds/${jdId}/default`, {
    method: 'POST',
  })
}

export async function getLatestJDAnalysis(
  jdId: string,
  resumeId: string,
): Promise<JDAnalysisResult | null> {
  const data = await requestJson<{ item: JDAnalysisResult | null }>(
    `/api/jds/${jdId}/latest-analysis?resume_id=${encodeURIComponent(resumeId)}`,
    { method: 'GET' },
  )
  return data.item
}

export async function streamJDAnalysis(
  payload: JDAnalysisStreamPayload,
  handlers: StreamHandlers,
): Promise<void> {
  let doneCalled = false
  const emitDone = () => {
    if (doneCalled) return
    doneCalled = true
    handlers.onDone?.()
  }
  const response = await fetch(`${getApiBaseUrl()}/api/jd-analyses/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
    signal: handlers.signal,
  })
  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `${response.status} ${response.statusText}`)
  }
  if (!response.body) throw new Error('JD analysis SSE response has no body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() || ''

    for (const block of blocks) {
      const event = parseSSEBlock(block)
      if (!event) continue
      if (event.type === 'jd_analysis_stage') handlers.onStage?.(event.data)
      if (event.type === 'jd_analysis_result') handlers.onResult?.(event.data)
      if (event.type === 'jd_analysis_error') handlers.onError?.(String(event.data?.message || 'JD analysis failed'))
      if (event.type === 'done') emitDone()
    }
  }

  if (buffer.trim()) {
    const event = parseSSEBlock(buffer)
    if (event?.type === 'done') emitDone()
  }
  emitDone()
}
