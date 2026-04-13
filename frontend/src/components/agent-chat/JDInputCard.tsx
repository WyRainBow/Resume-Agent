import { Link2 } from 'lucide-react'

type SourceType = 'url' | 'text'

interface Props {
  sourceType: SourceType
  sourceUrl: string
  sourceText: string
  canSaveJD: boolean
  canRunAnalysis: boolean
  running: boolean
  onSourceTypeChange: (type: SourceType) => void
  onSourceUrlChange: (value: string) => void
  onSourceTextChange: (value: string) => void
  onSave: () => void
  onRun: () => void
}

export function JDInputCard(props: Props) {
  const {
    sourceType,
    sourceUrl,
    sourceText,
    canSaveJD,
    canRunAnalysis,
    running,
    onSourceTypeChange,
    onSourceUrlChange,
    onSourceTextChange,
    onSave,
    onRun,
  } = props

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex gap-2">
        <button onClick={() => onSourceTypeChange('url')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${sourceType === 'url' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
          <Link2 className="mr-1 inline h-3 w-3" />
          岗位链接
        </button>
        <button onClick={() => onSourceTypeChange('text')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${sourceType === 'text' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
          岗位文本
        </button>
      </div>
      {sourceType === 'url' ? (
        <input
          value={sourceUrl}
          onChange={(event) => onSourceUrlChange(event.target.value)}
          placeholder="粘贴公开招聘链接"
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
      ) : (
        <textarea
          value={sourceText}
          onChange={(event) => onSourceTextChange(event.target.value)}
          placeholder="粘贴岗位描述文本"
          rows={7}
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
      )}
      <div className="mt-3 flex gap-2">
        <button onClick={onSave} disabled={!canSaveJD} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          保存 JD
        </button>
        <button onClick={onRun} disabled={!canRunAnalysis} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {running ? '分析中...' : '运行分析'}
        </button>
      </div>
    </div>
  )
}
