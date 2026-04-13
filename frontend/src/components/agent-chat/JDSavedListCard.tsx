import { Loader2, Pin } from 'lucide-react'
import type { JDRecord } from '@/services/jdAnalysis'

interface Props {
  items: JDRecord[]
  loading: boolean
  selectedJdId: string | null
  onSelect: (jdId: string) => void
  onView: (item: JDRecord) => void
  onSetDefault: (jdId: string) => void
}

export function JDSavedListCard(props: Props) {
  const { items, loading, selectedJdId, onSelect, onView, onSetDefault } = props

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">已保存 JD</h3>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-xs text-slate-500">
            还没有保存过 JD，可以直接在下面粘贴岗位链接或岗位文本。
          </div>
        ) : items.map((item) => (
          <div
            key={item.id}
            className={`flex gap-3 rounded-xl border px-3 py-3 transition ${
              selectedJdId === item.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <button type="button" onClick={() => onSelect(item.id)} className="min-w-0 flex-1 text-left">
              <div className="text-sm font-medium text-slate-900">{item.title}</div>
              <div className="mt-1 text-xs text-slate-500">
                {item.company_name || '未知公司'} · {item.source_type === 'url' ? '链接' : '文本'}
              </div>
            </button>
            <div className="flex shrink-0 items-start gap-2">
              <button
                type="button"
                onClick={() => onView(item)}
                className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
              >
                查看
              </button>
              {item.is_default ? (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">默认</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetDefault(item.id)}
                  className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-100"
                >
                  <Pin className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
