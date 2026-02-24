import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, FilePlus2, FileText } from 'lucide-react'
import { getAllResumes } from '@/services/resumeStorage'
import type { SavedResume } from '@/services/storage/StorageAdapter'

interface ResumeSelectorProps {
  onSelect: (resume: SavedResume) => void
  onCreateResume?: () => void
  onCancel?: () => void
  onLayoutChange?: () => void
}

type SelectorStep = 'entry' | 'existing'
const RESUMES_PER_PAGE = 3

export const ResumeSelector: React.FC<ResumeSelectorProps> = ({
  onSelect,
  onCreateResume,
  onCancel,
  onLayoutChange,
}) => {
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<SelectorStep>('entry')
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
        <div className="bg-white rounded-2xl p-5 my-4 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 text-balance">加载简历</h3>
              <p className="text-xs text-slate-400 mt-1 text-pretty">
                请选择下一步：创建新简历，或从已有简历中选择。
              </p>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onCreateResume?.()}
              className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FilePlus2 className="size-4 text-indigo-500" />
                <span className="text-sm font-medium text-slate-800">创建一份简历</span>
              </div>
              <p className="text-xs text-slate-500 mt-2 text-pretty">
                跳转到编辑区创建并完善新简历。
              </p>
            </button>

            <button
              type="button"
              onClick={handleSelectExistingClick}
              className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-indigo-500" />
                <span className="text-sm font-medium text-slate-800">选择已有简历</span>
              </div>
              <p className="text-xs text-slate-500 mt-2 text-pretty">
                从已保存简历中选择并加载到当前对话。
              </p>
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
              className="group/card flex-shrink-0 bg-white rounded-xl p-3.5 shadow-sm border border-slate-200/60 text-center cursor-pointer hover:shadow-md hover:border-indigo-300 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center relative overflow-hidden"
            >
              {/* 背景装饰 */}
              <div className="absolute -right-2 -top-2 size-12 bg-indigo-50/30 rounded-full blur-2xl group-hover/card:bg-indigo-100/50 transition-colors" />
              
              <div className="size-8 rounded-lg bg-slate-50 group-hover/card:bg-indigo-50 flex items-center justify-center mb-2 transition-colors shadow-sm border border-slate-100 group-hover/card:border-indigo-100">
                <FileText className="size-4.5 text-slate-400 group-hover/card:text-indigo-500 transition-colors" />
              </div>

              <h4 className="w-full text-[13px] font-semibold text-slate-800 truncate mb-1 text-center group-hover/card:text-indigo-600 transition-colors">
                {resume.name || '未命名简历'}
              </h4>

              <div className="flex flex-col items-center gap-1 min-h-[20px] justify-center">
                {resume.alias && resume.alias.trim() !== '' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100/50">
                    {resume.alias.trim()}
                  </span>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-50 w-full">
                <p className="text-[10px] text-slate-400 tabular-nums text-center">
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
