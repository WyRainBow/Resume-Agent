import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { listProblems } from './api'
import { ProblemListPage } from './components/ProblemListPage'
import { ProblemWorkspacePage } from './components/ProblemWorkspacePage'
import type { LeetCodeProblem } from './types'

export default function LeetCodePage() {
  const [problems, setProblems] = useState<LeetCodeProblem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadProblems() {
    try {
      setLoading(true)
      setError('')
      const data = await listProblems()
      setProblems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '题库加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProblems()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<ProblemListPage problems={problems} loading={loading} error={error} onRefresh={loadProblems} />} />
      <Route path="/problems/:slug" element={<ProblemWorkspacePage />} />
    </Routes>
  )
}
