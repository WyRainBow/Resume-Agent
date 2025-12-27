/**
 * PDF 操作 Hook
 */
import { useState, useCallback } from 'react'
import { saveAs } from 'file-saver'
import html2pdf from 'html2pdf.js'
import { renderPDFStream } from '../../../../services/api'
import { saveResume, setCurrentResumeId } from '../../../../services/resumeStorage'
import { convertToBackendFormat } from '../utils/convertToBackend'
import { generateHTMLFile } from '../utils/generateHTML'
import type { ResumeData } from '../types'

interface UsePDFOperationsProps {
  resumeData: ResumeData
  currentResumeId: string | null
  setCurrentId: (id: string | null) => void
}

export function usePDFOperations({ resumeData, currentResumeId, setCurrentId }: UsePDFOperationsProps) {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 渲染 PDF
  const handleRender = useCallback(async () => {
    setLoading(true)
    setProgress('正在准备数据...')

    try {
      const backendData = convertToBackendFormat(resumeData)
      setProgress('正在渲染 PDF...')

      const blob = await renderPDFStream(
        backendData as any,
        backendData.sectionOrder,
        (p) => setProgress(p),
        () => setProgress('渲染完成！'),
        (err) => setProgress(`错误: ${err}`)
      )

      setPdfBlob(blob)
      setProgress('')
    } catch (error) {
      console.error('PDF 渲染失败:', error)
      setProgress(`渲染失败: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [resumeData])

  // 下载 PDF
  const handleDownload = useCallback(() => {
    if (!pdfBlob) return

    const name = resumeData.basic.name || '简历'
    const date = new Date().toISOString().split('T')[0]
    const filename = `${name}_简历_${date}.pdf`

    const file = new File([pdfBlob], filename, { type: 'application/pdf' })
    saveAs(file, filename)
  }, [pdfBlob, resumeData.basic.name])

  // 下载 HTML 为 PDF
  const handleDownloadHTML = useCallback(async () => {
    setLoading(true)
    setProgress('正在生成 PDF...')

    try {
      const htmlContent = generateHTMLFile(resumeData)
      const name = resumeData.basic.name || '简历'
      const date = new Date().toISOString().split('T')[0]
      const filename = `${name}_简历_${date}.pdf`

      // 使用 DOMParser 解析完整的 HTML 文档
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, 'text/html')
      
      // 创建临时容器并隐藏
      const tempDiv = document.createElement('div')
      tempDiv.style.position = 'absolute'
      tempDiv.style.left = '-9999px'
      tempDiv.style.top = '-9999px'
      tempDiv.style.width = '850px' // 匹配 HTML 容器的 max-width
      tempDiv.style.backgroundColor = 'white'
      
      // 将解析后的 body 内容复制到临时容器
      if (doc.body) {
        // 复制所有样式（从 head 中的 style 标签）
        const styles = doc.head.querySelectorAll('style')
        styles.forEach(style => {
          const styleElement = document.createElement('style')
          styleElement.textContent = style.textContent
          tempDiv.appendChild(styleElement)
        })
        
        // 复制 body 内容
        while (doc.body.firstChild) {
          tempDiv.appendChild(doc.body.firstChild.cloneNode(true))
        }
      } else {
        // 如果解析失败，直接使用 innerHTML
        tempDiv.innerHTML = htmlContent
      }
      
      document.body.appendChild(tempDiv)

      // 等待内容渲染和样式应用
      await new Promise(resolve => setTimeout(resolve, 200))

      // 获取要转换的元素
      const element = tempDiv.querySelector('.html-template-container') || tempDiv

      // 配置 html2pdf 选项
      const opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 850,
          backgroundColor: '#ffffff',
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
        },
      }

      // 转换为 PDF 并下载
      await html2pdf().set(opt).from(element).save()

      // 清理临时元素
      document.body.removeChild(tempDiv)
      
      setProgress('')
    } catch (error) {
      console.error('HTML 转 PDF 失败:', error)
      setProgress(`转换失败: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [resumeData])

  // 保存到 Dashboard
  const handleSaveToDashboard = useCallback(() => {
    const resumeToSave = {
      name: resumeData.basic.name || '未命名简历',
      basic: resumeData.basic,
      education: resumeData.education,
      experience: resumeData.experience,
      projects: resumeData.projects,
      skills: resumeData.skillContent ? [{ category: '技能', details: resumeData.skillContent }] : [],
    }
    
    const saved = saveResume(resumeToSave as any, currentResumeId || undefined)
    
    if (!currentResumeId) {
      setCurrentId(saved.id)
      setCurrentResumeId(saved.id)
    }
    
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }, [resumeData, currentResumeId, setCurrentId])

  return {
    pdfBlob,
    loading,
    progress,
    saveSuccess,
    handleRender,
    handleDownload,
    handleDownloadHTML,
    handleSaveToDashboard,
  }
}

