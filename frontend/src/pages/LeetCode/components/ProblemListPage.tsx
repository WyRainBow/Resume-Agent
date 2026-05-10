import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createProblem, updateProblem } from '../api'
import type { LeetCodeProblem } from '../types'
import { ProblemEditorForm } from './ProblemEditorForm'

interface ProblemListPageProps {
  problems: LeetCodeProblem[]
  loading: boolean
  error: string
  onRefresh: () => Promise<void>
}

const difficultyClassMap = {
  Easy: 'text-emerald-400',
  Medium: 'text-amber-300',
  Hard: 'text-rose-400',
} as const

export function ProblemListPage({ problems, loading, error, onRefresh }: ProblemListPageProps) {
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All')
  const [customOnly, setCustomOnly] = useState(false)
  const [editingProblem, setEditingProblem] = useState<LeetCodeProblem | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    return problems.filter(problem => {
      const matchesQuery = !query || problem.title.toLowerCase().includes(query.toLowerCase()) || problem.slug.includes(query.toLowerCase())
      const matchesDifficulty = difficulty === 'All' || problem.difficulty === difficulty
      const matchesSource = !customOnly || problem.source === 'custom'
      return matchesQuery && matchesDifficulty && matchesSource
    })
  }, [customOnly, difficulty, problems, query])

  async function handleCreate(problem: LeetCodeProblem) {
    await createProblem(problem)
    setCreating(false)
    await onRefresh()
  }

  async function handleUpdate(problem: LeetCodeProblem) {
    await updateProblem(problem)
    setEditingProblem(null)
    await onRefresh()
  }

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-white">
      <div className="mx-auto max-w-[1440px] px-6 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 text-sm uppercase tracking-[0.25em] text-amber-300/70">LeetCode Workspace</div>
            <h1 className="text-4xl font-black tracking-tight">题库</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">支持文件预置题和页面新增题，第一版只做 Go，运行和提交都走真实后端判题。</p>
          </div>
          <button className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-black shadow-[0_0_30px_rgba(74,222,128,0.25)]" onClick={() => setCreating(true)}>新增自定义题</button>
        </div>

        <div className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[2fr_180px_180px]">
          <input
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/30"
            placeholder="搜索题目标题或 slug"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <select className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none" value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)}>
            <option value="All">全部难度</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span>仅看自定义题</span>
            <input type="checkbox" checked={customOnly} onChange={e => setCustomOnly(e.target.checked)} />
          </label>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#121212] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="grid grid-cols-[1.2fr_120px_1fr_160px_120px] border-b border-white/10 px-5 py-4 text-xs uppercase tracking-[0.2em] text-white/35">
            <div>标题</div>
            <div>难度</div>
            <div>标签</div>
            <div>更新时间</div>
            <div>操作</div>
          </div>

          {loading ? <div className="px-5 py-10 text-sm text-white/55">加载题库中...</div> : null}
          {error ? <div className="px-5 py-10 text-sm text-rose-300">{error}</div> : null}

          {!loading && !error && filtered.map(problem => (
            <div key={problem.slug} className="grid grid-cols-[1.2fr_120px_1fr_160px_120px] items-center border-b border-white/5 px-5 py-4 text-sm transition hover:bg-white/[0.03]">
              <div>
                <div className="font-semibold">{problem.title}</div>
                <div className="mt-1 text-xs text-white/35">{problem.slug}</div>
              </div>
              <div className={difficultyClassMap[problem.difficulty]}>{problem.difficulty}</div>
              <div className="flex flex-wrap gap-2">
                {problem.tags.map(tag => (
                  <span key={tag} className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/65">{tag}</span>
                ))}
              </div>
              <div className="text-xs text-white/40">{new Date(problem.updatedAt).toLocaleString()}</div>
              <div className="flex gap-2">
                <Link to={`/leetcode/problems/${problem.slug}`} className="rounded-lg bg-white/8 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15">刷题</Link>
                <button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5" onClick={() => setEditingProblem(problem)}>编辑</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {creating ? <ProblemEditorForm onCancel={() => setCreating(false)} onSave={handleCreate} /> : null}
      {editingProblem ? <ProblemEditorForm initialProblem={editingProblem} onCancel={() => setEditingProblem(null)} onSave={handleUpdate} /> : null}
    </div>
  )
}
