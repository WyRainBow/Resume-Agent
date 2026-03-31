/**
 * 划词改写气泡
 * 选中文本 → 弹出输入框 → 输入指令 → AI 改写 → 替换回选区
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { Loader2, Sparkles, Send, X, Check, Eye } from 'lucide-react'
import { rewriteTextStream } from '../../../../services/api'
import type { Editor } from '@tiptap/core'

interface SelectionPolishBubbleProps {
  editor: Editor
  polishPath: string
  bubbleActiveRef: React.MutableRefObject<boolean>
}

export default function SelectionPolishBubble({
  editor,
  polishPath,
  bubbleActiveRef,
}: SelectionPolishBubbleProps) {
  type ChatMessage = {
    id: string
    type: 'original' | 'user' | 'ai'
    content: string
    isStreaming?: boolean
  }

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatStreaming, setChatStreaming] = useState(false)
  const [latestPolished, setLatestPolished] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const selectionSnapshotRef = useRef<{ from: number; to: number; text: string } | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // 气泡出现时锁定一次选区快照，并自动聚焦输入框
  useEffect(() => {
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, '\n')
    if (text.trim()) {
      selectionSnapshotRef.current = { from, to, text }
    }
    bubbleActiveRef.current = true

    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)

    return () => {
      bubbleActiveRef.current = false
      clearTimeout(timer)
    }
  }, [bubbleActiveRef, editor])

  const handleSend = useCallback(() => {
    const instruction = input.trim()
    if (!instruction || isStreaming) return

    const snapshot = selectionSnapshotRef.current
    const from = snapshot?.from ?? editor.state.selection.from
    const to = snapshot?.to ?? editor.state.selection.to
    const selectedText = snapshot?.text ?? editor.state.doc.textBetween(from, to, '\n')
    if (!selectedText.trim()) return

    setInput('')
    setIsStreaming(true)
    setError(null)
    bubbleActiveRef.current = true

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    let fullContent = ''

    rewriteTextStream(
      selectedText,
      instruction,
      polishPath,
      (chunk: string) => {
        fullContent += chunk
      },
      () => {
        setIsStreaming(false)
        if (fullContent.trim()) {
          setLatestPolished(fullContent)
          setChatMessages([
            { id: `o-${Date.now()}`, type: 'original', content: selectedText },
            { id: `u-${Date.now()}`, type: 'user', content: instruction },
            { id: `a-${Date.now()}`, type: 'ai', content: fullContent },
          ])
          setChatOpen(true)
          bubbleActiveRef.current = false
        } else {
          bubbleActiveRef.current = false
        }
      },
      (err: string) => {
        setIsStreaming(false)
        bubbleActiveRef.current = false
        setError(err)
      },
      abortRef.current.signal,
    )
  }, [editor, input, isStreaming, polishPath])

  useEffect(() => {
    if (!chatOpen) return
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [chatOpen, chatMessages, chatStreaming])

  const sendFollowup = useCallback(() => {
    const instruction = chatInput.trim()
    if (!instruction || chatStreaming) return

    const baseText = latestPolished || selectionSnapshotRef.current?.text || ''
    if (!baseText.trim()) return

    const aiId = `a-${Date.now()}`
    setChatInput('')
    setChatStreaming(true)
    setChatMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, type: 'user', content: instruction },
      { id: aiId, type: 'ai', content: '', isStreaming: true },
    ])

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    let full = ''

    rewriteTextStream(
      baseText,
      instruction,
      polishPath,
      (chunk: string) => {
        full += chunk
        setChatMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, content: full, isStreaming: true } : m)),
        )
      },
      () => {
        setChatStreaming(false)
        if (full.trim()) {
          setLatestPolished(full)
        }
        setChatMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, content: full, isStreaming: false } : m)),
        )
      },
      (err: string) => {
        setChatStreaming(false)
        setError(err)
        setChatMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, content: `改写失败: ${err}`, isStreaming: false } : m)),
        )
      },
      abortRef.current.signal,
    )
  }, [chatInput, chatStreaming, latestPolished, polishPath])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      bubbleActiveRef.current = false
      editor.commands.focus()
    }
  }

  const markActive = () => {
    bubbleActiveRef.current = true
  }

  const handleApplyPreview = () => {
    const snapshot = selectionSnapshotRef.current
    if (!snapshot || !latestPolished.trim()) {
      setChatOpen(false)
      bubbleActiveRef.current = false
      return
    }
    editor
      .chain()
      .focus()
      .setTextSelection({ from: snapshot.from, to: snapshot.to })
      .deleteSelection()
      .insertContent(latestPolished)
      .run()
    setChatOpen(false)
    bubbleActiveRef.current = false
  }

  const handleCancelPreview = () => {
    setChatOpen(false)
    bubbleActiveRef.current = false
    editor.commands.focus()
  }

  const markInactiveIfOutside = () => {
    const root = rootRef.current
    if (!root) {
      bubbleActiveRef.current = false
      return
    }
    const activeEl = document.activeElement
    bubbleActiveRef.current = !!(activeEl && root.contains(activeEl))
  }

  return (
    <>
      <div
        ref={rootRef}
        className="ai-polish-bubble"
        onMouseEnter={markActive}
        onFocusCapture={markActive}
        onKeyDownCapture={(e) => e.stopPropagation()}
      onBlurCapture={() => {
        if (isStreaming || chatOpen) {
          bubbleActiveRef.current = true
          return
        }
          setTimeout(markInactiveIfOutside, 0)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入改写指令，如：更专业..."
            disabled={isStreaming}
            className="ai-polish-input"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="ai-polish-send"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-red-400">
            <X className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-48">{error}</span>
          </div>
        )}
      </div>

      {chatOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={handleCancelPreview}>
          <div
            className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                划词改写助手
              </span>
              <button onClick={handleCancelPreview} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-5 py-4 space-y-4 min-h-0">
              {chatMessages.map((msg) => {
                if (msg.type === 'original') {
                  return (
                    <div key={msg.id} className="space-y-1.5">
                      <span className="text-xs font-medium text-neutral-400">优化前</span>
                      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 p-4">
                        <div className="text-sm leading-6 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">{msg.content}</div>
                      </div>
                    </div>
                  )
                }
                if (msg.type === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[75%] px-4 py-2.5 bg-blue-500 text-white rounded-2xl rounded-tr-md text-sm">
                        {msg.content}
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={msg.id} className="space-y-1.5">
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">优化后</span>
                    <div className="rounded-lg bg-emerald-50/40 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/50 p-4">
                      {msg.isStreaming && !msg.content ? (
                        <div className="flex items-center gap-2 text-emerald-600 text-sm py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          正在生成...
                        </div>
                      ) : (
                        <div className="text-sm leading-6 whitespace-pre-wrap text-neutral-800 dark:text-neutral-100">{msg.content}</div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendFollowup()
                    }
                  }}
                  placeholder="继续说你的改写要求，如：更简洁一点，突出影响力"
                  disabled={chatStreaming}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  onClick={sendFollowup}
                  disabled={chatStreaming || !chatInput.trim()}
                  className="h-9 w-9 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelPreview}
                  className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  取消
                </button>
                <button
                  onClick={handleApplyPreview}
                  disabled={!latestPolished.trim()}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  应用改写
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
