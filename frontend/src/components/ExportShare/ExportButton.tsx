import { Download, Share2, FileJson } from 'lucide-react'
import { useState } from 'react'
import { generatePDFFromJSON } from './pdfGenerator'
import { useToast } from '../../hooks/useToast'

interface ExportButtonProps {
  resumeData: Record<string, any>
  resumeName: string
}

export function ExportButton({ resumeData, resumeName }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const { showToast } = useToast()

  const handleExportPDF = async () => {
    try {
      setIsExporting(true)
      await generatePDFFromJSON(resumeData, resumeName)
      showToast('PDF 导出成功！', 'success')
    } catch (error) {
      console.error('PDF 导出失败:', error)
      showToast('PDF 导出失败，请重试', 'error')
    } finally {
      setIsExporting(false)
      setIsOpen(false)
    }
  }

  const handleExportJSON = () => {
    try {
      const jsonString = JSON.stringify(resumeData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${resumeName}-data.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      showToast('JSON 导出成功！', 'success')
      setIsOpen(false)
    } catch (error) {
      console.error('JSON 导出失败:', error)
      showToast('JSON 导出失败，请重试', 'error')
    }
  }

  const handleShare = async () => {
    try {
      setIsExporting(true)
      // 调用后端 API 生成分享链接
      const response = await fetch('/api/resume/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume_data: resumeData,
          resume_name: resumeName,
        }),
      })

      if (!response.ok) {
        throw new Error('生成分享链接失败')
      }

      const { share_url } = await response.json()
      
      // 复制到剪贴板
      await navigator.clipboard.writeText(share_url)
      showToast('分享链接已复制到剪贴板！', 'success')
      setIsOpen(false)
    } catch (error) {
      console.error('生成分享链接失败:', error)
      showToast('生成分享链接失败，请重试', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="relative inline-block">
      {/* 导出按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        导出
        <span className="text-xs ml-1">▼</span>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-50">
          {/* PDF 导出 */}
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-100 disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 3a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V16a2 2 0 01-2 2H6a2 2 0 01-2-2V3zm6 0h2v4H10V3z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-gray-900">下载 PDF</div>
              <div className="text-xs text-gray-500">用于打印、发送给招聘人员</div>
            </div>
          </button>

          {/* JSON 导出 */}
          <button
            onClick={handleExportJSON}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-100"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileJson className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900">下载 JSON</div>
              <div className="text-xs text-gray-500">用于备份简历数据</div>
            </div>
          </button>

          {/* 分享链接 */}
          <button
            onClick={handleShare}
            disabled={isExporting}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Share2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900">生成分享链接</div>
              <div className="text-xs text-gray-500">任何人都可以通过链接查看</div>
            </div>
          </button>
        </div>
      )}

      {/* 点击外部关闭菜单 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

