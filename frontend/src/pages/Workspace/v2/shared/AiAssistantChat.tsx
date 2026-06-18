/**
 * AI 助手 —— 右下角可拖拽悬浮气泡 + 轻量问答对话窗口
 * 对标 JadeAI 的 ai-chat-bubble：点击气泡开合对话窗口，可直接对话交流。
 * - 轻量问答走 /resume/chat/stream（grounded 在当前简历上）。
 * - 划词改写收编：在正文选中文字后，窗口顶部出现「引用选中」，可一键润色/量化/精简或自定义改写，
 *   结果带「应用到原文」按钮，经 applyHtmlToSelection 写回被选中的那段原文。
 * - 保留「针对 JD 优化」快捷入口。
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Sparkles, X, Send, Target, Loader2, Square, Quote, Check, Languages, Stethoscope } from 'lucide-react'
import { chatStream, rewriteTextStream, type ChatStreamMessage } from '@/services/api'
import { stripHtmlTags } from '../utils/textUtils'
import type { ResumeData } from '../types'
import {
  getActiveSelection,
  subscribeActiveSelection,
  applyHtmlToSelection,
  type ActiveSelection,
} from './activeSelectionStore'
import { cn } from '../../../../lib/utils'

interface AiAssistantChatProps {
  resumeData: ResumeData
  onJdOptimize: () => void
  jdReady: boolean
  onFocusJd: () => void
  /** 打开「简历一键翻译」弹窗 */
  onTranslate: () => void
  /** 打开「简历体检」弹窗 */
  onHealthCheck: () => void
  /** 简历是否有可处理的文本内容（决定翻译/体检是否可用） */
  hasContent: boolean
}

interface ChatItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  /** 改写类回复携带：可写回的目标选区 + 是否已应用 */
  apply?: { sel: ActiveSelection; applied: boolean }
}

const BUBBLE_SIZE = 48
const GAP = 12

const REWRITE_PRESETS = [
  { label: '润色', instruction: '润色这段文字，使表达更专业流畅' },
  { label: '更量化', instruction: '改写这段文字，补充量化指标与结果' },
  { label: '更简洁', instruction: '精简这段文字，去掉冗余表达' },
]

const selKey = (s: ActiveSelection) => `${s.path}:${s.from}:${s.to}`

/** markdown 粗体转 HTML，供写回时保留加粗（其余按纯文本写回） */
const toApplyHtml = (s: string) => s.trim().replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

/** 把当前简历压成精简文本，作为问答上下文，让回答贴合简历 */
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

export default function AiAssistantChat({ resumeData, onJdOptimize, jdReady, onFocusJd, onTranslate, onHealthCheck, hasContent }: AiAssistantChatProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  const [pos, setPos] = useState({ right: 24, bottom: 24 })
  const dragRef = useRef<{ startX: number; startY: number; origRight: number; origBottom: number; moved: boolean } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listEndRef = useRef<HTMLDivElement>(null)

  // 订阅全局选区；被用户关闭（×）的选区不再引用
  const liveSel = useSyncExternalStore(subscribeActiveSelection, getActiveSelection)
  const refSel = liveSel && selKey(liveSel) !== dismissedKey ? liveSel : null

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

  // 普通问答
  const sendChat = useCallback((text: string) => {
    const userMsg: ChatItem = { id: `u-${Date.now()}`, role: 'user', content: text }
    const aiId = `a-${Date.now()}`
    const history: ChatStreamMessage[] = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, userMsg, { id: aiId, role: 'assistant', content: '', streaming: true }])
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
        setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, content: full || `出错了：${err}`, streaming: false } : m)))
      },
      abortRef.current.signal,
    )
  }, [messages, resumeData])

  // 划词改写：对引用的选区按指令改写，结果可一键写回
  const rewriteSelection = useCallback((sel: ActiveSelection, instruction: string) => {
    const userMsg: ChatItem = { id: `u-${Date.now()}`, role: 'user', content: `改写选中：${instruction}` }
    const aiId = `a-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: aiId, role: 'assistant', content: '', streaming: true, apply: { sel, applied: false } },
    ])
    setStreaming(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    let full = ''
    rewriteTextStream(
      sel.html,
      instruction,
      sel.path,
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
        setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, content: full || `改写失败：${err}`, streaming: false } : m)))
      },
      abortRef.current.signal,
    )
  }, [])

  const submit = useCallback((text: string) => {
    const t = text.trim()
    if (!t || streaming) return
    setInput('')
    if (refSel) rewriteSelection(refSel, t)
    else sendChat(t)
  }, [streaming, refSel, rewriteSelection, sendChat])

  const handleApply = useCallback((msgId: string) => {
    const msg = messages.find((m) => m.id === msgId)
    if (!msg?.apply) return
    const ok = applyHtmlToSelection(msg.apply.sel, toApplyHtml(msg.content))
    if (!ok) return
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, apply: { ...m.apply!, applied: true } } : m)))
    setDismissedKey(selKey(msg.apply.sel)) // 写回后选区位置已变，关闭引用
  }, [messages])

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(input)
    }
  }

  return (
    <>
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
          <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 space-y-2">
            <button
              onClick={() => { if (jdReady) onJdOptimize(); else onFocusJd() }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-950/40 transition-colors text-left"
            >
              <Target className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-xs text-neutral-700 dark:text-neutral-200">
                {jdReady ? '针对 JD 优化简历' : '先填职位描述，再按 JD 优化'}
              </span>
            </button>
            <button
              onClick={onTranslate}
              disabled={!hasContent}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/60 dark:bg-teal-950/20 hover:bg-teal-100/60 dark:hover:bg-teal-950/40 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Languages className="w-4 h-4 text-teal-500 shrink-0" />
              <span className="text-xs text-neutral-700 dark:text-neutral-200">简历一键翻译 / 双语</span>
            </button>
            <button
              onClick={onHealthCheck}
              disabled={!hasContent}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/20 hover:bg-violet-100/60 dark:hover:bg-violet-950/40 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Stethoscope className="w-4 h-4 text-violet-500 shrink-0" />
              <span className="text-xs text-neutral-700 dark:text-neutral-200">简历体检（无需 JD）</span>
            </button>
          </div>

          {/* 消息区 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-xs text-neutral-400 dark:text-neutral-500 mt-8 px-4 leading-relaxed">
                有简历或求职问题都可以问我。<br />
                在正文里<strong>选中一段文字</strong>，还能直接让我改写并写回～
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] flex flex-col gap-1.5', m.role === 'user' ? 'items-end' : 'items-start')}>
                  <div
                    className={cn(
                      'px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words',
                      m.role === 'user'
                        ? 'bg-indigo-500 text-white rounded-br-sm'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-bl-sm',
                    )}
                  >
                    {m.content || (m.streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : '')}
                  </div>
                  {m.apply && !m.streaming && m.content.trim() && (
                    m.apply.applied ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> 已写回原文
                      </span>
                    ) : (
                      <button
                        onClick={() => handleApply(m.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> 应用到原文
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
            <div ref={listEndRef} />
          </div>

          {/* 引用选中 + 改写预设 */}
          {refSel && (
            <div className="px-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                <Quote className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                <span className="flex-1 text-xs text-neutral-600 dark:text-neutral-300 line-clamp-2">{refSel.text}</span>
                <button onClick={() => setDismissedKey(selKey(refSel))} className="p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/40">
                  <X className="w-3 h-3 text-neutral-400" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {REWRITE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    disabled={streaming}
                    onClick={() => submit(p.instruction)}
                    className="px-2 py-1 rounded-full text-xs border border-purple-200 dark:border-purple-900/50 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors disabled:opacity-40"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 输入区 */}
          <div className="border-t border-neutral-100 dark:border-neutral-800 p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={refSel ? '说说怎么改这段选中文字…' : '问我任何简历问题…（Enter 发送）'}
                rows={1}
                className="flex-1 resize-none max-h-28 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
              {streaming ? (
                <button onClick={stopStreaming} title="停止" className="p-2 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
                  <Square className="w-4 h-4 text-neutral-700 dark:text-neutral-200" />
                </button>
              ) : (
                <button onClick={() => submit(input)} disabled={!input.trim()} title="发送" className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
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
        {!open && refSel && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-purple-300 border-2 border-white dark:border-neutral-900" />
        )}
      </button>
    </>
  )
}
