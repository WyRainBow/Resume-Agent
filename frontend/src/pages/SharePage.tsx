import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Copy, Check, ZoomIn, ZoomOut, Maximize2, FileText, Eye, Calendar, RefreshCw } from 'lucide-react'
import { cn } from '../lib/utils'
import { PDFViewerSelector } from '../components/PDFEditor'
import { renderPDFStream } from '../services/api'
import { convertToBackendFormat } from './Workspace/v2/utils/convertToBackend'
import { saveAs } from 'file-saver'
import type { ResumeData } from './Workspace/v2/types'

interface SharedResume {
  success: boolean
  data: ResumeData
  name: string
  expires_at: string
  views: number
}

export default function SharePage() {
  const { shareId } = useParams<{ shareId: string }>()
  const [resume, setResume] = useState<SharedResume | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfProgress, setPdfProgress] = useState('')
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    const fetchSharedResume = async () => {
      try {
        // 获取 API 基础 URL
        const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || ''
        let API_BASE = ''
        
        if (rawApiBase) {
          API_BASE = rawApiBase.startsWith('http') ? rawApiBase : `https://${rawApiBase}`
        } else {
          // 如果没有配置，根据当前环境判断
          if (import.meta.env.PROD) {
            API_BASE = '' // 生产环境使用相对路径，由代理处理
          } else {
            API_BASE = 'http://localhost:8000' // 开发环境
          }
        }
        
        const response = await fetch(`${API_BASE}/api/resume/share/${shareId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('分享链接不存在或已过期')
          } else {
            setError('获取简历失败')
          }
          return
        }

        const data = await response.json()
        setResume(data)
      } catch (err) {
        console.error('获取分享简历失败:', err)
        setError('获取简历失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }

    if (shareId) {
      fetchSharedResume()
    }
  }, [shareId])

  // 使用正确的 API 渲染 PDF
  const handleRenderPDF = useCallback(async () => {
    if (!resume?.data) return
    
    setPdfLoading(true)
    setPdfProgress('正在准备数据...')
    
    try {
      // 使用 convertToBackendFormat 转换数据格式
      const backendData = convertToBackendFormat(resume.data)
      setPdfProgress('正在渲染 PDF...')
      
      // 使用 renderPDFStream 渲染 PDF
      const blob = await renderPDFStream(
        backendData as any,
        backendData.sectionOrder,
        (p) => setPdfProgress(p),
        () => setPdfProgress('渲染完成！'),
        (err) => setPdfProgress(`错误: ${err}`)
      )
      
      setPdfBlob(blob)
      setPdfProgress('')
    } catch (error) {
      console.error('渲染 PDF 失败:', error)
      setPdfProgress(`渲染失败: ${(error as Error).message}`)
    } finally {
      setPdfLoading(false)
    }
  }, [resume?.data])

  // 页面加载时自动渲染 PDF
  useEffect(() => {
    if (resume?.data && !pdfBlob && !pdfLoading) {
      const timer = setTimeout(() => {
        handleRenderPDF()
      }, 300) // 延迟300ms确保页面完全加载
      return () => clearTimeout(timer)
    }
  }, [resume?.data]) // 只依赖 resume?.data，避免重复渲染

  const handleDownloadPDF = useCallback(() => {
    if (!pdfBlob || !resume) return
    
    const name = resume.name || '简历'
    const date = new Date().toISOString().split('T')[0]
    const filename = `${name}_简历_${date}.pdf`
    
    const file = new File([pdfBlob], filename, { type: 'application/pdf' })
    saveAs(file, filename)
  }, [pdfBlob, resume])

  const handleCopyLink = async () => {
    const currentUrl = window.location.href
    try {
      await navigator.clipboard.writeText(currentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('复制失败:', error)
      alert('复制失败，请重试')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载简历...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">出错了</h2>
          <p className="text-slate-600 dark:text-slate-300">{error}</p>
        </div>
      </div>
    )
  }

  if (!resume) {
    return null
  }

  return (
    <div className={cn(
      'w-full h-screen flex flex-col',
      'bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950'
    )}>
      {/* 顶部工具栏 */}
      <div
        className={cn(
          'flex items-center justify-between px-6 py-4',
          'bg-white/70 dark:bg-slate-800/70',
          'backdrop-blur-md',
          'border-b border-slate-200/50 dark:border-slate-700/50',
          'shadow-sm'
        )}
      >
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{resume.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {resume.views} 次查看
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              到期: {new Date(resume.expires_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 复制链接按钮 */}
          <button
            onClick={handleCopyLink}
            className={cn(
              'px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium',
              'transition-all duration-200',
              copied
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-600/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 shadow-sm hover:shadow-md'
            )}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制链接
              </>
            )}
          </button>

          {/* 下载 PDF 按钮 */}
          <button
            onClick={handleDownloadPDF}
            disabled={!pdfBlob || pdfLoading}
            className={cn(
              'px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium',
              'bg-blue-600 text-white',
              'hover:bg-blue-700',
              'shadow-sm hover:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200',
              'hover:scale-[1.02] active:scale-[0.98]',
              'disabled:hover:scale-100'
            )}
          >
            <Download className="w-4 h-4" />
            下载 PDF
          </button>
        </div>
      </div>

      {/* PDF 预览区域 - 直接复制 PreviewPanel 的样式 */}
      <div className="flex-1 overflow-auto p-4 bg-slate-100 dark:bg-slate-900/50 flex flex-col">
        {/* 缩放控制 */}
        <div className="flex justify-center mb-4">
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

        {/* PDF 内容 */}
        <div className="flex-1 overflow-auto flex justify-center">
          {pdfBlob ? (
            <div
              style={{
                width: 'fit-content',
                maxWidth: '100%',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
            >
              <PDFViewerSelector pdfBlob={pdfBlob} scale={1.0} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                {pdfLoading ? (
                  <>
                    <RefreshCw className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
                    <p className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">
                      {pdfProgress || '正在生成 PDF 预览...'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                      <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">
                      {pdfProgress || '正在准备 PDF 预览'}
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      请稍候...
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
