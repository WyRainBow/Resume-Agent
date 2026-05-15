/**
 * 预览面板组件（第三列）
 * 支持 LaTeX PDF 渲染和 HTML 模板实时预览
 */
import { useState, useRef, useEffect } from 'react'
import { Download, RefreshCw, FileText, Sparkles, Minus, Plus } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { PDFViewerSelector } from '../../../../components/PDFEditor'
import { HTMLTemplateRenderer } from '../HTMLTemplateRenderer'
import type { ResumeData } from '../types'
import type { PDFRenderMode } from '@/services/pdfRenderMode'
import { logPDFRenderModeChange } from '@/services/api'

interface PreviewPanelProps {
  resumeData?: ResumeData
  pdfBlob: Blob | null
  loading: boolean
  progress: string
  autoRenderPending?: boolean
  renderMode?: PDFRenderMode
  canUseRemoteRender?: boolean
  onRenderModeChange?: (mode: PDFRenderMode) => void
  onRender: () => void
  onDownload: () => void
}

export function PreviewPanel({
  resumeData,
  pdfBlob,
  loading,
  progress,
  autoRenderPending = false,
  renderMode = 'local',
  canUseRemoteRender = false,
  onRenderModeChange = () => {},
  onRender,
  onDownload,
}: PreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScale, setAutoScale] = useState(1.0)
  const [userScale, setUserScale] = useState<number | null>(null)
  const [scalePercentInput, setScalePercentInput] = useState('')

  const isHTMLTemplate = resumeData?.templateType === 'html'

  const MIN_SCALE = 0.5
  const MAX_SCALE = 2.5
  const ZOOM_STEP = 0.25
  const effectiveScale = userScale !== null ? userScale : autoScale

  // 根据容器宽度计算「适应宽度」缩放
  useEffect(() => {
    if (!containerRef.current || !pdfBlob || isHTMLTemplate) return
    const updateScale = () => {
      const container = containerRef.current
      if (!container) return
      const containerWidth = container.clientWidth - 16
      const baseWidth = 595
      const newScale = containerWidth / baseWidth
      setAutoScale(Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE)))
    }
    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(containerRef.current)
    window.addEventListener('resize', updateScale)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [pdfBlob, isHTMLTemplate])

  const handleZoomOut = () => {
    const next = Math.max(MIN_SCALE, effectiveScale - ZOOM_STEP)
    setUserScale(next)
    setScalePercentInput('')
  }
  const handleZoomIn = () => {
    const next = Math.min(MAX_SCALE, effectiveScale + ZOOM_STEP)
    setUserScale(next)
    setScalePercentInput('')
  }
  const handleFitWidth = () => {
    setUserScale(null)
    setScalePercentInput('')
  }

  const displayPercent = Math.round(effectiveScale * 100)
  const showStatus = !isHTMLTemplate && (loading || autoRenderPending)
  const statusText = loading
    ? (progress || '正在更新 PDF 预览...')
    : '已记录修改、停止输入 2 秒后更新预览'

  const applyPercentInput = (raw: string) => {
    const n = parseFloat(raw.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(n)) return
    const scale = Math.max(50, Math.min(250, n)) / 100
    setUserScale(scale)
    setScalePercentInput('')
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3',
          'bg-white/70 dark:bg-slate-800/70',
          'backdrop-blur-sm',
          'border-b border-slate-200/50 dark:border-slate-700/50'
        )}
      >
          {/* HTML 模板：仅显示实时预览标签 */}
          {isHTMLTemplate && (
            <span className="px-3 py-1 text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
              实时预览
            </span>
          )}

          {/* LaTeX 模板：仅显示渲染按钮 */}
          {!isHTMLTemplate && (
            <div className="flex items-center gap-3">
              {/* 渲染按钮 */}
              <button
                onClick={onRender}
                disabled={loading}
                className={cn(
                  'group relative px-6 py-2.5 rounded-lg overflow-hidden',
                  'bg-blue-500 text-white text-sm font-bold tracking-tight',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                  'transition-all duration-300',
                  'hover:scale-[1.02] hover:bg-blue-600 shadow-lg shadow-blue-100 dark:shadow-none active:scale-[0.98]',
                  'disabled:hover:scale-100'
                )}
              >
                <span className="relative flex items-center gap-2">
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                  {loading ? '更新中...' : autoRenderPending ? '立即更新 PDF' : '渲染 PDF'}
                </span>
              </button>
              {canUseRemoteRender && (
                <label className="relative">
                  <span className="sr-only">选择 PDF 渲染环境</span>
                  <select
                    value={renderMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as PDFRenderMode
                      console.info('[PDF TRACE][render-mode:change]', {
                        from: renderMode,
                        to: nextMode,
                      })
                      void logPDFRenderModeChange(renderMode, nextMode)
                      onRenderModeChange(nextMode)
                    }}
                    className={cn(
                      'min-w-[120px] rounded-lg border px-4 py-2.5 pr-8 text-sm font-semibold',
                      'bg-white text-slate-700 border-slate-200 shadow-sm',
                      'hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100',
                      'dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:hover:border-slate-500 dark:focus:ring-blue-900/40'
                    )}
                    title="选择 PDF 渲染环境"
                  >
                    <option value="local">本地渲染</option>
                    <option value="remote">远程渲染</option>
                  </select>
                </label>
              )}
            </div>
          )}
      </div>

      {/* 进度提示 */}
      {showStatus && (
        <div className={cn(
          "px-4 py-2.5 text-sm font-medium flex items-center gap-2",
          loading
            ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 text-indigo-600 dark:text-indigo-400 border-b border-indigo-100 dark:border-indigo-800/30"
            : "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/15 dark:to-orange-900/15 text-amber-700 dark:text-amber-300 border-b border-amber-100 dark:border-amber-800/30"
        )}>
          {loading ? (
            <Sparkles className="w-4 h-4 animate-pulse" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {statusText}
        </div>
      )}

      {/* 预览区域：PDF 时仅 PDF 区域滚动，缩放栏固定在底部；HTML/空状态时整区可滚动 */}
      <div
        ref={isHTMLTemplate || !pdfBlob ? containerRef : undefined}
        className={cn(
          'flex-1 p-2 bg-slate-100/80 dark:bg-slate-900/50',
          pdfBlob && !isHTMLTemplate ? 'flex flex-col min-h-0 overflow-hidden' : 'overflow-auto'
        )}
      >
        {isHTMLTemplate ? (
          // HTML 模板：实时预览
          <div className="flex justify-center w-full p-4">
            <HTMLTemplateRenderer resumeData={resumeData!} />
          </div>
        ) : (
          // LaTeX 模板：PDF 预览 + 底部缩放栏（− / 百分比可编辑 / + / 适应宽度）
          <>
            {pdfBlob ? (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-100/80 dark:bg-slate-900/50 overflow-hidden">
                <div
                  ref={containerRef}
                  className="flex-1 min-h-0 overflow-auto p-2"
                >
                  <div className="flex justify-center w-full">
                    <PDFViewerSelector pdfBlob={pdfBlob} scale={effectiveScale} />
                  </div>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-center gap-3 py-2 px-3 shrink-0 flex-wrap',
                    'bg-slate-200/80 dark:bg-slate-700/80',
                    'border-t border-slate-300/50 dark:border-slate-600/50'
                  )}
                >
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={effectiveScale <= MIN_SCALE}
                    className={cn(
                      'p-2 rounded-lg border transition-colors',
                      'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600',
                      'hover:bg-slate-100 dark:hover:bg-slate-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    title="缩小"
                  >
                    <Minus className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={scalePercentInput !== '' ? scalePercentInput : String(displayPercent)}
                    onChange={(e) => setScalePercentInput(e.target.value)}
                    onBlur={() => scalePercentInput !== '' && applyPercentInput(scalePercentInput)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur()
                      }
                    }}
                    className={cn(
                      'w-12 text-sm font-medium text-center rounded border bg-transparent',
                      'border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500',
                      'text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500'
                    )}
                    title="点击输入缩放比例（50–250）"
                  />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">%</span>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={effectiveScale >= MAX_SCALE}
                    className={cn(
                      'p-2 rounded-lg border transition-colors',
                      'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600',
                      'hover:bg-slate-100 dark:hover:bg-slate-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    title="放大"
                  >
                    <Plus className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>
                  {userScale !== null && (
                    <button
                      type="button"
                      onClick={handleFitWidth}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      适应宽度
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                    <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">暂无 PDF 预览</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    填写简历内容后：点击「渲染 PDF」生成预览
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PreviewPanel
