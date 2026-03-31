/**
 * 划词改写气泡
 * 选中文本 → 弹出输入框 → 输入指令 → AI 改写 → 替换回选区
 */
import { useState, useCallback, useRef } from 'react'
import { Loader2, Sparkles, Send } from 'lucide-react'
import { rewriteTextStream } from '../../../../services/api'
import type { Editor } from '@tiptap/core'

interface SelectionPolishBubbleProps {
  editor: Editor
  polishPath: string
}

export default function SelectionPolishBubble({
  editor,
  polishPath,
}: SelectionPolishBubbleProps) {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
  }

  return (
    <div
      className="flex items-center gap-1.5 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 px-2 py-1.5"
      onMouseDown={(e) => e.preventDefault()}
    >
      <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入改写指令..."
        disabled={isStreaming}
        autoFocus
        className="w-48 px-2 py-0.5 text-xs rounded-md border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-purple-300 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={isStreaming || !input.trim()}
        className="p-1 rounded-md bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-40 transition-colors"
      >
        {isStreaming ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Send className="w-3.5 h-3.5" />
        )}
      </button>
      {error && <span className="text-[10px] text-red-500 max-w-24 truncate">{error}</span>}
    </div>
  )
}
