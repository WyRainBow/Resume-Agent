import { useEffect, useState } from 'react'
import { getUsers, updateUserQuota, updateUserRole } from '../lib/adminApi'
import { Panel } from '../components/Panel'
import { getToken, parseJwtRole } from '../lib/auth'
import type { AdminUser } from '../types/admin'

const roleLabel: Record<string, string> = {
  admin: '管理员',
  member: '成员',
  user: '普通用户',
}

export default function UsersPage() {
  const [items, setItems] = useState<AdminUser[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const role = parseJwtRole(getToken())

  const load = async () => {
    setLoading(true)
    const data = await getUsers({ page: 1, page_size: 50, keyword, with_total: 0 })
    setItems(data.items)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const onRoleChange = async (user: AdminUser, nextRole: string) => {
    setActionMsg(null)
    setActionErr(null)
    if (role === 'member' && (user.role === 'admin' || nextRole === 'admin')) {
      setActionErr('成员无权操作管理员账号')
      return
    }
    try {
      const updated = await updateUserRole(user.id, nextRole)
      setActionMsg(`已将 ${user.username} 角色更新为 ${nextRole}`)
      setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
    } catch (err: any) {
      setActionErr(err?.response?.data?.detail || '角色更新失败，请稍后重试')
    }
  }

  const onQuotaChange = async (user: AdminUser) => {
    setActionMsg(null)
    setActionErr(null)
    const next = prompt('设置 API 配额（留空表示不限制）', user.api_quota == null ? '' : String(user.api_quota))
    if (next === null) return
    const val = next.trim() === '' ? null : Number(next)
    try {
      const updated = await updateUserQuota(user.id, Number.isNaN(val as number) ? null : val)
      setActionMsg(`已更新 ${user.username} 的 API 配额`)
      setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
    } catch (err: any) {
      setActionErr(err?.response?.data?.detail || '配额更新失败，请稍后重试')
    }
  }

  return (
    <Panel
      title="用户管理"
      right={
        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索用户名/邮箱"
            className="input-clean w-60"
          />
          <button onClick={() => void load()} className="btn-primary">查询</button>
        </div>
      }
    >
      {actionMsg && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{actionMsg}</div>}
      {actionErr && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionErr}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="py-2">ID</th><th>用户名</th><th>角色</th><th>IP</th><th>配额</th><th>更新时间</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="py-5 text-slate-500" colSpan={7}>加载中...</td></tr>
            ) : items.map((u) => (
              <tr key={u.id} className="table-row">
                <td className="py-2 font-mono">{u.id}</td>
                <td>{u.username}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => void onRoleChange(u, e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                  >
                    <option value="user">普通用户</option>
                    <option value="member">成员</option>
                    <option value="admin">管理员</option>
                  </select>
                </td>
                <td className="font-mono text-xs text-slate-500">{u.last_login_ip || '-'}</td>
                <td>{u.api_quota ?? '∞'}</td>
                <td>{u.updated_at ? new Date(u.updated_at).toLocaleString() : '-'}</td>
                <td>
                  <button onClick={() => void onQuotaChange(u)} className="btn-ghost text-xs">设置配额</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
