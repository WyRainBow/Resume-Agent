/**
 * 导出按钮组件
 * 支持 PDF、JSON 导出和分享链接生成
 * 优化后的现代化样式
 */
import { useState, useRef, useEffect } from 'react'
import { Download, FileJson, Share2, ChevronDown, Copy, Check, FileText } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { getApiBaseUrl } from '@/lib/runtimeEnv'

interface ExportButtonProps {
  resumeData: Record<string, any>
  resumeName?: string
  onExportJSON?: () => void
  pdfBlob?: Blob | null
  onDownloadPDF?: () => void
}

export function ExportButton({ 
  resumeData, 
  resumeName = '我的简历', 
  onExportJSON,
  pdfBlob,
  onDownloadPDF,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [shareEnabled, setShareEnabled] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 导出 PDF - 仅用于 LaTeX 模板
  const handleExportPDF = () => {
    setIsOpen(false)
    
    // LaTeX 模板：需要先渲染 PDF
    if (pdfBlob && onDownloadPDF) {
      onDownloadPDF()
      return
    }
    
    // 如果没有 pdfBlob，提示用户先渲染 PDF
    if (!pdfBlob) {
      alert('请先点击"渲染 PDF"按钮生成 PDF，然后再下载')
    }
  }

  // 导出 JSON
  const handleExportJSONClick = () => {
    if (onExportJSON) {
      onExportJSON()
    } else {
      // 默认的 JSON 导出逻辑
      try {
        const jsonString = JSON.stringify(resumeData, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${resumeName}-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('导出 JSON 失败:', error)
        alert('导出失败，请重试')
      }
    }
    setIsOpen(false)
  }

  // 切换分享开关
  const handleToggleShare = async () => {
    if (!shareEnabled) {
      // 开启分享，生成链接
      try {
        setIsExporting(true)
        const apiBase = getApiBaseUrl()
        const url = apiBase ? `${apiBase}/api/resume/share` : `/api/resume/share`

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resume_data: resumeData,
            resume_name: resumeName,
            expire_days: 30,
          }),
        })

        if (!response.ok) {
          throw new Error('生成分享链接失败')
        }

        const { share_url } = await response.json()
        setShareUrl(share_url)
        setShareEnabled(true)
      } catch (error) {
        console.error('生成分享链接失败:', error)
        alert('生成分享链接失败，请重试')
      } finally {
        setIsExporting(false)
      }
    } else {
      // 关闭分享
      setShareEnabled(false)
      setShareUrl('')
    }
  }

  // 复制分享链接（支持 HTTP 环境）
  const handleCopyLink = async () => {
    if (shareUrl) {
      try {
        // 优先使用 Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(shareUrl)
        } else {
          // 备用方案：使用临时文本框
          const textArea = document.createElement('textarea')
          textArea.value = shareUrl
          textArea.style.position = 'fixed'
          textArea.style.left = '-9999px'
          textArea.style.top = '-9999px'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('复制失败:', error)
        // 显示链接让用户手动复制
        prompt('请手动复制分享链接:', shareUrl)
      }
    }
  }

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      {/* 导出按钮 - 优化后的样式 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className={cn(
          "px-4 py-2.5 rounded-xl",
          "bg-slate-900 hover:bg-slate-800 active:bg-slate-950",
          "dark:bg-slate-100 dark:hover:bg-white dark:active:bg-slate-200",
          "text-white dark:text-slate-900 text-sm font-semibold",
          "transition-all duration-200 ease-out",
          "flex items-center gap-2",
          "shadow-md hover:shadow-lg",
          "border border-slate-800 dark:border-slate-200",
          isExporting && "opacity-50 cursor-not-allowed",
          isOpen && "bg-slate-800 dark:bg-white"
        )}
      >
        <Download className="w-4 h-4" strokeWidth={2.5} />
        <span>导出</span>
        <ChevronDown 
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-200", 
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {/* 下拉菜单 - 优化后的卡片式设计 */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden z-50 backdrop-blur-sm">
          {/* PDF 导出卡片 - 仅对 LaTeX 模板显示 */}
          {resumeData?.templateType !== 'html' && (
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className={cn(
                "w-full px-5 py-4 text-left",
                "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                "transition-all duration-150",
                "flex items-center gap-4",
                "border-b border-slate-100 dark:border-slate-700/50",
                "group",
                isExporting && "opacity-50 cursor-not-allowed",
                !pdfBlob && "opacity-60"
              )}
            >
              {/* PDF 图标 */}
              <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-6 h-6 text-red-600 dark:text-red-400" strokeWidth={2} />
              </div>
              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                  导出 PDF
                </div>
                {!pdfBlob && (
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    需要先渲染 PDF
                  </div>
                )}
              </div>
            </button>
          )}

          {/* JSON 导出卡片 */}
          <button
            onClick={handleExportJSONClick}
            disabled={isExporting}
            className={cn(
              "w-full px-5 py-4 text-left",
              "hover:bg-slate-50 dark:hover:bg-slate-700/50",
              "transition-all duration-150",
              "flex items-center gap-4",
              "border-b border-slate-100 dark:border-slate-700/50",
              "group",
              isExporting && "opacity-50 cursor-not-allowed"
            )}
          >
            {/* JSON 图标 */}
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <FileJson className="w-6 h-6 text-blue-600 dark:text-blue-400" strokeWidth={2} />
            </div>
            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-base mb-1">
                JSON
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                下载 JSON 格式的简历快照。用于备份简历数据。
              </div>
            </div>
          </button>

          {/* 分享链接卡片 */}
          <div className="px-5 py-4 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-start gap-4 mb-4">
              {/* 开关 */}
              <button
                onClick={handleToggleShare}
                disabled={isExporting}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0 mt-0.5",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  shareEnabled 
                    ? "bg-slate-900 dark:bg-slate-100 shadow-inner" 
                    : "bg-slate-300 dark:bg-slate-600",
                  isExporting && "opacity-50 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-900 rounded-full",
                    "transition-all duration-200 ease-out",
                    "shadow-sm",
                    shareEnabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-slate-100 text-base mb-1">
                  通过链接分享
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  任何人都可以通过此链接查看简历。
                </div>
              </div>
            </div>

            {/* 链接输入框（仅在分享开启时显示） */}
            {shareEnabled && shareUrl && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">链接</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className={cn(
                      "flex-1 px-3 py-2 text-sm",
                      "bg-white dark:bg-slate-700",
                      "border border-slate-200 dark:border-slate-600",
                      "rounded-lg text-slate-900 dark:text-slate-100",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      "transition-all"
                    )}
                  />
                  <button
                    onClick={handleCopyLink}
                    className={cn(
                      "px-3 py-2 rounded-lg",
                      "bg-white dark:bg-slate-700",
                      "border border-slate-200 dark:border-slate-600",
                      "hover:bg-slate-50 dark:hover:bg-slate-600",
                      "transition-colors",
                      "flex items-center justify-center",
                      copied && "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                    )}
                    title="复制链接"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
