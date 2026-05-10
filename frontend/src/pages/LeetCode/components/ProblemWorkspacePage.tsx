import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { getDraft, getProblem, listSubmissions, runProblem, saveDraft, submitProblem, updateProblem } from '../api'
import type { LeetCodeProblem, ProblemTestCase, RunResponse, SubmissionRecord } from '../types'

function formatValue(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function ResizeHandle({ direction }: { direction: 'horizontal' | 'vertical' }) {
  return (
    <Separator
      className={
        direction === 'horizontal'
          ? 'group relative w-2 bg-slate-200 transition-colors hover:bg-emerald-200 data-[resize-handle-state=drag]:bg-emerald-300'
          : 'group relative h-2 bg-slate-200 transition-colors hover:bg-emerald-200 data-[resize-handle-state=drag]:bg-emerald-300'
      }
    >
      <div
        className={
          direction === 'horizontal'
            ? 'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-300 group-hover:bg-emerald-500/60'
            : 'absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-300 group-hover:bg-emerald-500/60'
        }
      />
    </Separator>
  )
}

export function ProblemWorkspacePage() {
  const { slug = '' } = useParams()
  const [problem, setProblem] = useState<LeetCodeProblem | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [runResult, setRunResult] = useState<RunResponse | null>(null)
  const [submitResult, setSubmitResult] = useState<RunResponse | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [customInput, setCustomInput] = useState('{\n  "head": [1,2,3,4,5,6,7,8],\n  "k": 3\n}')
  const [customExpected, setCustomExpected] = useState('[3,2,1,6,5,4,8,7]')
  const [busy, setBusy] = useState<'run' | 'submit' | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [editingInfo, setEditingInfo] = useState(false)
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoDraft, setInfoDraft] = useState({
    title: '',
    difficulty: 'Medium',
    tagsText: '',
    description: '',
    exampleInput: '',
    exampleOutput: '',
    exampleExplanation: '',
    constraintsText: '',
    hintsText: '',
  })
  const lineNumberRef = useRef<HTMLDivElement | null>(null)

  const codeLines = useMemo(() => {
    const count = Math.max(code.split('\n').length, 1)
    return Array.from({ length: count }, (_, index) => index + 1)
  }, [code])

  useEffect(() => {
    let disposed = false

    async function load() {
      try {
        setLoading(true)
        setError('')
        const [problemData, draftData, submissionData] = await Promise.all([
          getProblem(slug),
          getDraft(slug),
          listSubmissions(slug),
        ])
        if (disposed) return
        setProblem(problemData)
        setCode(draftData.code || problemData.starterCode)
        setSubmissions(submissionData)
        setSelectedCaseId(problemData.visibleTestCases[0]?.id || '')
        setInfoDraft({
          title: problemData.title,
          difficulty: problemData.difficulty,
          tagsText: problemData.tags.join(', '),
          description: problemData.description,
          exampleInput: problemData.examples[0]?.input || '',
          exampleOutput: problemData.examples[0]?.output || '',
          exampleExplanation: problemData.examples[0]?.explanation || '',
          constraintsText: problemData.constraints.join('\n'),
          hintsText: problemData.hints.join('\n'),
        })
        if (problemData.visibleTestCases[0]) {
          setCustomInput(JSON.stringify(problemData.visibleTestCases[0].input, null, 2))
          setCustomExpected(JSON.stringify(problemData.visibleTestCases[0].expected, null, 2))
        }
      } catch (err) {
        if (disposed) return
        setError(err instanceof Error ? err.message : '题目加载失败')
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    void load()
    return () => {
      disposed = true
    }
  }, [slug])

  useEffect(() => {
    if (!problem) return
    const timer = window.setTimeout(() => {
      void saveDraft(problem.slug, code)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [code, problem])

  const selectedCase = useMemo(() => {
    return problem?.visibleTestCases.find(item => item.id === selectedCaseId) ?? problem?.visibleTestCases[0] ?? null
  }, [problem, selectedCaseId])

  async function handleRun() {
    if (!problem) return
    try {
      setError('')
      setBusy('run')
      const cases: ProblemTestCase[] = []
      if (selectedCase) cases.push(selectedCase)
      cases.push({
        id: 'custom-case',
        input: JSON.parse(customInput),
        expected: JSON.parse(customExpected),
      })
      const result = await runProblem(problem.slug, code, cases)
      setRunResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '运行失败')
    } finally {
      setBusy(null)
    }
  }

  async function handleSubmit() {
    if (!problem) return
    try {
      setError('')
      setBusy('submit')
      const result = await submitProblem(problem.slug, code)
      setSubmitResult(result)
      const nextSubmissions = await listSubmissions(problem.slug)
      setSubmissions(nextSubmissions)
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败')
    } finally {
      setBusy(null)
    }
  }

  async function handleCopyRunResult() {
    if (!runResult) return
    const content = [
      `status: ${runResult.status}`,
      `passed: ${runResult.summary.passed}/${runResult.summary.total}`,
      '',
      ...runResult.results.flatMap(item => [
        `${item.caseId}: ${item.status}`,
        `expected: ${formatValue(item.expected)}`,
        `actual: ${formatValue(item.actual)}`,
        item.stdout ? `stdout: ${item.stdout}` : '',
        item.stderr ? `stderr: ${item.stderr}` : '',
        '',
      ]),
    ]
      .filter(Boolean)
      .join('\n')

    try {
      await navigator.clipboard.writeText(content)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 1500)
    }
  }

  async function handleSaveInfo() {
    if (!problem) return
    try {
      setSavingInfo(true)
      setError('')
      const nextProblem: LeetCodeProblem = {
        ...problem,
        title: infoDraft.title.trim() || problem.title,
        difficulty: infoDraft.difficulty as LeetCodeProblem['difficulty'],
        tags: infoDraft.tagsText.split(',').map(item => item.trim()).filter(Boolean),
        description: infoDraft.description.trim(),
        examples: [
          {
            input: infoDraft.exampleInput.trim(),
            output: infoDraft.exampleOutput.trim(),
            explanation: infoDraft.exampleExplanation.trim() || undefined,
          },
        ].filter(item => item.input || item.output),
        constraints: infoDraft.constraintsText.split('\n').map(item => item.trim()).filter(Boolean),
        hints: infoDraft.hintsText.split('\n').map(item => item.trim()).filter(Boolean),
      }
      const saved = await updateProblem(nextProblem)
      setProblem(saved)
      setInfoDraft({
        title: saved.title,
        difficulty: saved.difficulty,
        tagsText: saved.tags.join(', '),
        description: saved.description,
        exampleInput: saved.examples[0]?.input || '',
        exampleOutput: saved.examples[0]?.output || '',
        exampleExplanation: saved.examples[0]?.explanation || '',
        constraintsText: saved.constraints.join('\n'),
        hintsText: saved.hints.join('\n'),
      })
      setEditingInfo(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存题目信息失败')
    } finally {
      setSavingInfo(false)
    }
  }

  function handleEditorScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (lineNumberRef.current) {
      lineNumberRef.current.scrollTop = event.currentTarget.scrollTop
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 px-6 py-10 text-sm text-slate-500">加载题目中...</div>
  }

  if (error && !problem) {
    return <div className="min-h-screen bg-slate-50 px-6 py-10 text-sm text-rose-600">{error}</div>
  }

  if (!problem) return null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/leetcode" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">返回题库</Link>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-600/70">Go / Local Judge</div>
            <h1 className="text-lg font-bold">{problem.title}</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={() => setCode(problem.starterCode)}>重置代码</button>
          <button className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white" onClick={handleRun} disabled={busy !== null}>{busy === 'run' ? '运行中...' : '运行'}</button>
          <button className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-black" onClick={handleSubmit} disabled={busy !== null}>{busy === 'submit' ? '提交中...' : '提交'}</button>
        </div>
      </div>

      <Group direction="vertical" className="min-h-[calc(100vh-73px)]">
        <Panel defaultSize={72} minSize={35}>
          <Group direction="horizontal" className="h-full">
            <Panel defaultSize={26} minSize={18} className="bg-white">
              <aside className="h-full border-r border-slate-200 bg-white">
                <div className="h-full overflow-y-auto px-8 py-8">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {editingInfo ? (
                  <>
                    <select
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-600"
                      value={infoDraft.difficulty}
                      onChange={e => setInfoDraft(prev => ({ ...prev, difficulty: e.target.value }))}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                    <input
                      className="min-w-40 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none"
                      value={infoDraft.tagsText}
                      onChange={e => setInfoDraft(prev => ({ ...prev, tagsText: e.target.value }))}
                      placeholder="标签，逗号分隔"
                    />
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-600">{problem.difficulty}</span>
                    {problem.tags.map(tag => (
                      <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{tag}</span>
                    ))}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {editingInfo ? (
                  <>
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600" onClick={() => setEditingInfo(false)}>取消</button>
                    <button className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black" onClick={handleSaveInfo} disabled={savingInfo}>{savingInfo ? '保存中...' : '保存'}</button>
                  </>
                ) : (
                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100" onClick={() => setEditingInfo(true)}>编辑</button>
                )}
              </div>
            </div>

            {editingInfo ? (
              <div className="mb-6 space-y-4">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-bold text-slate-900 outline-none"
                  value={infoDraft.title}
                  onChange={e => setInfoDraft(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="题目标题"
                />
                <textarea
                  className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] leading-7 text-slate-700 outline-none"
                  value={infoDraft.description}
                  onChange={e => setInfoDraft(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="题目描述"
                />
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{problem.description}</p>
            )}

            {(editingInfo || problem.examples.length > 0) ? (
              <section className="mt-8 space-y-4">
                <h2 className="text-xl font-bold">示例</h2>
                {editingInfo ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <textarea className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none" value={infoDraft.exampleInput} onChange={e => setInfoDraft(prev => ({ ...prev, exampleInput: e.target.value }))} placeholder="输入" />
                    <textarea className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none" value={infoDraft.exampleOutput} onChange={e => setInfoDraft(prev => ({ ...prev, exampleOutput: e.target.value }))} placeholder="输出" />
                    <textarea className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none" value={infoDraft.exampleExplanation} onChange={e => setInfoDraft(prev => ({ ...prev, exampleExplanation: e.target.value }))} placeholder="解释" />
                  </div>
                ) : problem.examples.map((example, index) => (
                  <div key={`${example.input}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <div><span className="font-semibold">输入：</span>{example.input}</div>
                    <div className="mt-2"><span className="font-semibold">输出：</span>{example.output}</div>
                    {example.explanation ? <div className="mt-2 text-slate-500"><span className="font-semibold">解释：</span>{example.explanation}</div> : null}
                  </div>
                ))}
              </section>
            ) : null}

            {(editingInfo || problem.constraints.length > 0) ? (
              <section className="mt-8">
                <h2 className="text-xl font-bold">约束</h2>
                {editingInfo ? (
                  <textarea className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" value={infoDraft.constraintsText} onChange={e => setInfoDraft(prev => ({ ...prev, constraintsText: e.target.value }))} placeholder="每行一条约束" />
                ) : (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                    {problem.constraints.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </section>
            ) : null}

            {(editingInfo || problem.hints.length > 0) ? (
              <section className="mt-8">
                <h2 className="text-xl font-bold">提示</h2>
                {editingInfo ? (
                  <textarea className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" value={infoDraft.hintsText} onChange={e => setInfoDraft(prev => ({ ...prev, hintsText: e.target.value }))} placeholder="每行一条提示" />
                ) : (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                    {problem.hints.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </section>
            ) : null}

            <section className="mt-8">
              <h2 className="text-xl font-bold">最近提交</h2>
              <div className="mt-3 space-y-3">
                {submissions.length === 0 ? <div className="text-sm text-white/45">还没有提交记录。</div> : null}
                {submissions.slice(0, 5).map(item => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className={item.status === 'accepted' ? 'text-emerald-300' : 'text-rose-300'}>{item.status}</span>
                      <span className="text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-slate-500">{item.summary.passed} / {item.summary.total} cases</div>
                  </div>
                ))}
              </div>
            </section>
                </div>
              </aside>
            </Panel>

            <ResizeHandle direction="horizontal" />

            <Panel defaultSize={74} minSize={36} className="bg-white">
              <section className="h-full border-b border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-3 text-sm text-slate-500">Go · 智能模式</div>
                <div className="flex h-[calc(100%-45px)] min-h-[320px] overflow-hidden">
                  <div
                    ref={lineNumberRef}
                    className="w-16 shrink-0 overflow-hidden border-r border-slate-200 bg-slate-100 py-4 text-right font-mono text-[15px] leading-7 text-slate-400"
                  >
                    {codeLines.map(line => (
                      <div key={line} className="pr-4 select-none">
                        {line}
                      </div>
                    ))}
                  </div>
                  <textarea
                    className="h-full w-full resize-none bg-white px-5 py-4 font-mono text-[15px] leading-7 text-slate-800 outline-none"
                    spellCheck={false}
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    onScroll={handleEditorScroll}
                  />
                </div>
              </section>
            </Panel>
          </Group>
        </Panel>

        <ResizeHandle direction="vertical" />

        <Panel defaultSize={28} minSize={18}>
          <section className="h-full overflow-y-auto bg-slate-50">
            <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">测试用例 / 结果</div>
            <div className="space-y-6 p-5">
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">公开用例</div>
                      <div className="flex flex-wrap gap-2">
                        {problem.visibleTestCases.map(item => (
                          <button key={item.id} className={`rounded-lg px-3 py-2 text-sm ${selectedCaseId === item.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`} onClick={() => setSelectedCaseId(item.id)}>{item.id}</button>
                        ))}
                      </div>
                    </div>
                    <label className="block">
                      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">自定义输入 JSON</div>
                      <textarea className="min-h-32 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-sm text-slate-700" value={customInput} onChange={e => setCustomInput(e.target.value)} />
                    </label>
                    <label className="block">
                      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">期望输出 JSON</div>
                      <textarea className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-sm text-slate-700" value={customExpected} onChange={e => setCustomExpected(e.target.value)} />
                    </label>
                    {selectedCase ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                        <div className="font-semibold">当前公开用例</div>
                        <pre className="mt-3 whitespace-pre-wrap text-slate-600">{formatValue(selectedCase.input)}</pre>
                      </div>
                    ) : null}
                  </div>

                  <div className="h-px bg-slate-200" />

                  <div className="space-y-4">
                    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="font-semibold">运行结果</div>
                          <button
                            className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={handleCopyRunResult}
                            disabled={!runResult}
                          >
                            {copyState === 'copied' ? '已复制' : copyState === 'error' ? '复制失败' : '复制结果'}
                          </button>
                        </div>
                        {runResult ? <div className="text-sm text-slate-500">{runResult.summary.passed} / {runResult.summary.total}</div> : null}
                      </div>
                      {runResult ? (
                        <div className="space-y-3">
                          {runResult.results.map(item => (
                            <div key={item.caseId} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span>{item.caseId}</span>
                                <span className={item.passed ? 'text-emerald-600' : 'text-rose-600'}>{item.status}</span>
                              </div>
                              <div className="mt-2 grid gap-3 md:grid-cols-2">
                                <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700 border border-slate-200">expected: {formatValue(item.expected)}</pre>
                                <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700 border border-slate-200">actual: {formatValue(item.actual)}</pre>
                              </div>
                              {item.stderr ? <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-rose-50 p-3 text-xs text-rose-600 border border-rose-200">stderr: {item.stderr}</pre> : null}
                              {item.stdout ? <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700 border border-slate-200">stdout: {item.stdout}</pre> : null}
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-sm text-slate-400">运行后会在这里展示公开用例和自定义用例结果。</div>}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="font-semibold">提交结果</div>
                        {submitResult ? <div className="text-sm text-slate-500">{submitResult.summary.passed} / {submitResult.summary.total}</div> : null}
                      </div>
                      {submitResult ? (
                        <div className="space-y-3">
                          {submitResult.results.map(item => (
                            <div key={item.caseId} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span>{item.caseId}</span>
                                <span className={item.passed ? 'text-emerald-600' : 'text-rose-600'}>{item.status}</span>
                              </div>
                              <div className="mt-2 text-xs text-slate-500">耗时 {item.durationMs}ms</div>
                              {item.stderr ? <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-rose-50 p-3 text-xs text-rose-600 border border-rose-200">stderr: {item.stderr}</pre> : null}
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-sm text-slate-400">正式提交会在这里展示公开与隐藏用例的汇总判题结果。</div>}
                    </div>
                  </div>
            </div>
          </section>
        </Panel>
      </Group>
    </div>
  )
}
