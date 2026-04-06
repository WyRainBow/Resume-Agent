/**
 * 划词改写气泡
 * 选中文本 → 弹出输入框 → 输入指令 → AI 改写 → 替换回选区
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { Loader2, Sparkles, Send, X, Check, Eye } from 'lucide-react'
import { rewriteTextStream } from '../../../../services/api'
import type { Editor } from '@tiptap/core'
import { DOMParser as ProseMirrorDOMParser } from 'prosemirror-model'

interface SelectionPolishBubbleProps {
  editor: Editor
  polishPath: string
  bubbleActiveRef: React.MutableRefObject<boolean>
  selectionSnapshotRef: React.MutableRefObject<{ from: number; to: number; text: string; html: string } | null>
  onLockSelection: (selection: { from: number; to: number }) => void
  onUnlockSelection: () => void
}

export default function SelectionPolishBubble({
  editor,
  polishPath,
  bubbleActiveRef,
  selectionSnapshotRef,
  onLockSelection,
  onUnlockSelection,
}: SelectionPolishBubbleProps) {
  const logSelectionBubbleDebug = (event: string, data?: Record<string, unknown>) => {
    console.log(`[SELECTION LOCK DEBUG][Bubble][${event}]`, data || {})
  }

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
  const chatEndRef = useRef<HTMLDivElement>(null)
  const insidePointerRef = useRef(false)

  const isRemoveBoldInstruction = (value: string): boolean => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    return (
      normalized.includes('去掉加粗') ||
      normalized.includes('取消加粗') ||
      normalized.includes('不要加粗') ||
      normalized.includes('remove bold') ||
      normalized.includes('no bold')
    )
  }

  const shouldConvertUlToOl = (value: string): boolean => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    return (
      normalized.includes('无序列表改成有序列表') ||
      normalized.includes('无序改有序') ||
      normalized.includes('改成有序列表') ||
      (normalized.includes('无序列表') && normalized.includes('有序列表'))
    )
  }

  const shouldAutoBoldTechKeywords = (value: string): boolean => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    return normalized.includes('技术关键词') && normalized.includes('加粗')
  }

  const shouldBoldAll = (value: string): boolean => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    if (isRemoveBoldInstruction(normalized)) return false
    return normalized.includes('加粗') || normalized.includes('加黑') || normalized.includes('bold')
  }

  const isDirectFormatInstruction = (value: string): boolean => {
    const normalized = value.trim()
    if (!normalized) return false
    return (
      shouldBoldAll(normalized) ||
      isRemoveBoldInstruction(normalized) ||
      shouldConvertUlToOl(normalized)
    )
  }

  const stripBoldMarkup = (html: string): string => {
    if (!html) return html
    return html
      .replace(/<\s*\/?\s*(strong|b)\s*>/gi, '')
      .replace(/\s*style\s*=\s*"([^"]*?)"/gi, (_m, styleValue: string) => {
        const kept = styleValue
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((entry) => !/font-weight\s*:/i.test(entry))
        if (kept.length === 0) return ''
        return ` style="${kept.join('; ')}"`
      })
      .replace(/\s*style\s*=\s*'([^']*?)'/gi, (_m, styleValue: string) => {
        const kept = styleValue
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((entry) => !/font-weight\s*:/i.test(entry))
        if (kept.length === 0) return ''
        return ` style='${kept.join('; ')}'`
      })
  }

  const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const extractBoldKeywords = (instructions: string[]): string[] => {
    const found = new Set<string>()
    const techDefaults = [
      'Java',
      'Go',
      'Python',
      'Spring Boot',
      'Spring',
      'MySQL',
      'Redis',
      'Kafka',
      'Docker',
      'Kubernetes',
      'K8s',
      'LLM',
      'RAG',
      'Agent',
      'TypeScript',
      'React',
      'Node.js',
      'Golang',
      'PostgreSQL',
      'MongoDB',
      'Elasticsearch',
    ]

    for (const raw of instructions) {
      const text = raw.trim()
      if (!text) continue

      const quoted = text.match(/[“"']([^“"']+)[”"']/g) || []
      for (const q of quoted) {
        const cleaned = q.replace(/[“”"']/g, '').trim()
        if (cleaned) found.add(cleaned)
      }

      const keywordSegment = text.match(/(?:关键词|关键字|技术关键词)[：:\s]*(.+?)(?:加粗|突出|即可|。|$)/)
      if (keywordSegment?.[1]) {
        keywordSegment[1]
          .split(/[、,，/\s]+/)
          .map((v) => v.trim())
          .filter(Boolean)
          .forEach((v) => found.add(v))
      }

      const directSegment = text.match(/(?:把|将)(.+?)(?:加粗|加黑|突出)/)
      if (directSegment?.[1]) {
        directSegment[1]
          .split(/[、,，/\s]+/)
          .map((v) => v.trim())
          .filter(Boolean)
          .forEach((v) => found.add(v))
      }

      if (shouldAutoBoldTechKeywords(text)) {
        for (const k of techDefaults) found.add(k)
      }
    }

    return Array.from(found).filter((v) => v.length >= 2).sort((a, b) => b.length - a.length)
  }

  const boldKeywordsInHtml = (html: string, keywords: string[]): string => {
    if (!html || keywords.length === 0) return html

    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="__root__">${html}</div>`, 'text/html')
    const root = doc.getElementById('__root__')
    if (!root) return html

    const pattern = new RegExp(keywords.map((k) => escapeRegex(k)).join('|'), 'gi')
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []

    let current = walker.nextNode()
    while (current) {
      const node = current as Text
      const parentEl = node.parentElement
      const inBold = !!parentEl?.closest('strong,b')
      if (parentEl && !inBold && node.nodeValue && node.nodeValue.trim()) {
        textNodes.push(node)
      }
      current = walker.nextNode()
    }

    for (const textNode of textNodes) {
      const text = textNode.nodeValue || ''
      pattern.lastIndex = 0
      if (!pattern.test(text)) continue

      pattern.lastIndex = 0
      const frag = doc.createDocumentFragment()
      let last = 0
      let match: RegExpExecArray | null = pattern.exec(text)
      while (match) {
        const index = match.index
        if (index > last) {
          frag.appendChild(doc.createTextNode(text.slice(last, index)))
        }
        const strong = doc.createElement('strong')
        strong.textContent = match[0]
        frag.appendChild(strong)
        last = index + match[0].length
        match = pattern.exec(text)
      }
      if (last < text.length) {
        frag.appendChild(doc.createTextNode(text.slice(last)))
      }
      textNode.parentNode?.replaceChild(frag, textNode)
    }

    return root.innerHTML
  }

  const convertUlToOl = (html: string): string => {
    if (!html) return html
    return html
      .replace(/<\s*ul(\s[^>]*)?>/gi, (_m, attrs = '') => `<ol${attrs}>`)
      .replace(/<\s*\/\s*ul\s*>/gi, '</ol>')
  }

  const boldAllTextInHtml = (html: string): string => {
    if (!html) return html
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="__root__">${html}</div>`, 'text/html')
    const root = doc.getElementById('__root__')
    if (!root) return html

    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    let current = walker.nextNode()
    while (current) {
      const node = current as Text
      const parentEl = node.parentElement
      const inBold = !!parentEl?.closest('strong,b')
      if (parentEl && !inBold && node.nodeValue && node.nodeValue.trim()) {
        textNodes.push(node)
      }
      current = walker.nextNode()
    }

    for (const textNode of textNodes) {
      const strong = doc.createElement('strong')
      strong.textContent = textNode.nodeValue || ''
      textNode.parentNode?.replaceChild(strong, textNode)
    }

    return root.innerHTML
  }

  const normalizeMarkdownBoldToHtml = (content: string): string => {
    if (!content) return content
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
  }

  const applyInstructionTransforms = (html: string, instructions: string[]): string => {
    if (!html.trim()) return html
    let result = normalizeMarkdownBoldToHtml(html)
    const merged = instructions.join(' ')

    if (isRemoveBoldInstruction(merged)) {
      result = stripBoldMarkup(result)
    }
    if (shouldConvertUlToOl(merged)) {
      result = convertUlToOl(result)
    }

    const keywords = extractBoldKeywords(instructions)
    if (keywords.length > 0) {
      result = boldKeywordsInHtml(result, keywords)
    } else if (shouldBoldAll(merged)) {
      result = boldAllTextInHtml(result)
    }

    return result
  }

  // 气泡出现时锁定一次选区快照（包含富文本），并自动聚焦输入框
  useEffect(() => {
    const { from, to } = editor.state.selection
    const plainText = editor.state.doc.textBetween(from, to, '\n')

    // 通过 DOM Selection 保留当前选区的富文本结构（如 <strong>）
    let html = ''
    const domSelection = window.getSelection()
    if (domSelection && domSelection.rangeCount > 0) {
      const range = domSelection.getRangeAt(0)
      const container = document.createElement('div')
      container.appendChild(range.cloneContents())
      html = container.innerHTML
    }

    if (plainText.trim()) {
      logSelectionBubbleDebug('mount-snapshot', {
        from,
        to,
        textLength: plainText.length,
      })
      selectionSnapshotRef.current = {
        from,
        to,
        text: plainText,
        html: html || plainText,
      }
      onLockSelection({ from, to })
    } else {
      if (selectionSnapshotRef.current?.text?.trim()) {
        logSelectionBubbleDebug('mount-empty-selection-keep-snapshot', {
          from: selectionSnapshotRef.current.from,
          to: selectionSnapshotRef.current.to,
          textLength: selectionSnapshotRef.current.text.length,
        })
      } else {
        logSelectionBubbleDebug('mount-empty-selection')
      }
    }
    bubbleActiveRef.current = true

    const timer = setTimeout(() => {
      logSelectionBubbleDebug('focus-input')
      inputRef.current?.focus()
    }, 50)

    return () => {
      logSelectionBubbleDebug('unmount-bubble')
      bubbleActiveRef.current = false
      clearTimeout(timer)
    }
  }, [bubbleActiveRef, editor, onLockSelection, onUnlockSelection, selectionSnapshotRef])

  const handleSend = useCallback(() => {
    const instruction = input.trim()
    if (!instruction || isStreaming) return

    const snapshot = selectionSnapshotRef.current
    const from = snapshot?.from ?? editor.state.selection.from
    const to = snapshot?.to ?? editor.state.selection.to
    const selectedText = snapshot?.text ?? editor.state.doc.textBetween(from, to, '\n')
    const selectedHtml = snapshot?.html ?? selectedText
    if (!selectedText.trim()) return

    setInput('')
    setError(null)
    bubbleActiveRef.current = true

    // 纯格式指令本地处理：确保“划到哪儿就只改哪儿”
    if (isDirectFormatInstruction(instruction)) {
      const normalized = applyInstructionTransforms(selectedHtml, [instruction])
      setLatestPolished(normalized)
      setChatMessages([
        { id: `o-${Date.now()}`, type: 'original', content: selectedHtml },
        { id: `u-${Date.now()}`, type: 'user', content: instruction },
        { id: `a-${Date.now()}`, type: 'ai', content: normalized },
      ])
      setChatOpen(true)
      bubbleActiveRef.current = false
      return
    }

    setIsStreaming(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    let fullContent = ''

    rewriteTextStream(
      selectedHtml,
      instruction,
      polishPath,
      (chunk: string) => {
        fullContent += chunk
      },
      () => {
        setIsStreaming(false)
        if (fullContent.trim()) {
          const normalized = normalizeMarkdownBoldToHtml(fullContent)
          setLatestPolished(normalized)
          setChatMessages([
            { id: `o-${Date.now()}`, type: 'original', content: selectedHtml },
            { id: `u-${Date.now()}`, type: 'user', content: instruction },
            { id: `a-${Date.now()}`, type: 'ai', content: normalized },
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

    const baseText = latestPolished || selectionSnapshotRef.current?.html || selectionSnapshotRef.current?.text || ''
    if (!baseText.trim()) return

    // 对话框里的纯格式指令也本地处理，避免超出原选区语义
    if (isDirectFormatInstruction(instruction)) {
      const normalized = applyInstructionTransforms(baseText, [instruction])
      setChatInput('')
      setLatestPolished(normalized)
      setChatMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, type: 'user', content: instruction },
        { id: `a-${Date.now()}`, type: 'ai', content: normalized, isStreaming: false },
      ])
      return
    }

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
          const normalized = normalizeMarkdownBoldToHtml(full)
          setLatestPolished(normalized)
          setChatMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, content: normalized, isStreaming: false } : m)),
          )
          return
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
      selectionSnapshotRef.current = null
      onUnlockSelection()
      editor.commands.focus()
    }
  }

  const markActive = () => {
    logSelectionBubbleDebug('mark-active')
    insidePointerRef.current = true
    setTimeout(() => {
      insidePointerRef.current = false
    }, 150)
    bubbleActiveRef.current = true
  }

  const handleApplyPreview = () => {
    const snapshot = selectionSnapshotRef.current
    const fallbackSnapshot = (() => {
      const { from, to } = editor.state.selection
      const text = editor.state.doc.textBetween(from, to, '\n')
      if (!text.trim()) return null
      return { from, to, text, html: text }
    })()
    const effectiveSnapshot = snapshot || fallbackSnapshot
    const fallbackPolished = [...chatMessages]
      .reverse()
      .find((m) => m.type === 'ai' && (m.content || '').trim())?.content || ''
    const effectivePolished = (latestPolished || fallbackPolished || '').trim()

    if (!effectiveSnapshot || !effectivePolished) {
      setChatOpen(false)
      bubbleActiveRef.current = false
      selectionSnapshotRef.current = null
      onUnlockSelection()
      return
    }
    const instructions = chatMessages.filter((m) => m.type === 'user').map((m) => m.content)
    const finalContent = applyInstructionTransforms(effectivePolished, instructions)
    if (!finalContent.trim()) {
      setError('改写内容为空，无法应用')
      return
    }

    const { from, to } = effectiveSnapshot

    // 先关闭弹窗，让编辑器恢复焦点后再操作
    setChatOpen(false)
    bubbleActiveRef.current = false
    selectionSnapshotRef.current = null
    onUnlockSelection()

    requestAnimationFrame(() => {
      // 统一按最终 HTML 结果替换选区，避免 setBold/unsetBold 受选区状态影响导致样式未落地
      const { state } = editor
      const container = document.createElement('div')
      container.innerHTML = finalContent
      const parser = ProseMirrorDOMParser.fromSchema(state.schema)
      const parsedSlice = parser.parseSlice(container, {
        preserveWhitespace: true,
        context: state.doc.resolve(from),
      })
      if (parsedSlice.content.size > 0) {
        const tr = state.tr.replaceRange(from, to, parsedSlice)
        if (tr.docChanged) {
          editor.view.dispatch(tr.scrollIntoView())
        } else {
          console.warn('[POLISH APPLY] transaction not changed')
        }
      } else {
        console.warn('[POLISH APPLY] parsedSlice empty')
      }
    })
  }

  const handleCancelPreview = () => {
    logSelectionBubbleDebug('cancel-preview')
    setChatOpen(false)
    bubbleActiveRef.current = false
    selectionSnapshotRef.current = null
    onUnlockSelection()
    editor.commands.focus()
  }

  const markInactiveIfOutside = () => {
    if (insidePointerRef.current) {
      logSelectionBubbleDebug('mark-inactive-skip-inside-pointer')
      bubbleActiveRef.current = true
      return
    }
    const root = rootRef.current
    if (!root) {
      logSelectionBubbleDebug('inactive-no-root')
      bubbleActiveRef.current = false
      return
    }
    const activeEl = document.activeElement
    bubbleActiveRef.current = !!(activeEl && root.contains(activeEl))
    logSelectionBubbleDebug('mark-inactive-check', {
      activeElementTag: (activeEl as HTMLElement | null)?.tagName || null,
      activeElementClass: (activeEl as HTMLElement | null)?.className || null,
      keepActive: bubbleActiveRef.current,
      isStreaming,
      chatOpen,
    })
    if (!bubbleActiveRef.current) {
      // 不在 blur 阶段解锁，避免点击气泡输入框时选区高亮被误清除。
      // 解锁统一交给：外部点击 / 取消 / 应用改写 / Esc。
      logSelectionBubbleDebug('inactive-defer-unlock')
    }
  }

  return (
    <>
      <div
        ref={rootRef}
        className="ai-polish-bubble"
        onPointerDownCapture={markActive}
        onMouseDownCapture={markActive}
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
        <div className="flex items-center gap-3 min-w-0 w-full">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 border border-slate-300/80 bg-slate-100 shadow-sm dark:border-slate-600 dark:bg-slate-700"
            aria-hidden
          >
            <Sparkles className="w-[17px] h-[17px] text-slate-800 dark:text-slate-100" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col justify-center gap-0.5 mr-0.5 shrink-0 min-w-[4.5rem]">
            <span className="text-[13px] font-semibold tracking-wide text-slate-900 dark:text-slate-50 leading-none">
              AI 改写
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none tracking-wide">
              划词优化
            </span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              logSelectionBubbleDebug('input-focus', {
                hasSnapshot: !!selectionSnapshotRef.current,
                bubbleActive: bubbleActiveRef.current,
              })
            }}
            onBlur={() => {
              logSelectionBubbleDebug('input-blur', {
                hasSnapshot: !!selectionSnapshotRef.current,
                bubbleActive: bubbleActiveRef.current,
              })
            }}
            onKeyDown={handleKeyDown}
            placeholder=" 输入改写指令例如：更专业..."
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
        <div
          className="selection-polish-chat fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
          onClick={handleCancelPreview}
        >
          <div
            className="selection-polish-chat bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                划词改写助手
              </span>
              <span className="text-xs text-violet-500 dark:text-violet-400">AI 改写对话</span>
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
                        <div
                          className="prose prose-sm max-w-none text-neutral-700 dark:text-neutral-300"
                          dangerouslySetInnerHTML={{ __html: msg.content }}
                        />
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
                          AI 改写中...
                        </div>
                      ) : (
                        <div
                          className="prose prose-sm max-w-none text-neutral-800 dark:text-neutral-100"
                          dangerouslySetInnerHTML={{ __html: msg.content }}
                        />
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
