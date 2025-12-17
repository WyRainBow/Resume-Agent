/**
 * 预览面板组件（第三列）
 * 显示 PDF 渲染结果
 */
import { useState } from 'react'
import { ZoomIn, ZoomOut, Download, RefreshCw, Maximize2, FileText, Sparkles } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { PDFViewerSelector } from '../../../../components/PDFEditor'

interface PreviewPanelProps {
  pdfBlob: Blob | null
  loading: boolean
  progress: string
  onRender: () => void
  onDownload: () => void
}

export function PreviewPanel({
  pdfBlob,
  loading,
  progress,
  onRender,
  onDownload,
}: PreviewPanelProps) {
  const [zoom, setZoom] = useState(100)

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
        <div className="flex items-center gap-3">
          {/* 渲染按钮 */}
          <button
            onClick={onRender}
            disabled={loading}
            className={cn(
              'group relative px-5 py-2.5 rounded-xl overflow-hidden',
              'bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400',
              'hover:from-cyan-300 hover:via-blue-300 hover:to-indigo-300',
              'text-white text-sm font-semibold',
              'shadow-lg shadow-blue-300/40 hover:shadow-xl hover:shadow-blue-300/50',
              'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-lg',
              'transition-all duration-300',
              'hover:scale-[1.02] active:scale-[0.98]',
              'disabled:hover:scale-100'
            )}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <span className="relative flex items-center gap-2">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              {loading ? '渲染中...' : '渲染 PDF'}
            </span>
          </button>

          {/* 下载按钮 */}
          <button
            onClick={onDownload}
            disabled={!pdfBlob || loading}
            className={cn(
              'px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium',
              'bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm',
              'border border-slate-200/80 dark:border-slate-600/80',
              'text-slate-700 dark:text-slate-200',
              'hover:bg-white dark:hover:bg-slate-700',
              'hover:border-slate-300 dark:hover:border-slate-500',
              'shadow-sm hover:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200',
              'hover:scale-[1.02] active:scale-[0.98]',
              'disabled:hover:scale-100'
            )}
          >
            <Download className="w-4 h-4" />
            下载
          </button>
        </div>

        {/* 缩放控制 */}
        <div className="flex items-center gap-1 bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm rounded-xl px-2 py-1 border border-slate-200/50 dark:border-slate-600/50">
          <button
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-300"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300 min-w-[4ch] text-center tabular-nums">
            {zoom}%
          </span>
          <button
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-300"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
          <button
            onClick={() => setZoom(100)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-300"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 进度提示 */}
      {loading && progress && (
        <div className={cn(
          "px-4 py-2.5 text-sm font-medium flex items-center gap-2",
          "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20",
          "text-indigo-600 dark:text-indigo-400",
          "border-b border-indigo-100 dark:border-indigo-800/30"
        )}>
          <Sparkles className="w-4 h-4 animate-pulse" />
          {progress}
        </div>
      )}

      {/* PDF 预览区域 */}
      <div className="flex-1 overflow-auto p-6">
        {pdfBlob ? (
          <div
            className={cn(
              "mx-auto bg-white rounded-lg overflow-hidden",
              "shadow-2xl shadow-slate-300/50 dark:shadow-slate-900/50",
              "ring-1 ring-slate-200/50 dark:ring-slate-700/50"
            )}
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
          >
            <PDFViewerSelector pdfBlob={pdfBlob} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">暂无 PDF 预览</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                填写简历内容后：点击「渲染 PDF」生成预览
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PreviewPanel


