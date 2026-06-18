/**
 * AI 助手 —— 右下角可拖拽悬浮气泡 + 轻量问答对话窗口
 * 对标 JadeAI 的 ai-chat-bubble：点击气泡开合对话窗口，可直接对话交流。
 * 轻量问答走 /resume/chat/stream（grounded 在当前简历上），并保留「针对 JD 优化」快捷入口。
 * 划词改写的"引用选中 + 一键应用"在后续子任务接入。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send, Target, Loader2, Square } from 'lucide-react'
import { chatStream, type ChatStreamMessage } from '@/services/api'
import { stripHtmlTags } from '../utils/textUtils'
import type { ResumeData } from '../types'
import { cn } from '../../../../lib/utils'

interface AiAssistantChatProps {
  resumeData: ResumeData
  /** 打开「针对 JD 优化」弹窗 */
  onJdOptimize: () => void
  /** JD 是否已填写（决定 JD 优化是否可用） */
  jdReady: boolean
  /** 滚动并聚焦到 JD 输入区 */
  onFocusJd: () => void
}

interface ChatItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const BUBBLE_SIZE = 48
const GAP = 12

/** 把当前简历压成精简文本，作为问答的上下文，让回答贴合简历 */
function buildResumeContext(r: ResumeData): string {
  const lines: string[] = []
  if (r.basic?.name) lines.push(`姓名：${r.basic.name}`)
  const selfEval = stripHtmlTags(r.selfEvaluation || '').trim()
  if (selfEval) lines.push(`自我评价：${selfEval}`)
  const skills = stripHtmlTags(r.skillContent || '').trim()
  if (skills) lines.push(`专业技能：${skills}`)
  r.experience?.forEach((e) => {
    const details = stripHtmlTags(e.details || '').trim()
    if (details) lines.push(`实习/工作（${stripHtmlTags(e.company || '').trim()}）：${details}`)
  })
  r.projects?.forEach((p) => {
    const desc = stripHtmlTags(p.description || '').trim()
    if (desc) lines.push(`项目（${stripHtmlTags(p.name || '').trim()}）：${desc}`)
  })
  r.openSource?.forEach((o) => {
    const desc = stripHtmlTags(o.description || '').trim()
    if (desc) lines.push(`开源（${stripHtmlTags(o.name || '').trim()}）：${desc}`)
  })
  return lines.join('\n')
}

export default function AiAssistantChat({ resumeData, onJdOptimize, jdReady, onFocusJd }: AiAssistantChatProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)

  // 气泡位置（右/下偏移），可拖拽；窗口锚定在气泡正上方，随气泡移动
  const [pos, setPos] = useState({ right: 24, bottom: 24 })
  const dragRef = useRef<{ startX: number; startY: number; origRight: number; origBottom: number; moved: boolean } | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const listEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => () => abortRef.current?.abort(), [])

  // --- 气泡拖拽 ---
  const onBubbleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origRight: pos.right, origBottom: pos.bottom, moved: false }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true
      setPos({
        right: Math.max(8, dragRef.current.origRight - dx),
        bottom: Math.max(8, dragRef.current.origBottom - dy),
      })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [pos])

  const onBubbleClick = useCallback(() => {
    if (!dragRef.current?.moved) setOpen((v) => !v)
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)))
  }, [])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatItem = { id: `u-${Date.now()}`, role: 'user', content: text }
    const aiId = `a-${Date.now()}`
    const history: ChatStreamMessage[] = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, userMsg, { id: aiId, role: 'assistant', content: '', streaming: true }])
    setInput('')
    setStreaming(true)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    let full = ''
    chatStream(
      history,
      buildResumeContext(resumeData),
      (chunk) => {
        full += chunk
        setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, content: full } : m)))
      },
      () => {
        setStreaming(false)
        setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, streaming: false } : m)))
      },
      (err) => {
        setStreaming(false)
        setMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, content: full || `出错了：${err}`, streaming: false } : m)),
        )
      },
      abortRef.current.signal,
    )
  }, [input, streaming, messages, resumeData])

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* 对话窗口 —— 锚定在气泡正上方，随气泡移动 */}
      {open && (
        <div
          className="fixed z-40 flex flex-col w-[380px] h-[560px] max-h-[80vh] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
          style={{ right: pos.right, bottom: pos.bottom + BUBBLE_SIZE + GAP }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white" />
              <span className="text-sm font-semibold text-white">AI 助手</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-white/20 transition-colors">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* 快捷动作 */}
          <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => { if (jdReady) onJdOptimize(); else onFocusJd() }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-950/40 transition-colors text-left"
            >
              <Target className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-xs text-neutral-700 dark:text-neutral-200">
                {jdReady ? '针对 JD 优化简历' : '先填职位描述，再按 JD 优化'}
              </span>
            </button>
          </div>

          {/* 消息区 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-xs text-neutral-400 dark:text-neutral-500 mt-8 px-4">
                有简历或求职问题都可以问我，比如<br />“帮我把自我评价改得更突出后端能力”
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words',
                    m.role === 'user'
                      ? 'bg-indigo-500 text-white rounded-br-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-bl-sm',
                  )}
                >
                  {m.content || (m.streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : '')}
                </div>
              </div>
            ))}
            <div ref={listEndRef} />
          </div>

          {/* 输入区 */}
          <div className="border-t border-neutral-100 dark:border-neutral-800 p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="问我任何简历问题…（Enter 发送）"
                rows={1}
                className="flex-1 resize-none max-h-28 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
              {streaming ? (
                <button
                  onClick={stopStreaming}
                  title="停止"
                  className="p-2 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                >
                  <Square className="w-4 h-4 text-neutral-700 dark:text-neutral-200" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  title="发送"
                  className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 浮动气泡（可拖拽） */}
      <button
        onMouseDown={onBubbleMouseDown}
        onClick={onBubbleClick}
        title="AI 助手（可拖拽）"
        style={{ right: pos.right, bottom: pos.bottom, width: BUBBLE_SIZE, height: BUBBLE_SIZE }}
        className={cn(
          'fixed z-40 flex items-center justify-center rounded-full shadow-lg transition-transform cursor-grab active:cursor-grabbing active:scale-95',
          'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white hover:scale-105',
          open && 'ring-4 ring-purple-500/20',
        )}
      >
        <Sparkles className="w-5 h-5" />
      </button>
    </>
  )
}
