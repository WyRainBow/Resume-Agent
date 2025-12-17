/**
 * 预览面板组件（第三列）
 * 显示 PDF 渲染结果
 */
import { useState } from 'react'
import { ZoomIn, ZoomOut, Download, RefreshCw, Maximize2 } from 'lucide-react'
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
    <div className="h-full flex flex-col bg-gray-100 dark:bg-neutral-900">
      {/* 工具栏 */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 border-b',
          'bg-white border-gray-200',
          'dark:bg-neutral-800 dark:border-neutral-700'
        )}
      >
        <div className="flex items-center gap-2">
          {/* 渲染按钮 */}
          <button
            onClick={onRender}
            disabled={loading}
            className={cn(
              'px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium',
              'bg-primary text-white hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            {loading ? '渲染中...' : '渲染 PDF'}
          </button>

          {/* 下载按钮 */}
          <button
            onClick={onDownload}
            disabled={!pdfBlob || loading}
            className={cn(
              'px-3 py-2 rounded-lg flex items-center gap-2 text-sm',
              'bg-gray-100 text-gray-700 hover:bg-gray-200',
              'dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Download className="w-4 h-4" />
            下载
          </button>
        </div>

        {/* 缩放控制 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-neutral-400 min-w-[4ch] text-center">
            {zoom}%
          </span>
          <button
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(100)}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 进度提示 */}
      {loading && progress && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm">
          {progress}
        </div>
      )}

      {/* PDF 预览区域 */}
      <div className="flex-1 overflow-auto p-4">
        {pdfBlob ? (
          <div
            className="mx-auto bg-white shadow-lg"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
          >
            <PDFViewerSelector pdfBlob={pdfBlob} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-400 dark:text-neutral-500">
              <p className="text-lg mb-2">暂无 PDF</p>
              <p className="text-sm">点击「渲染 PDF」按钮生成简历</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PreviewPanel


