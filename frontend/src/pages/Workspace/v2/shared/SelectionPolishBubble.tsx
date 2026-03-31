/**
 * 划词改写气泡
 * 选中文本 → 弹出输入框 → 输入指令 → AI 改写 → 替换回选区
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { Loader2, Sparkles, Send, X } from 'lucide-react'
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
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 气泡出现时自动聚焦输入框，并标记为活跃状态
  useEffect(() => {
    bubbleActiveRef.current = true
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
    return () => {
      bubbleActiveRef.current = false
      clearTimeout(timer)
    }
  }, [bubbleActiveRef])

  const handleSend = useCallback(() => {
    const instruction = input.trim()
    if (!instruction || isStreaming) return

    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, '\n')
    if (!selectedText.trim()) return

    setInput('')
    setIsStreaming(true)
    setError(null)

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
        bubbleActiveRef.current = false
        if (fullContent.trim()) {
          editor
            .chain()
            .focus()
            .setTextSelection({ from, to })
            .deleteSelection()
            .insertContent(fullContent)
            .run()
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

  return (
    <div
      className="ai-polish-bubble"
      onMouseDown={(e) => e.preventDefault()}
      // 阻止事件冒泡到编辑器，防止选区丢失
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
  )
}
