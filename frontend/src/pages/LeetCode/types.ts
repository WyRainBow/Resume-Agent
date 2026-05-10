export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface ProblemExample {
  input: string
  output: string
  explanation?: string
}

export interface ProblemTestCase {
  id: string
  input: Record<string, unknown>
  expected: unknown
}

export interface LeetCodeProblem {
  id: string
  slug: string
  title: string
  difficulty: Difficulty
  tags: string[]
  source: string
  description: string
  examples: ProblemExample[]
  constraints: string[]
  hints: string[]
  functionName: string
  signature: string
  starterCode: string
  visibleTestCases: ProblemTestCase[]
  hiddenTestCases: ProblemTestCase[]
  judge: {
    type: string
    entry: string
  }
  createdAt: string
  updatedAt: string
}

export interface LeetCodeDraft {
  slug: string
  language: 'go'
  code: string
  updatedAt: string | null
}

export interface RunCaseResult {
  caseId: string
  passed: boolean
  status: 'accepted' | 'wrong_answer' | 'runtime_error' | 'timeout'
  stdout: string
  stderr: string
  expected: unknown
  actual: unknown
  durationMs: number
}

export interface RawProgramRunResult {
  status: 'success' | 'error' | 'timeout'
  exitCode: number | null
  stdout: string
  stderr: string
  durationMs: number
}

export interface RunResponse {
  status: 'accepted' | 'wrong_answer' | 'runtime_error' | 'timeout'
  summary: {
    passed: number
    total: number
  }
  results: RunCaseResult[]
  /** 编辑器源码原文 go run（含 main），与评测用例独立 */
  programRun?: RawProgramRunResult
}

export interface SubmissionRecord extends RunResponse {
  id: string
  slug: string
  language: 'go'
  code: string
  mode: 'submit'
  createdAt: string
}
