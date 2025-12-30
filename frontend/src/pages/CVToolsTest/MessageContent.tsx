import { useTypewriter } from '../../hooks/useTypewriter'
import { useState } from 'react'

interface MessageContentProps {
  content: string
  isStreaming?: boolean
  onStreamingComplete?: () => void  // 流式输出完成时的回调
}

/**
 * 消息内容组件
 * 对正在流式输出的消息使用打字机效果
 */
export function MessageContent({ content, isStreaming = false, onStreamingComplete }: MessageContentProps) {
  const [localIsStreaming, setLocalIsStreaming] = useState(isStreaming)
  
  // 更新本地流式状态
  if (isStreaming !== localIsStreaming) {
    setLocalIsStreaming(isStreaming)
  }
  
  // 只在流式输出时启用打字机效果
  const displayedContent = useTypewriter(content, {
    speed: 2,  // 每帧显示 2 个字符
    delay: 50,  // 每帧之间延迟 50ms（约 40 字符/秒）
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
    <>
      <span>{displayedContent}</span>
      {localIsStreaming && displayedContent.length < content.length && (
        <span className="inline-block w-0.5 h-4 bg-violet-500 ml-0.5 animate-pulse" />
      )}
    </>
  )
}

