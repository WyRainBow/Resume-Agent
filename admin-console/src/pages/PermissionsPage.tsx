import { useEffect, useState } from 'react'
import { getPermissionAudits } from '../lib/adminApi'
import { Panel } from '../components/Panel'

export default function PermissionsPage() {
  const [items, setItems] = useState<Array<{ id: number; operator_user_id?: number; target_user_id?: number; operator_username?: string; target_username?: string; from_role?: string; to_role?: string; action: string; created_at?: string }>>([])

  useEffect(() => {
    void getPermissionAudits({ page: 1, page_size: 50 }).then((res) => setItems(res.items))
  }, [])

  return (
    <Panel title="权限审计日志">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="table-head">
            <tr><th className="py-2">时间</th><th>操作人</th><th>目标用户</th><th>动作</th><th>角色变化</th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="table-row">
                <td className="py-2">{a.created_at ? new Date(a.created_at).toLocaleString() : '-'}</td>
                <td>{a.operator_username || a.operator_user_id || '-'}</td>
                <td>{a.target_username || a.target_user_id || '-'}</td>
                <td>{a.action}</td>
                <td>{a.from_role || '-'} → {a.to_role || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
