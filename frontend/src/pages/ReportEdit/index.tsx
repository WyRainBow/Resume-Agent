/**
 * 报告编辑页面
 * 自动发送 pendingPrompt，实时显示流式内容，保存到数据库
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCLTP } from '@/hooks/useCLTP'
import { useTextStream } from '@/hooks/useTextStream'
import EnhancedMarkdown from '@/components/chat/EnhancedMarkdown'
import { 
  getReport, 
  ensureReportConversation, 
  getDocumentContent,
  updateDocumentContent 
} from '@/services/api'
import { useReportStore } from '@/stores/reportStore'
import type { ReportDetail } from '@/services/api'

export default function ReportEdit() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null)
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [hasSentInitialPrompt, setHasSentInitialPrompt] = useState(false)
  const [isAgentRunning, setIsAgentRunning] = useState(false)
  
  const pendingPromptRef = useRef<string | null>(null)
  const lastSavedContentRef = useRef('')
  const hasHistoryRef = useRef(false)

  // 获取 pendingPrompt
  const pendingPrompt = useReportStore.getPendingPrompt()

  // 初始化 CLTP
  const {
    currentAnswer,
    isProcessing,
    isConnected,
    sendMessage,
    finalizeStream,
  } = useCLTP({
    conversationId: conversationId || undefined,
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000',
  })

  // 加载报告详情
  useEffect(() => {
    if (!reportId) {
      setError('报告 ID 不存在')
      setIsLoading(false)
      return
    }

    const loadReport = async () => {
      try {
        const report = await getReport(reportId)
        setReportDetail(report)
        
        // 确保有对话关联
        const convResult = await ensureReportConversation(reportId)
        setConversationId(convResult.conversation_id)
        
        // 加载文档内容
        if (report.main_id) {
          const docContent = await getDocumentContent(report.main_id)
          setContent(docContent.content || '')
          lastSavedContentRef.current = docContent.content || ''
        }
        
        // 检查是否有历史消息（通过 sessionStorage）
        const key = `autoSendReportPrompt:${convResult.conversation_id}`
        const alreadySent = sessionStorage.getItem(key) === '1'
        if (alreadySent) {
          hasHistoryRef.current = true
        }
        
        setIsLoading(false)
      } catch (err) {
        console.error('加载报告失败:', err)
        setError(err instanceof Error ? err.message : '加载报告失败')
        setIsLoading(false)
      }
    }

    loadReport()
  }, [reportId])

  // 保存 pendingPrompt 到 ref
  useEffect(() => {
    if (pendingPrompt) {
      console.log('[ReportEdit] 获取到 pendingPrompt:', pendingPrompt.substring(0, 50) + '...')
      pendingPromptRef.current = pendingPrompt
    } else {
      console.log('[ReportEdit] 没有 pendingPrompt')
      // 如果没有 pendingPrompt，尝试从 sessionStorage 恢复
      const stored = sessionStorage.getItem('report-pending-prompt')
      if (stored) {
        console.log('[ReportEdit] 从 sessionStorage 恢复 pendingPrompt')
        pendingPromptRef.current = stored
      }
    }
  }, [pendingPrompt])

  // 自动发送 pendingPrompt
  // 注意：SSE 连接是在 sendMessage() 调用时建立的，不需要等待 isConnected
  useEffect(() => {
    if (!conversationId || hasSentInitialPrompt || hasHistoryRef.current) {
      return
    }

    const initialPrompt = pendingPromptRef.current
    if (!initialPrompt) {
      console.log('[ReportEdit] 没有 pendingPrompt，跳过自动发送')
      return
    }

    const sendPendingPrompt = async () => {
      try {
        // 检查是否已发送过
        const key = `autoSendReportPrompt:${conversationId}`
        const alreadySent = sessionStorage.getItem(key) === '1'
        if (alreadySent) {
          console.log('[ReportEdit] Prompt 已发送过，跳过')
          hasHistoryRef.current = true
          return
        }

        console.log('[ReportEdit] 准备发送 prompt:', initialPrompt.substring(0, 50) + '...')
        
        // 发送消息（这会自动建立 SSE 连接）
        await sendMessage(initialPrompt)
        console.log('[ReportEdit] Prompt 发送成功')
        setHasSentInitialPrompt(true)
        setIsAgentRunning(true)
        
        // 清除 pendingPrompt
        useReportStore.clearPendingPrompt()
        pendingPromptRef.current = null
        
        // 标记已发送
        sessionStorage.setItem(key, '1')
      } catch (err) {
        console.error('[ReportEdit] 发送 pendingPrompt 失败:', err)
        setError(err instanceof Error ? err.message : '发送消息失败')
      }
    }

    // 延迟发送，确保 conversationId 已设置
    const timer = setTimeout(() => {
      void sendPendingPrompt()
    }, 500)

    return () => clearTimeout(timer)
  }, [conversationId, hasSentInitialPrompt, sendMessage])

  // 使用 useTextStream 实现打字机效果
  // 注意：流式输出时使用 currentAnswer，完成后使用 content
  const textToDisplay = isProcessing ? currentAnswer : content
  const { displayedText: typewriterText, isComplete: typewriterComplete } = useTextStream({
    textStream: textToDisplay || '',
    speed: 15,
    mode: 'typewriter',
  })

  // 监听流式内容并更新编辑器
  useEffect(() => {
    if (!isProcessing && isAgentRunning && currentAnswer) {
      // Agent 运行结束，更新内容
      setContent(currentAnswer)
      setIsAgentRunning(false)
    } else if (isProcessing && currentAnswer) {
      // Agent 正在运行，实时更新内容
      setContent(currentAnswer)
    }
  }, [currentAnswer, isProcessing, isAgentRunning])

  // 自动保存内容（Agent 结束后）
  useEffect(() => {
    if (!reportDetail?.main_id || !content || isProcessing) {
      return
    }

    // Agent 结束后，如果内容有变化，自动保存
    if (content !== lastSavedContentRef.current && content.trim()) {
      const saveContent = async () => {
        try {
          await updateDocumentContent(reportDetail.main_id, content)
          lastSavedContentRef.current = content
          console.log('内容已自动保存')
        } catch (err) {
          console.error('自动保存失败:', err)
        }
      }

      // 延迟保存，避免频繁请求
      const timer = setTimeout(() => {
        void saveContent()
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [content, reportDetail?.main_id, isProcessing])

  // 手动保存
  const handleSave = useCallback(async () => {
    if (!reportDetail?.main_id) return

    try {
      await updateDocumentContent(reportDetail.main_id, content)
      lastSavedContentRef.current = content
      alert('保存成功')
    } catch (err) {
      console.error('保存失败:', err)
      alert('保存失败，请重试')
    }
  }, [content, reportDetail?.main_id])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部导航 */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reports/new')}
            className="text-gray-600 hover:text-gray-900"
          >
            返回
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            {reportDetail?.title || '报告编辑'}
          </h1>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          保存
        </button>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：编辑器 */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              {(isProcessing && typewriterText) || content ? (
                <div className="prose max-w-none">
                  {/* 使用打字机效果显示内容，并用 EnhancedMarkdown 渲染 */}
                  {isProcessing && typewriterText ? (
                    <>
                      <EnhancedMarkdown>{String(typewriterText || '')}</EnhancedMarkdown>
                      {!typewriterComplete && (
                        <span className="inline-block w-0.5 h-4 bg-gray-400 animate-pulse ml-0.5" />
                      )}
                    </>
                  ) : content ? (
                    <EnhancedMarkdown>{String(content || '')}</EnhancedMarkdown>
                  ) : null}
                </div>
              ) : (
                <div className="text-gray-400 text-center py-12">
                  {isProcessing ? 'AI 正在生成内容...' : '等待 AI 生成内容...'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 状态栏 */}
      <div className="h-12 bg-white border-t border-gray-200 flex items-center justify-between px-6 text-sm text-gray-500">
        <div>
          {isProcessing ? 'AI 正在生成...' : isConnected ? '已连接' : '连接中...'}
        </div>
        <div>
          {content.length > 0 && `${content.length} 字符`}
        </div>
      </div>
    </div>
  )
}
