import { useEffect, useState } from 'react'
import { getRequestLogs } from '../lib/adminApi'
import { Panel } from '../components/Panel'
import type { APIRequestLog } from '../types/admin'

export default function RequestLogsPage() {
  const [items, setItems] = useState<APIRequestLog[]>([])
  const [path, setPath] = useState('')

  const load = async () => {
    const data = await getRequestLogs({ page: 1, page_size: 100, path: path || undefined })
    setItems(data.items)
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <Panel
      title="接口请求日志"
      right={
        <div className="flex gap-2">
          <input className="input-clean w-56" placeholder="按路径筛选" value={path} onChange={(e) => setPath(e.target.value)} />
          <button className="btn-primary" onClick={() => void load()}>查询</button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="table-head"><tr><th className="py-2">时间</th><th>方法</th><th>路径</th><th>状态码</th><th>耗时</th><th>Trace ID</th><th>IP</th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                <td>{r.method}</td>
                <td className="font-mono text-xs text-slate-500">{r.path}</td>
                <td>{r.status_code}</td>
                <td className="font-mono">{r.latency_ms.toFixed(2)}ms</td>
                <td className="font-mono text-xs text-slate-500">{r.trace_id}</td>
                <td className="font-mono text-xs text-slate-500">{r.ip || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
