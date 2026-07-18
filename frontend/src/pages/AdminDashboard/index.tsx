import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { getAuthHeaders } from '@/lib/authHeaders'
import { getApiBaseUrl, canUseAdminFeature } from '@/lib/runtimeEnv'
import { LogoManager } from './LogoManager'

type UserStats = {
  total_users: number
}

type UserRow = {
  id: string
  username: string
  email: string
  role: string
  created_at: string | null
  pdf_download_count: number
  resume_count: number
}

const ROLE_OPTIONS: { value: string; label: string; desc: string; dot: string }[] = [
  { value: 'admin', label: 'admin', desc: '管理员', dot: 'bg-emerald-500' },
  { value: 'staff', label: 'staff', desc: '员工', dot: 'bg-violet-500' },
  { value: 'member', label: 'member', desc: '会员', dot: 'bg-blue-500' },
  { value: 'user', label: 'user', desc: '普通用户', dot: 'bg-slate-400' },
]

function RoleDropdown({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  const current = ROLE_OPTIONS.find((o) => o.value === value)
    ?? ROLE_OPTIONS.find((o) => o.value === 'user')!
  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
        {current.label}
        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {ROLE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                if (o.value !== value) onChange(o.value)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <span className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${o.dot}`} />
                <span className="font-medium text-slate-700 dark:text-slate-200">{o.label}</span>
                <span className="text-slate-400">{o.desc}</span>
              </span>
              {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type PromptItem = {
  key: string
  title: string
  description: string
  variables: string[]
  content: string
}

const PROMPT_META: Record<string, { title: string; description: string; variables: string[] }> = {
  rewrite_text_prompt_template: {
    title: '划词润色模板',
    description: '用于 /api/resume/rewrite-text/stream',
    variables: ['locale', 'path_hint', 'instruction', 'source_text'],
  },
  rewrite_default_instruction: {
    title: '字段润色默认指令',
    description: '用于 /api/resume/rewrite 与 /api/resume/rewrite/stream 的兜底',
    variables: [],
  },
}

function parsePromptItems(payload: any): PromptItem[] {
  if (Array.isArray(payload?.items)) {
    return payload.items
  }

  const templateSource =
    payload && typeof payload === 'object'
      ? (payload.templates && typeof payload.templates === 'object'
          ? payload.templates
          : payload)
      : {}

  const pairs = Object.entries(templateSource).filter(
    ([key, value]) => typeof key === 'string' && typeof value === 'string'
  ) as Array<[string, string]>

  return pairs.map(([key, content]) => {
    const meta = PROMPT_META[key] || {
      title: key,
      description: '通用提示词项',
      variables: [],
    }
    return {
      key,
      title: meta.title,
      description: meta.description,
      variables: meta.variables,
      content,
    }
  })
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<UserStats | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [actionError, setActionError] = useState('')
  const [activeTab, setActiveTab] = useState<'users' | 'logos'>('users')

  const [promptLoading, setPromptLoading] = useState(true)
  const [promptSaving, setPromptSaving] = useState(false)
  const [promptError, setPromptError] = useState('')
  const [promptSuccess, setPromptSuccess] = useState('')
  const [promptItems, setPromptItems] = useState<PromptItem[]>([])

  useEffect(() => {
    if (!canUseAdminFeature()) {
      setError('无权限访问后台管理系统')
      setLoading(false)
      setPromptLoading(false)
      return
    }

    const loadStats = async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch(`${getApiBaseUrl()}/api/admin/stats/users`, {
          headers: getAuthHeaders(),
        })
        if (!resp.ok) {
          throw new Error(`请求失败: ${resp.status}`)
        }
        const data = (await resp.json()) as UserStats
        setStats(data)

        const usersResp = await fetch(`${getApiBaseUrl()}/api/admin/users`, {
          headers: getAuthHeaders(),
        })
        if (!usersResp.ok) {
          throw new Error(`请求失败: ${usersResp.status}`)
        }
        const usersData = (await usersResp.json()) as { users: UserRow[] }
        setUsers(usersData.users)
      } catch (e: any) {
        setError(e?.message || '获取用户统计失败')
      } finally {
        setLoading(false)
      }
    }

    const loadPrompts = async () => {
      setPromptLoading(true)
      setPromptError('')
      try {
        const resp = await fetch(`${getApiBaseUrl()}/api/config/prompts`, {
          headers: getAuthHeaders(),
        })
        if (!resp.ok) {
          throw new Error(`提示词加载失败: ${resp.status}`)
        }

        const data = await resp.json()
        const items = parsePromptItems(data)
        setPromptItems(items)
      } catch (e: any) {
        setPromptError(e?.message || '提示词加载失败')
      } finally {
        setPromptLoading(false)
      }
    }

    loadStats()
    loadPrompts()
  }, [])

  const handleRoleChange = async (userId: string, nextRole: string) => {
    const prev = users
    setActionError('')
    setUsers((list) => list.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)))
    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ role: nextRole }),
      })
      if (!resp.ok) throw new Error(`分配失败: ${resp.status}`)
    } catch (e) {
      setUsers(prev)
      setActionError(e instanceof Error ? e.message : '分配角色失败，请重试。')
      setTimeout(() => setActionError(''), 4000)
    }
  }

  const handlePromptChange = (key: string, nextContent: string) => {
    setPromptItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, content: nextContent } : item))
    )
  }

  const handleSavePrompt = async () => {
    setPromptSaving(true)
    setPromptError('')
    setPromptSuccess('')

    const promptsPayload = promptItems.reduce<Record<string, string>>((acc, item) => {
      acc[item.key] = item.content
      return acc
    }, {})

    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/config/prompts`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prompts: promptsPayload }),
      })
      if (!resp.ok) {
        throw new Error(`保存失败: ${resp.status}`)
      }
      setPromptSuccess('提示词已保存')
    } catch (e: any) {
      setPromptError(e?.message || '提示词保存失败')
    } finally {
      setPromptSaving(false)
    }
  }

  return (
    <WorkspaceLayout>
      {/* 米白背景 + 小格纸（参考 Builder） */}
      <div className="h-full overflow-y-auto bg-[#F0F0E8] bg-[linear-gradient(#D0D0C8_1px,transparent_1px),linear-gradient(90deg,#D0D0C8_1px,transparent_1px)] bg-[size:16px_16px] dark:bg-slate-950 dark:bg-[linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)]">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* 页面标题 - Builder 风格超大 serif 标题 */}
          <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000000] dark:border-white dark:bg-slate-900 dark:shadow-[6px_6px_0px_0px_#ffffff]">
            <h1 className="text-4xl font-serif font-bold tracking-tight text-black dark:text-white">后台管理系统</h1>
            <p className="mt-2 text-sm font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">Platform Dashboard</p>
          </div>

          {/* 加载中 / 无权限 / 请求错误 */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 bg-black">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border border-black bg-white p-5 dark:border-white dark:bg-slate-900">
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="mt-3 h-8 w-12 bg-slate-200 dark:bg-slate-700 animate-pulse" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="border-2 border-red-600 bg-white p-6 text-red-600 dark:border-red-400 dark:bg-slate-900 dark:text-red-400">
              {error}
            </div>
          ) : null}

          {/* Tab 栏 - 简洁底部边框 */}
          {!loading && !error && (
            <div className="flex items-center gap-1 border-b-2 border-black dark:border-white">
              {([
                { key: 'users', label: '用户管理' },
                { key: 'logos', label: 'Logo 管理' },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`relative px-4 py-3 text-sm font-mono uppercase tracking-wide transition-all ${
                    activeTab === t.key
                      ? 'text-black dark:text-white border-b-2 border-black dark:border-white -mb-[2px]'
                      : 'text-slate-500 hover:text-black dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* 用户管理 Tab */}
          {activeTab === 'users' && !loading && !error && (
            <>
              {/* 统计卡片 - 简洁硬边框 */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 bg-black">
                {[
                  { label: '用户总数', value: stats?.total_users ?? users.length, bar: 'bg-slate-400' },
                  { label: '管理员', value: users.filter((u) => u.role === 'admin').length, bar: 'bg-emerald-500' },
                  { label: '员工', value: users.filter((u) => u.role === 'staff').length, bar: 'bg-violet-500' },
                  { label: '会员', value: users.filter((u) => u.role === 'member').length, bar: 'bg-blue-500' },
                  { label: '普通用户', value: users.filter((u) => u.role === 'user').length, bar: 'bg-slate-400' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="border border-black bg-white p-4 dark:border-white dark:bg-slate-900"
                  >
                    <div className={`h-1 w-full mb-3 ${s.bar}`} />
                    <div className="text-xs font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.label}</div>
                    <div className="mt-1 text-3xl font-bold tabular-nums text-black dark:text-white">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* 用户列表表格 */}
              <section className="border-2 border-black bg-white shadow-[6px_6px_0px_0px_#000000] dark:border-white dark:bg-slate-900 dark:shadow-[6px_6px_0px_0px_#ffffff]">
                  <div className="border-b-2 border-black px-6 py-4 dark:border-white">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-serif font-bold text-black dark:text-white">用户列表</h2>
                        <p className="mt-1 text-xs font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">共 {users.length} 个用户</p>
                      </div>
                      {/* 角色图例 */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                        <span><span className="inline-block w-2 h-2 bg-emerald-500 mr-1" />admin</span>
                        <span><span className="inline-block w-2 h-2 bg-violet-500 mr-1" />staff</span>
                        <span><span className="inline-block w-2 h-2 bg-blue-500 mr-1" />member</span>
                        <span><span className="inline-block w-2 h-2 bg-slate-400 mr-1" />user</span>
                      </div>
                    </div>
                    {actionError && (
                      <div className="mt-3 border border-red-600 bg-white px-3 py-2 text-xs text-red-600 dark:border-red-400 dark:bg-slate-900 dark:text-red-400">
                        {actionError}
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          <th className="px-6 py-3 font-medium">ID</th>
                          <th className="px-6 py-3 font-medium">用户名</th>
                          <th className="px-6 py-3 font-medium">邮箱</th>
                          <th className="px-6 py-3 font-medium">角色</th>
                          <th className="px-6 py-3 font-medium">注册时间</th>
                          <th className="px-6 py-3 font-medium">简历数</th>
                          <th className="px-6 py-3 font-medium">PDF 次数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center font-mono text-slate-400">
                              暂无用户
                            </td>
                          </tr>
                        ) : (
                          users.map((u) => (
                            <tr
                              key={u.id}
                              className="border-b border-slate-100 text-slate-700 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50"
                            >
                              <td className="px-6 py-3 text-slate-400" title={u.id}>{String(u.id).slice(0, 8)}…</td>
                              <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">{u.username}</td>
                              <td className="px-6 py-3">{u.email}</td>
                              <td className="px-6 py-3">
                                <RoleDropdown value={u.role} onChange={(v) => handleRoleChange(u.id, v)} />
                              </td>
                              <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                                {u.created_at ? u.created_at.slice(0, 10) : '-'}
                              </td>
                              <td className="px-6 py-3 tabular-nums text-slate-500 dark:text-slate-400">{u.resume_count ?? 0}</td>
                              <td className="px-6 py-3 tabular-nums text-slate-500 dark:text-slate-400">{u.pdf_download_count}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
            </>
          )}

          {/* Logo 管理 Tab（按需渲染：切到该 Tab 才拉数据） */}
          {activeTab === 'logos' && !loading && !error && <LogoManager />}

          {false && <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-5 dark:border-slate-800">
              <h2 className="text-xl font-semibold text-white">提示词管理</h2>
              <p className="mt-1 text-sm text-slate-200">统一管理系统 Prompt，支持后续持续扩展</p>
            </div>

            <div className="space-y-4 bg-slate-50/70 p-6 dark:bg-slate-900">
              {promptLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  提示词加载中...
                </div>
              ) : (
                <>
                  {promptItems.length === 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                      当前没有可管理的提示词项，请检查后端配置。
                    </div>
                  ) : (
                    promptItems.map((item, index) => (
                      <article
                        key={item.key}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                            Prompt {index + 1}
                          </span>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                          <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {item.key}
                          </code>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>

                        <textarea
                          className="mt-3 w-full min-h-[200px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-mono leading-6 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          value={item.content}
                          onChange={(e) => handlePromptChange(item.key, e.target.value)}
                          placeholder={`请输入 ${item.title}`}
                        />

                        {item.variables.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.variables.map((v) => (
                              <span
                                key={`${item.key}-${v}`}
                                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {`{${v}}`}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-xs text-slate-400">该提示词无变量参数</div>
                        )}
                      </article>
                    ))
                  )}

                  {promptError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                      {promptError}
                    </div>
                  ) : null}
                  {promptSuccess ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400">
                      {promptSuccess}
                    </div>
                  ) : null}

                  <div className="sticky bottom-0 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">修改后请保存，配置会立即影响对应改写接口。</p>
                      <button
                        type="button"
                        onClick={handleSavePrompt}
                        disabled={promptSaving || promptItems.length === 0}
                        className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        {promptSaving ? '保存中...' : '保存提示词'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>}
        </div>
      </div>
    </WorkspaceLayout>
  )
}
