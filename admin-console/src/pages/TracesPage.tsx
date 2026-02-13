import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTraces } from '../lib/adminApi'
import { Panel } from '../components/Panel'

export default function TracesPage() {
  const [items, setItems] = useState<Array<{ trace_id: string; latest_at?: string; request_count: number; error_count: number; avg_latency_ms: number }>>([])
  const navigate = useNavigate()

  useEffect(() => {
    void getTraces({ page: 1, page_size: 100 }).then((res) => setItems(res.items))
  }, [])

  return (
    <Panel title="链路追踪列表">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="table-head">
            <tr><th className="py-2">Trace ID</th><th>请求数</th><th>错误数</th><th>平均耗时</th><th>最新时间</th><th /></tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.trace_id} className="table-row">
                <td className="py-2 font-mono text-xs text-slate-500">{t.trace_id}</td>
                <td>{t.request_count}</td>
                <td>{t.error_count}</td>
                <td className="font-mono">{t.avg_latency_ms.toFixed(2)}ms</td>
                <td>{t.latest_at ? new Date(t.latest_at).toLocaleString() : '-'}</td>
                <td><button className="btn-ghost text-xs" onClick={() => navigate(`/traces/${t.trace_id}`)}>查看详情</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
