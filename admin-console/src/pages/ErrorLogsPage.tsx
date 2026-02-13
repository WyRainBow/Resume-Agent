import { useEffect, useState } from 'react'
import { getErrorLogs } from '../lib/adminApi'
import { Panel } from '../components/Panel'
import type { APIErrorLog } from '../types/admin'

export default function ErrorLogsPage() {
  const [items, setItems] = useState<APIErrorLog[]>([])

  const load = async () => {
    const data = await getErrorLogs({ page: 1, page_size: 100 })
    setItems(data.items)
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <Panel title="报错日志">
      <div className="space-y-3">
        {items.map((r) => (
          <article key={r.id} className="rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-red-500">
              <span>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</span>
              <span className="font-mono">trace: {r.trace_id}</span>
              <span>{r.error_type || '异常'}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-red-700">{r.error_message}</p>
          </article>
        ))}
      </div>
    </Panel>
  )
}
