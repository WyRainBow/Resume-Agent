import { useEffect, useState } from 'react'
import { createMember, deleteMember, getMembers, getUsers, updateMember } from '../lib/adminApi'
import { Panel } from '../components/Panel'
import type { AdminUser, Member, Role } from '../types/admin'

const emptyForm = { user_id: '', position: '', team: '', status: 'active', user_role: 'member' as Role }
const roleLabel: Record<Role, string> = { admin: '管理员', member: '成员', user: '普通用户' }

export default function MembersPage() {
  const [items, setItems] = useState<Member[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    const data = await getMembers({ page: 1, page_size: 50 })
    setItems(data.items)
  }

  useEffect(() => {
    void load()
    void getUsers({ page: 1, page_size: 200 }).then((res) => setUsers(res.items))
  }, [])

  const submit = async () => {
    setMsg(null)
    setErr(null)
    if (!form.user_id) {
      setErr('请选择用户')
      return
    }
    setSaving(true)
    try {
      const payload = {
        user_id: Number(form.user_id),
        position: form.position.trim() || undefined,
        team: form.team.trim() || undefined,
        status: form.status,
        user_role: form.user_role,
      }
      if (editingId) {
        await updateMember(editingId, payload)
        setMsg('成员信息已更新')
      } else {
        await createMember(payload)
        setMsg('成员创建成功')
      }
      setForm(emptyForm)
      setEditingId(null)
      await load()
      const usersData = await getUsers({ page: 1, page_size: 200 })
      setUsers(usersData.items)
    } catch (e: any) {
      setErr(e?.response?.data?.detail || '操作失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <Panel title="成员列表">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="table-head">
              <tr><th className="py-2">用户名</th><th>岗位</th><th>团队</th><th>成员状态</th><th>系统角色</th><th>操作</th></tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="table-row">
                  <td className="py-2">{m.username || m.name}</td>
                  <td>{m.position || '-'}</td>
                  <td>{m.team || '-'}</td>
                  <td>{m.status === 'active' ? '在职' : '停用'}</td>
                  <td>{m.user_role ? roleLabel[m.user_role] : '-'}</td>
                  <td className="space-x-2">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => {
                        setEditingId(m.id)
                        setForm({
                          user_id: m.user_id ? String(m.user_id) : '',
                          position: m.position || '',
                          team: m.team || '',
                          status: m.status,
                          user_role: (m.user_role || 'member') as Role,
                        })
                      }}
                    >编辑</button>
                    <button className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50" onClick={() => void deleteMember(m.id).then(async () => { await load(); const usersData = await getUsers({ page: 1, page_size: 200 }); setUsers(usersData.items) })}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={editingId ? '编辑成员' : '新增成员'}>
        <div className="space-y-3">
          {msg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <select className="input-clean" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
            <option value="">请选择用户名</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.username}（当前：{roleLabel[u.role]}）</option>
            ))}
          </select>
          <select className="input-clean" value={form.user_role} onChange={(e) => setForm({ ...form, user_role: e.target.value as Role })}>
            <option value="member">设为成员</option>
            <option value="admin">设为管理员</option>
            <option value="user">保持普通用户</option>
          </select>
          <input className="input-clean" placeholder="岗位" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <input className="input-clean" placeholder="团队" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
          <select className="input-clean" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">在职</option>
            <option value="inactive">停用</option>
          </select>
          <button onClick={() => void submit()} className="btn-primary w-full" disabled={saving}>
            {saving ? '提交中...' : editingId ? '保存修改' : '创建成员'}
          </button>
        </div>
      </Panel>
    </div>
  )
}
