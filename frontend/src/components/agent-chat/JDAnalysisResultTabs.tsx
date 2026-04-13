import type { JDAnalysisResult } from '@/services/jdAnalysis'

export type JDTabKey = 'report' | 'patch' | 'learning'

function previewValue(value: Record<string, any>) {
  return JSON.stringify(value, null, 2)
}

function ReportView({ result }: { result: JDAnalysisResult }) {
  return (
    <div className="mt-4 space-y-4 text-sm text-slate-700">
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-xs text-slate-500">匹配度</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900">{result.match_score}</div>
        <p className="mt-2 text-sm leading-6">{result.report.match.summary}</p>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-500">核心缺口</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {result.report.match.core_gaps.map((item) => (
            <span key={item} className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700">
              {item}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-500">优先修改项</div>
        <ul className="mt-2 space-y-2 text-sm">
          {result.report.match.priority_updates.map((item) => (
            <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-500">当前必补技术栈</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {result.report.match.current_must_have_stack.map((item) => (
            <span key={item} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
              {item}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-500">未来储备技术栈</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {result.report.match.future_stack.map((item) => (
            <span key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function PatchView(props: {
  result: JDAnalysisResult
  appliedPatchIds: string[]
  onApplyPatch: (patch: JDAnalysisResult['patch_batches'][number]) => void
}) {
  const { result, appliedPatchIds, onApplyPatch } = props
  return (
    <div className="mt-4 space-y-3">
      {result.patch_batches.map((patch) => {
        const applied = appliedPatchIds.includes(patch.patch_id)
        return (
          <div key={patch.patch_id} className="rounded-2xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{patch.module_label}</div>
                <div className="mt-1 text-xs text-slate-500">{patch.summary}</div>
              </div>
              <button
                onClick={() => onApplyPatch(patch)}
                disabled={applied}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  applied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {applied ? '已应用' : '应用'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">修改前</div>
                <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-700">
                  {previewValue(patch.before)}
                </pre>
              </div>
              <div className="rounded-xl bg-blue-50 p-3">
                <div className="text-[11px] text-blue-600">修改后</div>
                <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-800">
                  {previewValue(patch.after)}
                </pre>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LearningView({ result }: { result: JDAnalysisResult }) {
  return (
    <div className="mt-4 space-y-3">
      {result.learning_path.map((phase) => (
        <div key={phase.phase_name} className="rounded-2xl border border-slate-200 p-3">
          <div className="text-sm font-semibold text-slate-900">{phase.phase_name}</div>
          <p className="mt-1 text-sm text-slate-600">{phase.goal}</p>
          <div className="mt-3 text-xs font-semibold text-slate-500">学习主题</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {phase.topics.map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-3 text-xs font-semibold text-slate-500">项目建议</div>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {phase.suggested_projects.map((item) => (
              <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs font-semibold text-slate-500">可写入简历的成果表达</div>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {phase.resume_ready_outcomes.map((item) => (
              <li key={item} className="rounded-xl bg-emerald-50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

interface Props {
  result: JDAnalysisResult | null
  activeTab: JDTabKey
  appliedPatchIds: string[]
  onTabChange: (tab: JDTabKey) => void
  onApplyPatch: (patch: JDAnalysisResult['patch_batches'][number]) => void
}

export function JDAnalysisResultTabs(props: Props) {
  const { result, activeTab, appliedPatchIds, onTabChange, onApplyPatch } = props

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex gap-2">
        {(['report', 'patch', 'learning'] as JDTabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              activeTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {tab === 'report' ? '报告' : tab === 'patch' ? 'Patch' : '学习路径'}
          </button>
        ))}
      </div>
      {!result ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
          运行分析后，这里会展示岗位匹配报告、Patch 和学习路径。
        </div>
      ) : null}
      {result && activeTab === 'report' ? <ReportView result={result} /> : null}
      {result && activeTab === 'patch' ? (
        <PatchView
          result={result}
          appliedPatchIds={appliedPatchIds}
          onApplyPatch={onApplyPatch}
        />
      ) : null}
      {result && activeTab === 'learning' ? <LearningView result={result} /> : null}
    </div>
  )
}
