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
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const selectionSnapshotRef = useRef<{ from: number; to: number; text: string } | null>(null)

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

  const markActive = () => {
    bubbleActiveRef.current = true
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
    <div
      ref={rootRef}
      className="ai-polish-bubble"
      onMouseEnter={markActive}
      onFocusCapture={markActive}
      onKeyDownCapture={(e) => e.stopPropagation()}
      onBlurCapture={() => {
        // 流式过程中保持气泡，不因临时失焦闪烁
        if (isStreaming) {
          bubbleActiveRef.current = true
          return
        }
        // 等待焦点切换完成后再判断是否离开气泡
        setTimeout(markInactiveIfOutside, 0)
      }}
      // 只阻止冒泡到编辑器；不要全局 preventDefault，否则输入框无法聚焦
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
  )
}
