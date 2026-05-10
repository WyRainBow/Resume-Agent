import axios from 'axios'
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import type { LeetCodeDraft, LeetCodeProblem, ProblemTestCase, RunResponse, SubmissionRecord } from './types'

const apiBase = () => `${getApiBaseUrl()}/api/leetcode`

/** 兼容驼峰或蛇形命名的 programRun，避免网关/中间层改写字段后与前端不一致 */
function normalizeRunResponse(data: unknown): RunResponse {
  const row = data as Record<string, unknown>
  const pr = row.programRun ?? row.program_run
  if (pr != null && typeof pr === 'object') {
    const { program_run: _, ...rest } = row
    return { ...rest, programRun: pr as RunResponse['programRun'] } as RunResponse
  }
  return data as RunResponse
}

export async function listProblems() {
  const { data } = await axios.get(`${apiBase()}/problems`)
  return data as LeetCodeProblem[]
}

export async function getProblem(slug: string) {
  const { data } = await axios.get(`${apiBase()}/problems/${slug}`)
  return data as LeetCodeProblem
}

export async function createProblem(problem: LeetCodeProblem) {
  const { data } = await axios.post(`${apiBase()}/problems`, problem)
  return data as LeetCodeProblem
}

export async function updateProblem(problem: LeetCodeProblem) {
  const { data } = await axios.put(`${apiBase()}/problems/${problem.slug}`, problem)
  return data as LeetCodeProblem
}

export async function getDraft(slug: string) {
  const { data } = await axios.get(`${apiBase()}/drafts/${slug}`)
  return data as LeetCodeDraft
}

export async function saveDraft(slug: string, code: string) {
  const { data } = await axios.put(`${apiBase()}/drafts/${slug}`, { code })
  return data as LeetCodeDraft
}

export async function runProblem(slug: string, code: string, testCases: ProblemTestCase[]) {
  const { data, headers } = await axios.post(`${apiBase()}/run`, { slug, code, testCases })
  const normalized = normalizeRunResponse(data)
  const cap = headers['x-leetcode-programrun']
  normalized.supportsProgramRunFeature = cap === '1'
  return normalized
}

export async function submitProblem(slug: string, code: string) {
  const { data } = await axios.post(`${apiBase()}/submit`, { slug, code })
  return data as RunResponse
}

export async function listSubmissions(slug?: string) {
  const { data } = await axios.get(`${apiBase()}/submissions`, {
    params: slug ? { slug } : undefined,
  })
  return data as SubmissionRecord[]
}
