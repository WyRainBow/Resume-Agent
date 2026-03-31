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
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewOriginal, setPreviewOriginal] = useState('')
  const [previewPolished, setPreviewPolished] = useState('')
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
        if (fullContent.trim()) {
          setPreviewOriginal(selectedText)
          setPreviewPolished(fullContent)
          setPreviewOpen(true)
          bubbleActiveRef.current = true
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
    if (!snapshot || !previewPolished.trim()) {
      setPreviewOpen(false)
      bubbleActiveRef.current = false
      return
    }
    editor
      .chain()
      .focus()
      .setTextSelection({ from: snapshot.from, to: snapshot.to })
      .deleteSelection()
      .insertContent(previewPolished)
      .run()
    setPreviewOpen(false)
    bubbleActiveRef.current = false
  }

  const handleCancelPreview = () => {
    setPreviewOpen(false)
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
          if (isStreaming || previewOpen) {
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

      {previewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={handleCancelPreview}>
          <div
            className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                划词改写对比
              </span>
              <button onClick={handleCancelPreview} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-0 divide-x divide-neutral-200 dark:divide-neutral-800">
              <div className="p-5 overflow-auto max-h-[58vh]">
                <p className="text-xs font-medium text-neutral-400 mb-2">优化前</p>
                <div className="text-sm leading-6 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">{previewOriginal}</div>
              </div>
              <div className="p-5 overflow-auto max-h-[58vh] bg-emerald-50/30 dark:bg-emerald-900/10">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">优化后</p>
                <div className="text-sm leading-6 whitespace-pre-wrap text-neutral-800 dark:text-neutral-100">{previewPolished}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-5 py-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={handleCancelPreview}
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                取消
              </button>
              <button
                onClick={handleApplyPreview}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                应用改写
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
