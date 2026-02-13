import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, Send, Bot } from 'lucide-react'
import { useTypewriter } from '@/hooks/useTypewriter'
import { getResume } from '@/services/resumeStorage'
import type { SavedResume } from '@/services/resumeStorage'
import { getApiBaseUrl } from '@/lib/runtimeEnv'

type Role = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: Role
  content: string
  thought?: string
  timestamp: number
}

interface StreamEnvelope {
  id?: string
  type?: string
  data?: any
  timestamp?: string | number
}

export default function AgentChat() {
  const { resumeId } = useParams()
  const navigate = useNavigate()
  const [resume, setResume] = useState<SavedResume | null>(null)
  const [loadingResume, setLoadingResume] = useState(true)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const rawThoughtRef = useRef('')
  const rawAnswerRef = useRef('')
  const conversationId = useMemo(
    () => (resumeId ? `agent-${resumeId}` : `agent-${Date.now()}`),
    [resumeId]
  )

  const thoughtWriter = useTypewriter({ enabled: true, delay: 20, speed: 2 })
  const answerWriter = useTypewriter({
    enabled: true,
    delay: 18,
    speed: 2,
  })

  const isHtmlTemplate = resume?.data && (resume.data as any).templateType === 'html'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thoughtWriter.text, answerWriter.text])

  useEffect(() => {
    let isMounted = true
    const loadResume = async () => {
      if (!resumeId) {
        setResumeError('未找到简历 ID')
        setLoadingResume(false)
        return
      }
      try {
        const data = await getResume(resumeId)
        if (!isMounted) return
        if (!data) {
          setResumeError('未找到对应的简历')
        } else {
          setResume(data)
        }
      } catch (error) {
        if (!isMounted) return
        setResumeError('加载简历失败')
      } finally {
        if (isMounted) setLoadingResume(false)
      }
    }

    loadResume()
    return () => {
      isMounted = false
      controllerRef.current?.abort()
    }
  }, [resumeId])

  const resetStreamState = () => {
    thoughtWriter.reset()
    answerWriter.reset()
    rawThoughtRef.current = ''
    rawAnswerRef.current = ''
    setStreamError(null)
  }

  const finalizeAssistantMessage = () => {
    const thought = rawThoughtRef.current.trim()
    const answer = rawAnswerRef.current.trim()
    if (!thought && !answer) return
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: answer,
        thought,
        timestamp: Date.now(),
      },
    ])
    resetStreamState()
  }

  const appendThought = (content: string) => {
    rawThoughtRef.current += content
    thoughtWriter.appendContent(content)
  }

  const appendAnswer = (content: string) => {
    rawAnswerRef.current += content
    answerWriter.appendContent(content)
  }

  const handleStreamEvent = (payload: any) => {
    const eventType = payload?.type
    const content =
      payload?.content ??
      payload?.data?.content ??
      payload?.result ??
      payload?.data?.result ??
      ''

    if (!eventType) return

    if (eventType === 'thought' || eventType === 'thought_chunk') {
      if (content) appendThought(content)
      return
    }

    if (eventType === 'answer' || eventType === 'answer_chunk') {
      if (content) appendAnswer(content)
      return
    }

    if (eventType === 'tool_call') {
      const toolName = payload?.tool ?? payload?.data?.tool ?? 'unknown'
      appendThought(`\n[调用工具] ${toolName}\n`)
      return
    }

    if (eventType === 'tool_result' || eventType === 'tool_error') {
      const toolName = payload?.tool ?? payload?.data?.tool ?? 'unknown'
      appendThought(`\n[工具结果] ${toolName}\n`)
      return
    }

    if (eventType === 'status' && content === 'complete') {
      finalizeAssistantMessage()
      return
    }
  }

  const parseSseChunk = (chunk: string) => {
    const lines = chunk.split('\n')
    const dataLine = lines.find((line) => line.startsWith('data: '))
    if (!dataLine) return
    const rawData = dataLine.slice(6).trim()
    if (!rawData) return
    try {
      const parsed = JSON.parse(rawData) as StreamEnvelope
      const payload = parsed.data ?? parsed
      handleStreamEvent(payload)
    } catch {
      // ignore parsing errors
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isStreaming || !resumeId) return
    if (!isHtmlTemplate) {
      setStreamError('仅支持 HTML 模板简历进行 Agent 编辑')
      return
    }

    const content = input.trim()
    setInput('')
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      },
    ])

    resetStreamState()
    setIsStreaming(true)
    const controller = new AbortController()
    controllerRef.current = controller

    const body = {
      message: content,
      conversation_id: conversationId,
      resume_data: resume?.data ?? null,
    }

    try {
      const streamUrl = `${getApiBaseUrl()}/api/agent/stream`
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        parts.forEach(parseSseChunk)
      }

      if (buffer.trim()) {
        parseSseChunk(buffer)
      }

      finalizeAssistantMessage()
    } catch (error) {
      if ((error as any)?.name !== 'AbortError') {
        setStreamError(
          error instanceof Error ? error.message : 'Agent 请求失败'
        )
      }
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void sendMessage()
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              resumeId ? navigate(`/workspace/html/${resumeId}`) : navigate('/my-resumes')
            }
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            title="返回简历"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-slate-900">Agent 对话</span>
          </div>
          {resume?.name && (
            <span className="text-sm text-slate-500">· {resume.name}</span>
          )}
        </div>
        {!loadingResume && !isHtmlTemplate && (
          <span className="text-sm text-amber-600">
            仅支持 HTML 模板简历进行 Agent 编辑
          </span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4">
        {loadingResume && (
          <div className="text-slate-500">正在加载简历数据...</div>
        )}
        {resumeError && (
          <div className="text-red-500">{resumeError}</div>
        )}

        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {msg.role === 'assistant' && msg.thought && (
                  <div className="mb-2 text-xs text-slate-400 whitespace-pre-wrap">
                    {msg.thought}
                  </div>
                )}
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}

          {(thoughtWriter.text || answerWriter.text || isStreaming) && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow bg-white border border-slate-200 text-slate-700">
                {thoughtWriter.text && (
                  <div className="mb-2 text-xs text-slate-400 whitespace-pre-wrap">
                    {thoughtWriter.text}
                  </div>
                )}
                <ReactMarkdown>{answerWriter.text || '...'}</ReactMarkdown>
              </div>
            </div>
          )}

          {streamError && (
            <div className="text-sm text-red-500">{streamError}</div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isHtmlTemplate ? '输入你的需求...' : '仅支持 HTML 模板简历'}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isStreaming || !isHtmlTemplate}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim() || !isHtmlTemplate}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            发送
          </button>
        </form>
      </footer>
    </div>
  )
}
