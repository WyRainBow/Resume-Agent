import axios from 'axios'
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import type { LeetCodeDraft, LeetCodeProblem, ProblemTestCase, RunResponse, SubmissionRecord } from './types'

const apiBase = () => `${getApiBaseUrl()}/api/leetcode`

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
  const { data } = await axios.post(`${apiBase()}/run`, { slug, code, testCases })
  return data as RunResponse
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
