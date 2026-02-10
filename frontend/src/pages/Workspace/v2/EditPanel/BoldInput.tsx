/**
 * 支持加粗显示的输入组件
 * 内部存储为 Markdown 格式（**文本**），但用户看到的是加粗效果
 *
 * 点击 B 按钮：整段内容在"加粗 ↔ 非加粗"之间切换，并触发 onChange（驱动 PDF 渲染）
 */
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Bold } from 'lucide-react'
import { cn } from '../../../../lib/utils'

interface BoldInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  label?: string
}

/** 去除 Markdown 加粗标记，返回纯文本 */
const stripBoldMarkers = (text: string): string =>
  text.replace(/\*\*(.+?)\*\*/g, '$1')

/** 判断整段文本是否处于加粗状态（整段被 ** 包裹，或无纯文本部分在 ** 之外） */
const isFullyBold = (text: string): boolean => {
  if (!text || !text.trim()) return false
  const trimmed = text.trim()
  // 整段被 ** 包裹
  if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
    return true
  }
  // 也检查已有 <strong>/<b> 标签的场景（理论上存储是 markdown，但兜底）
  return false
}

const BoldInput: React.FC<BoldInputProps> = ({
  value,
  onChange,
  placeholder,
  className,
  label,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  // ---------- Markdown ↔ HTML 转换 ----------
  const markdownToHtml = (text: string): string => {
    if (!text) return ''
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  }

  const htmlToMarkdown = (html: string): string => {
    if (!html) return ''
    return html
      .replace(/<strong>(.+?)<\/strong>/g, '**$1**')
      .replace(/<b>(.+?)<\/b>/g, '**$1**')
  }

  // ---------- 加粗状态 ----------
  const [isBold, setIsBold] = useState(() => isFullyBold(value))

  // value 变化时同步 isBold
  useEffect(() => {
    setIsBold(isFullyBold(value))
  }, [value])

  // ---------- 初始化编辑器内容 ----------
  useEffect(() => {
    if (!editorRef.current) return
    const currentHtml = editorRef.current.innerHTML.trim()
    if (!currentHtml || currentHtml === '<br>') {
      const html = markdownToHtml(value || '')
      if (html) {
        editorRef.current.innerHTML = html
      }
    }
  }, [])

  // ---------- 非聚焦时同步 value → 编辑器 ----------
  useEffect(() => {
    if (!editorRef.current || isFocused) return
    const html = markdownToHtml(value || '')
    const currentHtml = editorRef.current.innerHTML.trim()
    if (!value || !value.trim()) {
      if (currentHtml && currentHtml !== '<br>') {
        editorRef.current.innerHTML = ''
      }
    } else if (currentHtml !== html) {
      editorRef.current.innerHTML = html
    }
  }, [value, isFocused])

  // ---------- 用户输入 → 同步到 value ----------
  const handleInput = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    const markdown = htmlToMarkdown(html)
    if (markdown !== value) {
      onChange(markdown)
    }
  }, [value, onChange])

  // ---------- B 按钮点击：数据层 toggle ----------
  const handleBoldClick = useCallback(() => {
    // 拿到纯文本（去掉 ** 标记）
    const plainText = stripBoldMarkers(value).trim()
    if (!plainText) return // 没有内容，不操作

    let newValue: string
    if (isFullyBold(value)) {
      // 当前是加粗 → 去掉加粗
      newValue = plainText
    } else {
      // 当前非加粗 → 加粗整段
      newValue = `**${plainText}**`
    }

    // 同步编辑器显示
    if (editorRef.current) {
      editorRef.current.innerHTML = markdownToHtml(newValue)
    }

    // 调用 onChange → 触发上层状态更新 → 触发 PDF 渲染
    onChange(newValue)
  }, [value, onChange])

  // ---------- 粘贴：只保留纯文本 ----------
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    handleInput()
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm text-gray-600 dark:text-neutral-300">
          {label}
        </label>
      )}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            handleInput()
          }}
          data-placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 rounded-md border min-h-[38px]',
            'bg-white border-gray-200 text-gray-700',
            'dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            '[&_strong]:font-bold [&_b]:font-bold',
            'pr-10',
            className
          )}
          style={{
            ...(placeholder && !value && !isFocused
              ? { position: 'relative' as const }
              : {}),
          }}
          suppressContentEditableWarning
        />
        {placeholder && !value && !isFocused && (
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
            style={{ top: '50%' }}
          >
            {placeholder}
          </div>
        )}
        {/* B 按钮：onMouseDown preventDefault 防止抢焦点 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleBoldClick}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded border transition-colors',
            'hover:bg-gray-100 dark:hover:bg-neutral-800',
            'text-gray-600 dark:text-neutral-400',
            isBold
              ? 'bg-primary/10 dark:bg-primary/15 text-primary border-primary/30'
              : 'border-transparent'
          )}
          title={isBold ? '取消加粗' : '加粗'}
        >
          <Bold className={cn('w-4 h-4', isBold && 'stroke-[2.5]')} />
        </button>
      </div>
    </div>
  )
}

export default BoldInput
