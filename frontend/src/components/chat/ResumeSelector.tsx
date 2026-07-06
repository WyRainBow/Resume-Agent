import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, FilePlus2, FileText, MessageSquare, Upload } from 'lucide-react'
import { getAllResumes } from '@/services/resumeStorage'
import type { SavedResume } from '@/services/storage/StorageAdapter'

interface ResumeSelectorProps {
  onSelect: (resume: SavedResume) => void
  onCreateResume?: () => void
  onImportResume?: () => void
  onFillCreatePrompt?: () => void
  onCancel?: () => void
  onLayoutChange?: () => void
  /** 打开时的初始步骤，默认入口卡片；传 'existing' 直达已有简历列表 */
  initialStep?: 'entry' | 'existing'
}

type SelectorStep = 'entry' | 'existing'
const RESUMES_PER_PAGE = 3

export const ResumeSelector: React.FC<ResumeSelectorProps> = ({
  onSelect,
  onCreateResume,
  onImportResume,
  onFillCreatePrompt,
  onCancel,
  onLayoutChange,
  initialStep = 'entry',
}) => {
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<SelectorStep>(initialStep)
  const [showEmptyResumeDialog, setShowEmptyResumeDialog] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    const loadResumes = async () => {
      try {
        setLoading(true)
        const allResumes = await getAllResumes()
        setResumes(allResumes)
        setError(null)
      } catch (err) {
        console.error('Failed to load resumes:', err)
        setError('加载简历列表失败，请稍后重试。')
      } finally {
        setLoading(false)
      }
    }

    void loadResumes()
  }, [])

  useEffect(() => {
    if (step !== 'existing') return
    if (loading || error) return
    if (resumes.length > 0) return

    // 列表为空时，回到入口并给出明确引导，而不是停留在空白列表页。
    setStep('entry')
    setShowEmptyResumeDialog(true)
  }, [step, loading, error, resumes.length])

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(resumes.length / RESUMES_PER_PAGE)),
    [resumes.length],
  )

  const pagedResumes = useMemo(() => {
    const start = currentPage * RESUMES_PER_PAGE
    return resumes.slice(start, start + RESUMES_PER_PAGE)
  }, [resumes, currentPage])

  useEffect(() => {
    onLayoutChange?.()
  }, [step, loading, resumes.length, error, showEmptyResumeDialog, currentPage, onLayoutChange])

  useEffect(() => {
    setCurrentPage(0)
  }, [step, resumes.length])

  useEffect(() => {
    if (currentPage < totalPages) return
    setCurrentPage(Math.max(0, totalPages - 1))
  }, [currentPage, totalPages])

  const handleSelectExistingClick = () => {
    if (loading || error) {
      setStep('existing')
      return
    }
    if (resumes.length === 0) {
      setShowEmptyResumeDialog(true)
      return
    }
    setStep('existing')
  }

  const noResumeDialog = showEmptyResumeDialog ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="no-resume-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setShowEmptyResumeDialog(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl">
        <h3 id="no-resume-title" className="text-base font-semibold text-slate-900">
          当前没有可用简历
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          还没有检测到已保存简历，是否前往新建简历页面？
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => setShowEmptyResumeDialog(false)}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              setShowEmptyResumeDialog(false)
              onCreateResume?.()
            }}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            去新建简历
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (step === 'entry') {
    return (
      <>
        <div className="my-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 text-balance">开始处理简历</h3>
              <p className="mt-1 text-xs text-slate-400 text-pretty">
                选择一种方式开始：对话创建、导入、新建，或加载已有简历。
              </p>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                取消
              </button>
            )}
          </div>

          {onFillCreatePrompt && (
            <button
              type="button"
              onClick={onFillCreatePrompt}
              className="group/primary relative mb-2.5 flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-violet-50/50 px-4 py-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/60"
            >
              <div className="pointer-events-none absolute -right-5 -top-5 size-24 rounded-full bg-indigo-200/25 blur-2xl transition-colors group-hover/primary:bg-indigo-300/40" />
              <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200/60 transition-transform duration-300 group-hover/primary:scale-105">
                <MessageSquare className="size-5" />
              </div>
              <div className="relative min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-slate-800">对话创建简历</span>
                  <span className="inline-flex items-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">推荐</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">像聊天一样说说经历，我来帮你生成一份</p>
              </div>
              <ChevronRight className="relative size-5 shrink-0 text-indigo-400 transition-transform duration-300 group-hover/primary:translate-x-0.5" />
            </button>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => onImportResume?.()}
              className="group/opt flex flex-col items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-2 py-3.5 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/50"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 transition-colors group-hover/opt:bg-indigo-100">
                <Upload className="size-4" />
              </span>
              <span className="text-xs font-medium text-slate-700">导入简历</span>
            </button>

            <button
              type="button"
              onClick={() => onCreateResume?.()}
              className="group/opt flex flex-col items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-2 py-3.5 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/50"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 transition-colors group-hover/opt:bg-indigo-100">
                <FilePlus2 className="size-4" />
              </span>
              <span className="text-xs font-medium text-slate-700">新建简历</span>
            </button>

            <button
              type="button"
              onClick={handleSelectExistingClick}
              className="group/opt flex flex-col items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-2 py-3.5 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/50"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 transition-colors group-hover/opt:bg-indigo-100">
                <FileText className="size-4" />
              </span>
              <span className="text-xs font-medium text-slate-700">选择已有</span>
            </button>
          </div>
        </div>
        {noResumeDialog}
      </>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 my-4 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 text-indigo-600">
          <div className="size-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">正在加载简历列表...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <>
        <div className="bg-amber-50 rounded-2xl p-6 my-4 shadow-sm border border-amber-100">
          <p className="text-amber-700 text-sm">
            暂时无法读取远端简历列表。你可以先新建简历，或稍后重试。
          </p>
          <div className="mt-4 flex items-center gap-2">
            {onCreateResume && (
              <button
                type="button"
                onClick={onCreateResume}
                className="flex-1 text-sm text-white bg-indigo-600 hover:bg-indigo-700 py-2 rounded-lg transition-colors"
              >
                去新建简历
              </button>
            )}
            <button
              type="button"
              onClick={() => setStep('entry')}
              className="flex-1 text-sm text-slate-600 hover:text-slate-800 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              返回
            </button>
          </div>
        </div>
        {noResumeDialog}
      </>
    )
  }

  if (resumes.length === 0) {
    return (
      <>
        <div className="bg-white rounded-2xl p-6 my-4 shadow-sm border border-slate-200">
        <div className="text-center py-4">
          <div className="mx-auto mb-3 size-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <FileText className="size-5 text-slate-500" />
          </div>
          <p className="text-slate-600 text-sm mb-2">暂无可用简历</p>
          <p className="text-slate-400 text-xs text-pretty">
            请先创建一份简历，再回到 Agent 中加载。
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {onCreateResume && (
            <button
              type="button"
              onClick={onCreateResume}
              className="flex-1 text-sm text-white bg-indigo-600 hover:bg-indigo-700 py-2 rounded-lg transition-colors"
            >
              去创建
            </button>
          )}
          <button
            type="button"
            onClick={() => setStep('entry')}
            className="flex-1 text-sm text-slate-600 hover:text-slate-800 py-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            返回
          </button>
        </div>
        </div>
        {noResumeDialog}
      </>
    )
  }

  return (
    <>
      <div className="bg-white rounded-2xl p-5 my-4 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-indigo-500 flex items-center justify-center shadow-sm">
            <FileText className="size-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 text-balance">选择一份简历</h3>
            <p className="text-xs text-slate-400 text-pretty">
              点击卡片后会在右侧展示 PDF 预览。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
                className="size-7 rounded-md text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="上一页"
                title="上一页"
              >
                <ChevronLeft className="size-4 mx-auto" />
              </button>
              <span className="px-1 text-xs text-slate-500 tabular-nums">
                {currentPage + 1}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
                }
                disabled={currentPage >= totalPages - 1}
                className="size-7 rounded-md text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="下一页"
                title="下一页"
              >
                <ChevronRight className="size-4 mx-auto" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setStep('entry')}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            返回
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pb-1">
          {pagedResumes.map((resume) => (
            <button
              key={resume.id}
              type="button"
              onClick={() => onSelect(resume)}
              className="group/card relative flex flex-col items-center overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 text-center cursor-pointer shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50"
            >
              {/* 背景装饰 */}
              <div className="pointer-events-none absolute -right-3 -top-3 size-16 rounded-full bg-indigo-100/30 blur-2xl transition-colors group-hover/card:bg-indigo-200/50" />

              <div className="mb-2.5 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200/60 transition-transform duration-300 group-hover/card:scale-105">
                <FileText className="size-5" />
              </div>

              <h4 className="w-full truncate text-sm font-bold text-slate-800 transition-colors group-hover/card:text-indigo-600">
                {resume.name || '未命名简历'}
              </h4>

              <div className="mt-1 flex min-h-[18px] items-center justify-center">
                {resume.alias && resume.alias.trim() !== '' ? (
                  <span className="inline-flex items-center rounded-md border border-indigo-100/50 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                    {resume.alias.trim()}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">简历</span>
                )}
              </div>

              <div className="mt-2.5 w-full border-t border-slate-100 pt-2">
                <p className="text-[10px] tabular-nums text-slate-400">
                  更新于 {formatDate(resume.updatedAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-400 tabular-nums">共 {resumes.length} 份简历可选</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={`page-dot-${idx}`}
                type="button"
                onClick={() => setCurrentPage(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentPage ? 'w-4 bg-indigo-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`第 ${idx + 1} 页`}
                title={`第 ${idx + 1} 页`}
              />
            ))}
          </div>
        )}
      </div>
      </div>
      {noResumeDialog}
    </>
  )
}

export default ResumeSelector
