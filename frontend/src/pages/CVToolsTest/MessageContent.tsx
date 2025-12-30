import { useTypewriter } from '../../hooks/useTypewriter'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface MessageContentProps {
  content: string
  isStreaming?: boolean
  onStreamingComplete?: () => void  // 流式输出完成时的回调
}

/**
 * 消息内容组件
 * 对正在流式输出的消息使用打字机效果
 * 支持 Markdown 格式渲染
 */
export function MessageContent({ content, isStreaming = false, onStreamingComplete }: MessageContentProps) {
  const [localIsStreaming, setLocalIsStreaming] = useState(isStreaming)
  
  // 更新本地流式状态
  if (isStreaming !== localIsStreaming) {
    setLocalIsStreaming(isStreaming)
  }
  
  // 只在流式输出时启用打字机效果
  const displayedContent = useTypewriter(content, {
    speed: 5,  // 每帧显示 5 个字符
    delay: 50,  // 每帧之间延迟 50ms（约 100 字符/秒）
    enabled: localIsStreaming,
    onComplete: () => {
      // 打字机效果完成，通知父组件
      setLocalIsStreaming(false)
      if (onStreamingComplete) {
        onStreamingComplete()
      }
    }
  })

  return (
    <div className="markdown-content">
      <ReactMarkdown
        components={{
          // 自定义标题样式
          h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-gray-800">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-gray-800">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1 text-gray-800">{children}</h3>,
          // 段落样式
          p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
          // 粗体样式
          strong: ({ children }) => <strong className="font-semibold text-gray-800">{children}</strong>,
          // 无序列表样式
          ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
          // 有序列表样式
          ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
          // 列表项样式
          li: ({ children }) => <li className="ml-2">{children}</li>,
          // 代码块样式
          code: ({ children, className }) => {
            const isInline = !className
            return isInline 
              ? <code className="bg-gray-100 px-1 py-0.5 rounded text-sm text-violet-600">{children}</code>
              : <code className="block bg-gray-100 p-3 rounded-lg my-2 text-sm overflow-x-auto">{children}</code>
          },
          // 引用块样式
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-violet-300 pl-3 my-2 text-gray-600 italic">
              {children}
            </blockquote>
          ),
          // 分隔线样式
          hr: () => <hr className="my-4 border-gray-200" />,
          // 链接样式
          a: ({ href, children }) => (
            <a href={href} className="text-violet-600 hover:text-violet-800 underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {displayedContent}
      </ReactMarkdown>
      {localIsStreaming && displayedContent.length < content.length && (
        <span className="inline-block w-0.5 h-4 bg-violet-500 ml-0.5 animate-pulse" />
      )}
    </div>
  )
}

