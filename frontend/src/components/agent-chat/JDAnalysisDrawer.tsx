import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Save, Sparkles, X } from 'lucide-react'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import { JDAnalysisResultTabs, type JDTabKey } from '@/components/agent-chat/JDAnalysisResultTabs'
import { JDInputCard } from '@/components/agent-chat/JDInputCard'
import { JDRecordDetailDialog } from '@/components/agent-chat/JDRecordDetailDialog'
import { JDSavedListCard } from '@/components/agent-chat/JDSavedListCard'
import {
  createJD,
  getLatestJDAnalysis,
  listJDs,
  setDefaultJD,
  streamJDAnalysis,
  updateJD,
  type JDAnalysisResult,
  type JDAnalysisStage,
  type JDRecord,
} from '@/services/jdAnalysis'
import type { SavedResume } from '@/services/storage/StorageAdapter'
import { useResumeContext } from '@/contexts/ResumeContext'

type SourceType = 'url' | 'text'

interface IntentDraft {
  sourceType: SourceType
  value: string
  key: string
}

interface Props {
  open: boolean
  resumeId: string | null
  resumeData: ResumeData | null
  llmProfile?: string | null
  intentDraft?: IntentDraft | null
  onClose: () => void
  onRequestResume: () => void
  onSaveJD?: (jd: JDRecord) => void
  onAnalysisStart?: (jd: JDRecord) => void
  onAnalysisResult?: (jd: JDRecord, result: JDAnalysisResult) => void
  onAnalysisError?: (jd: JDRecord | null, message: string) => void
  onResumeSaved?: (saved: SavedResume) => void
}

const DEFAULT_STAGES: JDAnalysisStage[] = [
  { stage: 'fetch_jd', label: '获取 JD', status: 'pending' },
  { stage: 'structure_jd', label: '结构化 JD', status: 'pending' },
  { stage: 'extract_requirements', label: '提炼岗位要求', status: 'pending' },
  { stage: 'analyze_resume', label: '分析简历差距', status: 'pending' },
  { stage: 'generate_patch', label: '生成 Patch', status: 'pending' },
  { stage: 'generate_learning_path', label: '生成学习路径', status: 'pending' },
]

function mergeStage(stages: JDAnalysisStage[], nextStage: JDAnalysisStage) {
  return stages.map((item) =>
    item.stage === nextStage.stage ? { ...item, ...nextStage } : item,
  )
}

export function JDAnalysisDrawer(props: Props) {
  const {
    open,
    resumeId,
    resumeData,
    llmProfile,
    intentDraft,
    onClose,
    onRequestResume,
    onSaveJD,
    onAnalysisStart,
    onAnalysisResult,
    onAnalysisError,
    onResumeSaved,
  } = props
  const { setResume, applyPatchDraft, saveResumeDraft } = useResumeContext()
  const [items, setItems] = useState<JDRecord[]>([])
  const [selectedJdId, setSelectedJdId] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<SourceType>('url')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [savingResume, setSavingResume] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [result, setResult] = useState<JDAnalysisResult | null>(null)
  const [stages, setStages] = useState<JDAnalysisStage[]>(DEFAULT_STAGES)
  const [activeTab, setActiveTab] = useState<JDTabKey>('report')
  const [appliedPatchIds, setAppliedPatchIds] = useState<string[]>([])
  const [detailJd, setDetailJd] = useState<JDRecord | null>(null)
  const [detailTitleDraft, setDetailTitleDraft] = useState('')

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedJdId) || null,
    [items, selectedJdId],
  )
  const manualValue = sourceType === 'url' ? sourceUrl.trim() : sourceText.trim()
  const canSaveJD = manualValue.length > 0 && !loading
  const canRunAnalysis = Boolean(resumeId && resumeData && (selectedItem || manualValue)) && !running

  useEffect(() => {
    setResume(resumeData ?? null)
  }, [resumeData, setResume])

  useEffect(() => {
    if (!open) {
      setDetailJd(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void listJDs()
      .then((records) => {
        if (cancelled) return
        setItems(records)
        if (!selectedJdId) {
          const defaultItem = records.find((item) => item.is_default)
          setSelectedJdId(defaultItem?.id || records[0]?.id || null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载 JD 列表失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!intentDraft) return
    setSelectedJdId(null)
    setResult(null)
    setStages(DEFAULT_STAGES)
    setError(null)
    setSourceType(intentDraft.sourceType)
    setSourceUrl(intentDraft.sourceType === 'url' ? intentDraft.value : '')
    setSourceText(intentDraft.sourceType === 'text' ? intentDraft.value : '')
  }, [intentDraft])

  useEffect(() => {
    if (!open || !selectedJdId || !resumeId) return
    let cancelled = false
    setError(null)
    void getLatestJDAnalysis(selectedJdId, resumeId)
      .then((latest) => {
        if (cancelled) return
        setResult(latest)
        setAppliedPatchIds([])
        setActiveTab(latest ? 'report' : 'patch')
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载历史分析结果失败')
      })
    return () => {
      cancelled = true
    }
  }, [open, selectedJdId, resumeId])

  async function refreshItems(nextSelectedId?: string, nextDetailId?: string) {
    const records = await listJDs()
    setItems(records)
    if (nextSelectedId) setSelectedJdId(nextSelectedId)
    const detailId = nextDetailId ?? detailJd?.id
    if (!detailId) return
    const nextDetail = records.find((item) => item.id === detailId) || null
    setDetailJd(nextDetail)
    setDetailTitleDraft(nextDetail?.title || '')
  }

  async function persistCurrentJD() {
    if (!manualValue) {
      throw new Error(sourceType === 'url' ? '请先粘贴岗位链接' : '请先粘贴岗位文本')
    }
    const payload =
      sourceType === 'url'
        ? { source_type: 'url' as const, source_url: sourceUrl, llm_profile: llmProfile }
        : { source_type: 'text' as const, raw_text: sourceText, llm_profile: llmProfile }
    const created = await createJD(payload)
    await refreshItems(created.id)
    return created
  }

  async function handleSaveJD() {
    setError(null)
    setSaveMessage(null)
    setLoading(true)
    try {
      const created = await persistCurrentJD()
      setSaveMessage(`已保存 JD：${created.title}`)
      onSaveJD?.(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 JD 失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleRunAnalysis() {
    if (!resumeId || !resumeData) return onRequestResume()
    setError(null)
    setSaveMessage(null)
    setRunning(true)
    setResult(null)
    setAppliedPatchIds([])
    setStages(DEFAULT_STAGES)
    setActiveTab('report')
    let activeJd: JDRecord | null = selectedItem
    let finalResult: JDAnalysisResult | null = null
    let streamError: string | null = null

    try {
      const jd = selectedItem || (await persistCurrentJD())
      activeJd = jd
      onAnalysisStart?.(jd)
      await streamJDAnalysis(
        {
          jd_id: jd.id,
          resume_id: resumeId,
          resume_data: resumeData as unknown as Record<string, any>,
          llm_profile: llmProfile,
        },
        {
          onStage: (stage) => setStages((prev) => mergeStage(prev, stage)),
          onResult: (nextResult) => {
            finalResult = nextResult
            setResult(nextResult)
          },
          onError: (message) => {
            streamError = message
            setError(message)
          },
        },
      )
      await refreshItems(jd.id)
      if (streamError) return onAnalysisError?.(jd, streamError)
      if (finalResult) onAnalysisResult?.(jd, finalResult)
    } catch (err) {
      const message = err instanceof Error ? err.message : '运行分析失败'
      setError(message)
      onAnalysisError?.(activeJd, message)
    } finally {
      setRunning(false)
    }
  }

  async function handleSetDefault(jdId: string) {
    setError(null)
    try {
      const next = await setDefaultJD(jdId)
      await refreshItems(next.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '设置默认 JD 失败')
    }
  }

  async function handleSaveTitle() {
    if (!detailJd) return
    const title = detailTitleDraft.trim()
    if (!title) return setError('JD 名称不能为空')
    setError(null)
    setSaveMessage(null)
    setSavingTitle(true)
    try {
      const updated = await updateJD(detailJd.id, { title })
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setDetailJd(updated)
      setDetailTitleDraft(updated.title)
      setSaveMessage(`已更新 JD 名称：${updated.title}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新 JD 名称失败')
    } finally {
      setSavingTitle(false)
    }
  }

  async function handleSaveResume() {
    setSaveMessage(null)
    setError(null)
    setSavingResume(true)
    try {
      const saved = await saveResumeDraft()
      if (!saved) throw new Error('当前没有可保存的简历草稿')
      onResumeSaved?.(saved)
      setSaveMessage(`已保存简历：${saved.name}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存简历失败')
    } finally {
      setSavingResume(false)
    }
  }

  function handleApplyPatch(patch: JDAnalysisResult['patch_batches'][number]) {
    if (appliedPatchIds.includes(patch.patch_id)) return
    applyPatchDraft({ ...patch, message_id: `jd-patch-${patch.patch_id}` })
    setAppliedPatchIds((prev) => [...prev, patch.patch_id])
  }

  if (!open) return null

  return (
    <>
      <div className="absolute inset-y-0 right-0 z-20 w-full max-w-[440px] border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-blue-500" />
                JD 分析
              </div>
              <p className="mt-1 text-xs text-slate-500">选择已保存 JD，或粘贴岗位链接 / 岗位文本后运行分析</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!resumeId || !resumeData ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-medium text-amber-900">需要先选择一份简历</div>
                <p className="mt-2 text-xs leading-5 text-amber-700">JD 分析会使用当前 AI 助手会话里已加载的简历数据作为输入。</p>
                <button onClick={onRequestResume} className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700">去选择简历</button>
              </div>
            ) : null}

            <JDSavedListCard
              items={items}
              loading={loading}
              selectedJdId={selectedJdId}
              onSelect={setSelectedJdId}
              onView={(item) => { setDetailJd(item); setDetailTitleDraft(item.title) }}
              onSetDefault={(jdId) => void handleSetDefault(jdId)}
            />

            <JDInputCard
              sourceType={sourceType}
              sourceUrl={sourceUrl}
              sourceText={sourceText}
              canSaveJD={canSaveJD}
              canRunAnalysis={canRunAnalysis}
              running={running}
              onSourceTypeChange={setSourceType}
              onSourceUrlChange={(value) => { setSelectedJdId(null); setSourceUrl(value); setResult(null) }}
              onSourceTextChange={(value) => { setSelectedJdId(null); setSourceText(value); setResult(null) }}
              onSave={() => void handleSaveJD()}
              onRun={() => void handleRunAnalysis()}
            />

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800">分析进度</h3>
              <div className="mt-3 space-y-2">
                {stages.map((stage) => (
                  <div key={stage.stage} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-700">{stage.label}</div>
                    <div className={`text-[11px] ${stage.status === 'completed' ? 'text-emerald-600' : stage.status === 'in_progress' ? 'text-blue-600' : stage.status === 'error' ? 'text-red-600' : 'text-slate-400'}`}>{stage.status}</div>
                  </div>
                ))}
              </div>
            </div>

            <JDAnalysisResultTabs
              result={result}
              activeTab={activeTab}
              appliedPatchIds={appliedPatchIds}
              onTabChange={setActiveTab}
              onApplyPatch={handleApplyPatch}
            />
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            {error ? <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}
            {saveMessage ? <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{saveMessage}</div> : null}
            <button onClick={() => void handleSaveResume()} disabled={savingResume || !resumeData} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
              {savingResume ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存简历
            </button>
            <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <Check className="h-3 w-3" />
              Patch 只更新当前草稿，点击这里才会持久化到数据库
            </div>
          </div>
        </div>
      </div>
      <JDRecordDetailDialog
        jd={detailJd}
        open={Boolean(detailJd)}
        titleDraft={detailTitleDraft}
        savingTitle={savingTitle}
        onClose={() => setDetailJd(null)}
        onTitleChange={setDetailTitleDraft}
        onSaveTitle={() => void handleSaveTitle()}
      />
    </>
  )
}
