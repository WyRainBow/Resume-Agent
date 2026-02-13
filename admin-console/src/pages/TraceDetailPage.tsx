import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getTraceDetail } from '../lib/adminApi'
import { Panel } from '../components/Panel'
import type { TraceSpan } from '../types/admin'

export default function TraceDetailPage() {
  const { traceId = '' } = useParams()
  const [spans, setSpans] = useState<TraceSpan[]>([])

  useEffect(() => {
    if (!traceId) return
    void getTraceDetail(traceId).then((res) => setSpans(res.spans))
  }, [traceId])

  return (
    <Panel title={`链路详情：${traceId}`}>
      <div className="space-y-3">
        {spans.map((s) => (
          <div key={s.span_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="font-mono">span: {s.span_id}</span>
              <span>{s.status}</span>
              <span className="font-mono">{s.duration_ms.toFixed(2)}ms</span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-900">{s.span_name}</p>
            <p className="mt-1 text-xs text-slate-500">{new Date(s.start_time).toLocaleString()} - {new Date(s.end_time).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}
