/**
 * 支持加粗显示的输入组件
 * 内部存储为 Markdown 格式（**文本**），但用户看到的是加粗效果
 */
import React, { useRef, useEffect, useState } from 'react'
import { Bold } from 'lucide-react'
import { cn } from '../../../../lib/utils'

interface BoldInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  label?: string
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

  // 将 Markdown 格式转换为 HTML（用于显示）
  const markdownToHtml = (text: string): string => {
    if (!text) return ''
    // 将 **文本** 转换为 <strong>文本</strong>
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  }

  // 初始化：首次加载时设置内容
  useEffect(() => {
    if (!editorRef.current) return
    // 只在编辑器为空时初始化，避免覆盖用户正在输入的内容
    const currentHtml = editorRef.current.innerHTML.trim()
    if (!currentHtml || currentHtml === '<br>') {
      const html = markdownToHtml(value || '')
      if (html) {
        editorRef.current.innerHTML = html
      }
    }
  }, []) // 只在组件挂载时执行一次

  // 将 HTML 格式转换回 Markdown（用于存储）
  const htmlToMarkdown = (html: string): string => {
    if (!html) return ''
    // 将 <strong>文本</strong> 转换为 **文本**
    return html
      .replace(/<strong>(.+?)<\/strong>/g, '**$1**')
      .replace(/<b>(.+?)<\/b>/g, '**$1**')
  }

  // 同步 value 到编辑器显示
  useEffect(() => {
    if (!editorRef.current) return
    // 只在失去焦点时同步，避免在输入时打断用户
    if (!isFocused) {
      const html = markdownToHtml(value || '')
      const currentHtml = editorRef.current.innerHTML.trim()
      // 如果内容为空，清空编辑器（保持为空以便显示 placeholder）
      if (!value || !value.trim()) {
        if (currentHtml && currentHtml !== '<br>') {
          editorRef.current.innerHTML = ''
        }
      } else {
        // 有内容时，同步显示（只有当内容不同时才更新，避免不必要的 DOM 操作）
        if (currentHtml !== html) {
          editorRef.current.innerHTML = html
        }
      }
    }
  }, [value, isFocused])

  // 处理输入
  const handleInput = () => {
    if (!editorRef.current) return
    
    // 获取当前 HTML 内容
    const html = editorRef.current.innerHTML
    
    // 转换为 Markdown 格式存储
    const markdown = htmlToMarkdown(html)
    
    // 如果内容变化，更新 value
    if (markdown !== value) {
      onChange(markdown)
    }
  }

  // 处理加粗按钮点击
  const handleBoldClick = () => {
    if (!editorRef.current) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    
    // 检查是否在编辑器内
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      return
    }

    // 检查选中文本是否已经是加粗
    let isBold = false
    let node = range.commonAncestorContainer
    
    // 向上查找 strong 或 b 标签
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement
        if (element.tagName === 'STRONG' || element.tagName === 'B') {
          isBold = true
          break
        }
      }
      node = node.parentNode
    }

    // 如果已经是加粗，则取消加粗
    if (isBold) {
      document.execCommand('removeFormat', false)
      document.execCommand('unlink', false)
    } else {
      // 应用加粗
      document.execCommand('bold', false)
    }

    // 触发输入事件以更新存储
    handleInput()
    
    // 保持焦点
    editorRef.current.focus()
  }

  // 处理粘贴，清理格式
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    handleInput()
  }

  // 检查当前选中文本是否加粗
  const isSelectionBold = (): boolean => {
    if (!editorRef.current) return false
    
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const range = selection.getRangeAt(0)
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      return false
    }

    let node = range.commonAncestorContainer
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement
        if (element.tagName === 'STRONG' || element.tagName === 'B') {
          return true
        }
      }
      node = node.parentNode
    }
    return false
  }

  const [isBold, setIsBold] = useState(false)

  // 监听选择变化，更新加粗按钮状态
  useEffect(() => {
    const updateBoldState = () => {
      setIsBold(isSelectionBold())
    }

    document.addEventListener('selectionchange', updateBoldState)
    return () => {
      document.removeEventListener('selectionchange', updateBoldState)
    }
  }, [])

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
            'pr-10', // 为按钮留出空间
            className
          )}
          style={{
            ...(placeholder && !value && !isFocused
              ? {
                  position: 'relative' as const,
                }
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
        <button
          type="button"
          onClick={handleBoldClick}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded',
            'hover:bg-gray-100 dark:hover:bg-neutral-800',
            'text-gray-600 dark:text-neutral-400',
            'transition-colors',
            isBold && 'bg-gray-100 dark:bg-neutral-800 text-primary'
          )}
          title="加粗"
        >
          <Bold className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default BoldInput

