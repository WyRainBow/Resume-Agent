/**
 * 报告统一页面
 * 动态布局：默认 Agent 聊天全屏，有内容时左右分栏（左侧聊天，右侧报告内容）
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCLTP } from '@/hooks/useCLTP'
import { useTextStream } from '@/hooks/useTextStream'
import EnhancedMarkdown from '@/components/chat/EnhancedMarkdown'
import ChatMessage from '@/components/chat/ChatMessage'
import { 
  getReport, 
  ensureReportConversation, 
  getDocumentContent,
  updateDocumentContent,
  listReports
} from '@/services/api'
import { useReportStore } from '@/stores/reportStore'
import { cn } from '@/lib/utils'
import { getApiBaseUrl, isAgentEnabled } from '@/lib/runtimeEnv'
import type { ReportDetail, ReportListItem } from '@/services/api'

// 拖拽分隔线组件
function DragHandle({ 
  onDrag, 
  className 
}: { 
  onDrag: (delta: number) => void
  className?: string 
}) {
  const isDragging = useRef(false)
  const startX = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - startX.current
      startX.current = e.clientX
      onDrag(delta)
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [onDrag])

  return (
    <div
      className={cn('w-1 cursor-ew-resize transition-all duration-200 group relative shrink-0 hover:bg-indigo-300', className)}
      style={{ cursor: 'ew-resize', touchAction: 'none' }}
      onMouseDown={handleMouseDown}
    >
      <div className="absolute inset-y-0 -left-2 -right-2 cursor-ew-resize" />
    </div>
  )
}

export default function ReportsPage() {
  const agentEnabled = isAgentEnabled()
  const { reportId } = useParams<{ reportId?: string }>()
  const navigate = useNavigate()
  
  // 报告列表状态
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(true)
  
  // 当前选中的报告
  const [selectedReportId, setSelectedReportId] = useState<string | null>(reportId || null)
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null)
  const [content, setContent] = useState('')
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  
  // 聊天相关状态
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [hasSentInitialPrompt, setHasSentInitialPrompt] = useState(false)
  const [isAgentRunning, setIsAgentRunning] = useState(false)
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string; thought?: string }>>([])
  const [input, setInput] = useState('')
  
  // 布局相关
  const [leftWidth, setLeftWidth] = useState(400) // 左侧聊天区域宽度
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  
  const pendingPromptRef = useRef<string | null>(null)
  const hasHistoryRef = useRef(false)
  const lastSavedContentRef = useRef('')

  // 获取 pendingPrompt
  const pendingPrompt = useReportStore.getPendingPrompt()

  // 初始化 CLTP
  const {
    currentAnswer,
    currentThought,
    isProcessing,
    isConnected,
    sendMessage,
    finalizeStream,
  } = useCLTP({
    conversationId: conversationId || undefined,
    baseUrl: getApiBaseUrl(),
  })

  // 加载报告列表
  useEffect(() => {
    const loadReports = async () => {
      try {
        setIsLoadingReports(true)
        const result = await listReports(1, 50)
        setReports(result.items)
      } catch (err) {
        console.error('加载报告列表失败:', err)
      } finally {
        setIsLoadingReports(false)
      }
    }
    loadReports()
  }, [])

  // 从 URL 参数加载报告
  useEffect(() => {
    if (reportId && reportId !== selectedReportId) {
      setSelectedReportId(reportId)
    } else if (!reportId) {
      setSelectedReportId(null)
    }
  }, [reportId, selectedReportId])

  // 加载选中的报告详情
  useEffect(() => {
    if (!selectedReportId) {
      setReportDetail(null)
      setContent('')
      setConversationId(null)
      return
    }

    const loadReport = async () => {
      try {
        setIsLoadingReport(true)
        const report = await getReport(selectedReportId)
        setReportDetail(report)
        
        // 确保有对话关联
        const convResult = await ensureReportConversation(selectedReportId)
        setConversationId(convResult.conversation_id)
        
        // 加载文档内容
        if (report.main_id) {
          const docContent = await getDocumentContent(report.main_id)
          const savedContent = docContent.content || ''
          setContent(savedContent)
          lastSavedContentRef.current = savedContent
          
          if (savedContent.trim()) {
            hasHistoryRef.current = true
          }
        }
        
        // 检查是否已发送过
        const key = `autoSendReportPrompt:${convResult.conversation_id}`
        const alreadySent = sessionStorage.getItem(key) === '1'
        if (alreadySent) {
          hasHistoryRef.current = true
        }
      } catch (err) {
        console.error('加载报告失败:', err)
      } finally {
        setIsLoadingReport(false)
      }
    }

    loadReport()
  }, [selectedReportId])

  // 保存 pendingPrompt 到 ref
  useEffect(() => {
    if (pendingPrompt) {
      pendingPromptRef.current = pendingPrompt
    } else {
      const stored = sessionStorage.getItem('report-pending-prompt')
      if (stored) {
        pendingPromptRef.current = stored
      } else if (reportDetail && !content.trim()) {
        const generatedPrompt = `请生成一份详细的报告：${reportDetail.title}`
        pendingPromptRef.current = generatedPrompt
      }
    }
  }, [pendingPrompt, reportDetail, content])

  // 自动发送 pendingPrompt
  useEffect(() => {
    if (!conversationId || hasSentInitialPrompt || hasHistoryRef.current) {
      return
    }

    const initialPrompt = pendingPromptRef.current
    if (!initialPrompt) {
      return
    }

    const sendPendingPrompt = async () => {
      try {
        const key = `autoSendReportPrompt:${conversationId}`
        const alreadySent = sessionStorage.getItem(key) === '1'
        if (alreadySent) {
          hasHistoryRef.current = true
          return
        }

        // 添加用户消息到界面
        setMessages(prev => [...prev, {
          id: `user-${Date.now()}`,
          role: 'user',
          content: initialPrompt
        }])

        // 发送消息
        await sendMessage(initialPrompt)
        setHasSentInitialPrompt(true)
        setIsAgentRunning(true)
        
        useReportStore.clearPendingPrompt()
        pendingPromptRef.current = null
        sessionStorage.setItem(key, '1')
      } catch (err) {
        console.error('发送 pendingPrompt 失败:', err)
      }
    }

    const timer = setTimeout(() => {
      void sendPendingPrompt()
    }, 500)

    return () => clearTimeout(timer)
  }, [conversationId, hasSentInitialPrompt, sendMessage])

  // 使用打字机效果
  const textToDisplay = isProcessing ? currentAnswer : content
  const { displayedText: typewriterText, isComplete: typewriterComplete } = useTextStream({
    textStream: textToDisplay || '',
    speed: 15,
    mode: 'typewriter',
    streamMode: 'burst-smoothed',
  })

  // 监听流式内容并更新右侧报告内容
  useEffect(() => {
    if (isProcessing && currentAnswer) {
      setContent(currentAnswer)
    } else if (!isProcessing && isAgentRunning && currentAnswer) {
      setContent(currentAnswer)
    }
  }, [currentAnswer, isProcessing, isAgentRunning])

  // 监听 AI 回复并添加到消息列表
  useEffect(() => {
    if ((currentAnswer || currentThought) && isProcessing) {
      // 更新或添加 assistant 消息
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        // 如果最后一条消息是 assistant 且正在流式输出，更新它
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id.startsWith('assistant-')) {
          return prev.slice(0, -1).concat({
            ...lastMessage,
            content: currentAnswer || lastMessage.content,
            thought: currentThought || lastMessage.thought
          })
        } else {
          // 否则添加新消息
          return prev.concat({
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: currentAnswer || '',
            thought: currentThought || undefined
          })
        }
      })
    } else if (!isProcessing && isAgentRunning && currentAnswer) {
      // Agent 结束时，确保最后一条消息是最新的
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          return prev.slice(0, -1).concat({
            ...lastMessage,
            content: currentAnswer,
            thought: currentThought || lastMessage.thought
          })
        }
        return prev
      })
      setIsAgentRunning(false)
    }
  }, [currentAnswer, currentThought, isProcessing, isAgentRunning])

  // 自动保存内容
  useEffect(() => {
    if (!reportDetail?.main_id || !content || isProcessing) {
      return
    }

    if (content !== lastSavedContentRef.current && content.trim()) {
      const saveContent = async () => {
        try {
          await updateDocumentContent(reportDetail.main_id, content)
          lastSavedContentRef.current = content
        } catch (err) {
          console.error('自动保存失败:', err)
        }
      }

      const timer = setTimeout(() => {
        void saveContent()
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [content, reportDetail?.main_id, isProcessing])

  // 处理发送消息
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isProcessing) return

    const userMessage = input.trim()
    setInput('')
    
    // 添加到消息列表
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage
    }])

    try {
      await sendMessage(userMessage)
      setIsAgentRunning(true)
    } catch (err) {
      console.error('发送消息失败:', err)
    }
  }, [input, isProcessing, sendMessage])

  // 计算布局模式
  const layoutMode = (() => {
    // 如果有内容（>50字符），使用分栏模式
    if (content.trim().length > 50) {
      return 'split-editor'
    }
    // 如果有 pendingPrompt 且没有内容，纯聊天模式
    if (pendingPromptRef.current && !content.trim()) {
      return 'chat-only'
    }
    // 默认分栏模式（空白报告也可以编辑）
    return 'split-editor'
  })()

  // 处理报告点击
  const handleReportClick = useCallback((reportId: string) => {
    setSelectedReportId(reportId)
    navigate(`/reports/${reportId}`, { replace: true })
  }, [navigate])

  // 处理创建新报告
  const handleCreateNew = useCallback(() => {
    if (!agentEnabled) return
    navigate('/agent/new')
  }, [agentEnabled, navigate])

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* 顶部导航 */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900">报告</h1>
        </div>
        {agentEnabled && (
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            新建报告
          </button>
        )}
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：报告列表 + Agent 聊天 */}
        <div 
          className="flex flex-col shrink-0 bg-white border-r border-gray-200"
          style={{ width: isChatCollapsed ? 50 : leftWidth }}
        >
          {/* 报告列表（可折叠） */}
          {!isChatCollapsed && (
            <div className="h-48 border-b border-gray-200 overflow-y-auto">
              <div className="p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">报告列表</h2>
                {isLoadingReports ? (
                  <div className="text-sm text-gray-400">加载中...</div>
                ) : reports.length === 0 ? (
                  <div className="text-sm text-gray-400">暂无报告</div>
                ) : (
                  <div className="space-y-1">
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => handleReportClick(report.id)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded text-sm transition-colors',
                          selectedReportId === report.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <div className="truncate">{report.title}</div>
                        {report.updated_at && (
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(report.updated_at).toLocaleDateString()}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agent 聊天区域 */}
          <div className="flex-1 flex flex-col min-h-0">
            {isChatCollapsed ? (
              <button
                onClick={() => setIsChatCollapsed(false)}
                className="h-full flex items-center justify-center hover:bg-gray-50 transition-colors"
                title="展开聊天"
              >
                <div className="transform -rotate-90 text-gray-400">聊天</div>
              </button>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  {messages.length === 0 && !isProcessing && (
                    <div className="text-center py-20 text-gray-400">
                      {selectedReportId ? '开始对话...' : '选择一个报告或创建新报告'}
                    </div>
                  )}
                  
                  {messages.map((msg, idx) => (
                    <ChatMessage
                      key={msg.id}
                      message={msg}
                      isLatest={idx === messages.length - 1}
                      isStreaming={idx === messages.length - 1 && isProcessing}
                    />
                  ))}
                </div>

                {/* 输入框 */}
                <div className="border-t border-gray-200 p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="输入消息..."
                      disabled={isProcessing || !conversationId}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isProcessing || !input.trim() || !conversationId}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      发送
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 分隔线 */}
        {layoutMode === 'split-editor' && !isChatCollapsed && (
          <DragHandle onDrag={(delta) => setLeftWidth(w => Math.max(300, Math.min(800, w + delta)))} />
        )}

        {/* 右侧：报告内容（仅在 split-editor 模式且有选中报告时显示） */}
        {layoutMode === 'split-editor' && selectedReportId && (
          <div className="flex-1 flex flex-col bg-white min-w-0">
            {isLoadingReport ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                加载中...
              </div>
            ) : (
              <>
                {/* 报告标题栏 */}
                <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {reportDetail?.title || '报告'}
                  </h2>
                  <div className="flex items-center gap-2">
                    {!isChatCollapsed && (
                      <button
                        onClick={() => setIsChatCollapsed(true)}
                        className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                        title="收起聊天"
                      >
                        收起
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (reportDetail?.main_id) {
                          try {
                            await updateDocumentContent(reportDetail.main_id, content)
                            lastSavedContentRef.current = content
                            alert('保存成功')
                          } catch (err) {
                            alert('保存失败')
                          }
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      保存
                    </button>
                  </div>
                </div>

                {/* 报告内容 */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    {typewriterText || content ? (
                      <div className="prose max-w-none">
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
              </>
            )}
          </div>
        )}

        {/* 纯聊天模式：聊天区域居中显示 */}
        {layoutMode === 'chat-only' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-3xl w-full">
              {/* 聊天内容已经在左侧显示了 */}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
