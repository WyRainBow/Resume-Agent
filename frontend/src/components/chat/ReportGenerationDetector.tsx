/**
 * ReportGenerationDetector - 报告生成检测组件
 * 
 * 在流式输出过程中检测报告生成，避免重复创建
 */
import { useEffect, useRef } from 'react'
import { createReport } from '@/services/api'

interface ReportGenerationDetectorProps {
  content: string
  onReportCreated: (reportId: string, title: string) => void
}

export function ReportGenerationDetector({ 
  content, 
  onReportCreated 
}: ReportGenerationDetectorProps) {
  const processedRef = useRef(false)
  const lastProcessedLength = useRef(0)

  useEffect(() => {
    // 只在内容长度显著增加时检测（避免频繁检测）
    if (content.length - lastProcessedLength.current < 200) {
      return
    }
    lastProcessedLength.current = content.length

    // 如果已经处理过，不再处理
    if (processedRef.current) {
      return
    }

    // 检测报告生成的关键词和模式
    const reportPatterns = [
      /(?:生成|创建|完成)(?:了)?(?:一份|一个)?(?:关于|的)?([^"《\n]+)(?:的|"|》)?(?:详细|完整|研究|调研)?报告/,
      /^#+\s*(.+?)(?:报告|调研|研究)/m,
    ]

    let reportTopic = ''
    for (const pattern of reportPatterns) {
      const match = content.match(pattern)
      if (match && match[1]) {
        reportTopic = match[1].trim()
        if (reportTopic.length > 5 && reportTopic.length < 100) {
          break
        }
      }
    }

    // 如果内容很长且包含报告结构，尝试提取标题
    if (!reportTopic && content.length > 1000) {
      const titleMatch = content.match(/^#+\s*(.+?)$/m)
      if (titleMatch) {
        reportTopic = titleMatch[1].trim().substring(0, 50)
      }
    }

    if (reportTopic && reportTopic.length > 5) {
      processedRef.current = true
      
      // 创建报告
      createReport(reportTopic)
        .then(result => {
          // 保存报告内容
          if (result.mainId) {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000'
            return fetch(`${API_BASE}/api/documents/${result.mainId}/content`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content })
            }).then(() => result)
          }
          return result
        })
        .then(result => {
          onReportCreated(result.reportId, reportTopic)
        })
        .catch(err => {
          console.error('[ReportGenerationDetector] 创建报告失败:', err)
          processedRef.current = false // 允许重试
        })
    }
  }, [content, onReportCreated])

  return null
}
