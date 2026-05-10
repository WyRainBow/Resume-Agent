import { useEffect, useState } from 'react'
import type { LeetCodeProblem } from '../types'

interface ProblemEditorFormProps {
  initialProblem?: LeetCodeProblem | null
  onCancel: () => void
  onSave: (problem: LeetCodeProblem) => Promise<void> | void
}

const newProblemTemplate = (): LeetCodeProblem => ({
  id: `problem_${Date.now()}`,
  slug: '',
  title: '',
  difficulty: 'Medium',
  tags: [],
  source: 'custom',
  description: '',
  examples: [],
  constraints: [],
  hints: [],
  functionName: 'solve',
  signature: 'func solve(nums []int, k int) []int',
  starterCode: 'package main\n\nfunc solve(nums []int, k int) []int {\n\treturn nums\n}\n',
  visibleTestCases: [
    { id: 'case-1', input: { nums: [1, 2, 3], k: 2 }, expected: [2, 1, 3] },
  ],
  hiddenTestCases: [],
  judge: {
    type: 'function',
    entry: 'solve',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

export function ProblemEditorForm({ initialProblem, onCancel, onSave }: ProblemEditorFormProps) {
  const [problem, setProblem] = useState<LeetCodeProblem>(initialProblem ?? newProblemTemplate())
  const [visibleCasesText, setVisibleCasesText] = useState(JSON.stringify(problem.visibleTestCases, null, 2))
  const [hiddenCasesText, setHiddenCasesText] = useState(JSON.stringify(problem.hiddenTestCases, null, 2))
  const [tagsText, setTagsText] = useState(problem.tags.join(', '))
  const [constraintsText, setConstraintsText] = useState(problem.constraints.join('\n'))
  const [hintsText, setHintsText] = useState(problem.hints.join('\n'))
  const [error, setError] = useState('')

  useEffect(() => {
    const next = initialProblem ?? newProblemTemplate()
    setProblem(next)
    setVisibleCasesText(JSON.stringify(next.visibleTestCases, null, 2))
    setHiddenCasesText(JSON.stringify(next.hiddenTestCases, null, 2))
    setTagsText(next.tags.join(', '))
    setConstraintsText(next.constraints.join('\n'))
    setHintsText(next.hints.join('\n'))
  }, [initialProblem])

  async function handleSubmit() {
    try {
      setError('')
      const payload: LeetCodeProblem = {
        ...problem,
        tags: tagsText.split(',').map(item => item.trim()).filter(Boolean),
        constraints: constraintsText.split('\n').map(item => item.trim()).filter(Boolean),
        hints: hintsText.split('\n').map(item => item.trim()).filter(Boolean),
        visibleTestCases: JSON.parse(visibleCasesText),
        hiddenTestCases: JSON.parse(hiddenCasesText),
        updatedAt: new Date().toISOString(),
      }
      await onSave(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : '题目保存失败')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-sm flex justify-end">
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-white text-slate-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">{initialProblem ? '编辑题目' : '新增自定义题'}</h2>
            <p className="text-sm text-slate-500">文件驱动和页面管理共用同一套 JSON 结构。</p>
          </div>
          <div className="flex gap-3">
            <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700" onClick={onCancel}>取消</button>
            <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black" onClick={handleSubmit}>保存题目</button>
          </div>
        </div>
        <div className="space-y-6 px-6 py-6">
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>标题</span>
              <input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" value={problem.title} onChange={e => setProblem(prev => ({ ...prev, title: e.target.value }))} />
            </label>
            <label className="space-y-2 text-sm">
              <span>Slug</span>
              <input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" value={problem.slug} onChange={e => setProblem(prev => ({ ...prev, slug: e.target.value }))} />
            </label>
            <label className="space-y-2 text-sm">
              <span>难度</span>
              <select className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" value={problem.difficulty} onChange={e => setProblem(prev => ({ ...prev, difficulty: e.target.value as LeetCodeProblem['difficulty'] }))}>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>标签（逗号分隔）</span>
              <input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" value={tagsText} onChange={e => setTagsText(e.target.value)} />
            </label>
          </div>

          <label className="block space-y-2 text-sm">
            <span>题目描述</span>
            <textarea className="min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3" value={problem.description} onChange={e => setProblem(prev => ({ ...prev, description: e.target.value }))} />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>约束（每行一条）</span>
              <textarea className="min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3" value={constraintsText} onChange={e => setConstraintsText(e.target.value)} />
            </label>
            <label className="space-y-2 text-sm">
              <span>提示（每行一条）</span>
              <textarea className="min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3" value={hintsText} onChange={e => setHintsText(e.target.value)} />
            </label>
          </div>

          <label className="block space-y-2 text-sm">
            <span>Go Starter Code</span>
            <textarea className="min-h-60 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-sm text-slate-800" value={problem.starterCode} onChange={e => setProblem(prev => ({ ...prev, starterCode: e.target.value }))} />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>公开测试用例 JSON</span>
              <textarea className="min-h-72 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-sm text-slate-800" value={visibleCasesText} onChange={e => setVisibleCasesText(e.target.value)} />
            </label>
            <label className="space-y-2 text-sm">
              <span>隐藏测试用例 JSON</span>
              <textarea className="min-h-72 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-sm text-slate-800" value={hiddenCasesText} onChange={e => setHiddenCasesText(e.target.value)} />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
