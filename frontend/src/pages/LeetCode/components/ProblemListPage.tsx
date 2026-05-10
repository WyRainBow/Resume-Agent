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

function leetcodeHref(raw: string | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1440px] px-6 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 text-sm uppercase tracking-[0.25em] text-amber-600/70">LeetCode Workspace</div>
            <h1 className="text-4xl font-black tracking-tight">题库</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">支持文件预置题和页面新增题、第一版只做 Go、运行和提交都走真实后端判题。</p>
          </div>
          <button className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-black shadow-[0_0_30px_rgba(74,222,128,0.25)]" onClick={() => setCreating(true)}>新增自定义题</button>
        </div>

        <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_180px_180px]">
          <input
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none placeholder:text-slate-400"
            placeholder="搜索题目标题或 slug"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <select className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)}>
            <option value="All">全部难度</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <span>仅看自定义题</span>
            <input type="checkbox" checked={customOnly} onChange={e => setCustomOnly(e.target.checked)} />
          </label>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(148,163,184,0.18)]">
          <div className="grid grid-cols-[1.2fr_100px_minmax(0,1fr)_minmax(8rem,11rem)_9rem_128px] gap-2 border-b border-slate-200 px-5 py-4 text-xs uppercase tracking-[0.2em] text-slate-400">
            <div>标题</div>
            <div>难度</div>
            <div>标签</div>
            <div>原题链接</div>
            <div>更新时间</div>
            <div>操作</div>
          </div>

          {loading ? <div className="px-5 py-10 text-sm text-slate-500">加载题库中...</div> : null}
          {error ? <div className="px-5 py-10 text-sm text-rose-600">{error}</div> : null}

          {!loading && !error && filtered.map(problem => (
            <div key={problem.slug} className="grid grid-cols-[1.2fr_100px_minmax(0,1fr)_minmax(8rem,11rem)_9rem_128px] items-center gap-2 border-b border-slate-100 px-5 py-4 text-sm transition hover:bg-slate-50">
              <div>
                <div className="font-semibold">{problem.title}</div>
                <div className="mt-1 text-xs text-slate-400">{problem.slug}</div>
              </div>
              <div className={difficultyClassMap[problem.difficulty]}>{problem.difficulty}</div>
              <div className="flex min-w-0 flex-wrap gap-2">
                {problem.tags.map(tag => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{tag}</span>
                ))}
              </div>
              <div className="min-w-0">
                {problem.leetcodeUrl?.trim() ? (
                  <a
                    href={leetcodeHref(problem.leetcodeUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium text-sky-600 underline-offset-4 hover:text-sky-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
                    title={leetcodeHref(problem.leetcodeUrl)}
                  >
                    力扣原题
                  </a>
                ) : (
                  <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                )}
              </div>
              <div className="text-xs tabular-nums text-slate-400">{new Date(problem.updatedAt).toLocaleString()}</div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/leetcode/problems/${problem.slug}`} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">刷题</Link>
                <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-100" onClick={() => setEditingProblem(problem)}>编辑</button>
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
