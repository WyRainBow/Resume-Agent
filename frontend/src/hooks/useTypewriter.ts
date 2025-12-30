import { useState, useEffect, useRef, useCallback } from 'react'

interface UseTypewriterOptions {
  initialDelay?: number
  baseDelay?: number
  punctuationDelay?: number
  enableSmartTokenization?: boolean
  speedVariation?: number
  maxBufferSize?: number
  speed?: number  // 每帧显示的字符数（1-5），默认 1
  enabled?: boolean  // 是否启用打字机效果，默认 true
  onComplete?: () => void  // 打字机效果完成时的回调
  delay?: number  // 每帧之间的延迟（毫秒），默认 30ms
}

interface UseTypewriterResult {
  text: string
  isTyping: boolean
  appendContent: (content: string) => void
  skipToEnd: () => void
  reset: () => void
}

/**
 * 打字机效果 Hook
 * 将批量到达的内容逐字显示，模拟 ChatGPT 式的流式输出体验
 */
export function useTypewriter(
  options: UseTypewriterOptions = {}
): UseTypewriterResult {
  const {
    speed = 1,
    enabled = true,
    onComplete,
    delay = 30,
    initialDelay = 100,
    baseDelay: _baseDelay,
    punctuationDelay: _punctuationDelay,
    enableSmartTokenization: _enableSmartTokenization,
    speedVariation: _speedVariation,
    maxBufferSize: _maxBufferSize,
  } = options

  const [text, setText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const targetContentRef = useRef('')
  const displayedLengthRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const onCompleteRef = useRef(onComplete)
  const hasCompletedRef = useRef(false)

  // 更新回调引用
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // 追加内容
  const appendContent = useCallback((content: string) => {
    targetContentRef.current += content
    hasCompletedRef.current = false
    if (!enabled) {
      setText(targetContentRef.current)
      displayedLengthRef.current = targetContentRef.current.length
    }
  }, [enabled])

  // 重置
  const reset = useCallback(() => {
    targetContentRef.current = ''
    setText('')
    displayedLengthRef.current = 0
    hasCompletedRef.current = false
    setIsTyping(false)
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // 跳到结尾
  const skipToEnd = useCallback(() => {
    const finalText = targetContentRef.current
    setText(finalText)
    displayedLengthRef.current = finalText.length
    setIsTyping(false)
    hasCompletedRef.current = true
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (onCompleteRef.current) {
      onCompleteRef.current()
    }
  }, [])

  // 打字机效果
  useEffect(() => {
    const targetContent = targetContentRef.current

    if (!enabled) {
      // 如果禁用打字机效果，直接显示全部内容
      setText(targetContent)
      displayedLengthRef.current = targetContent.length
      setIsTyping(false)
      return
    }

    // 如果没有新内容需要显示
    if (targetContent.length <= displayedLengthRef.current) {
      setIsTyping(false)
      return
    }

    setIsTyping(true)

    const animate = () => {
      const currentTarget = targetContentRef.current
      if (displayedLengthRef.current < currentTarget.length) {
        // 每帧显示 speed 个字符
        const charsToAdd = Math.min(speed, currentTarget.length - displayedLengthRef.current)
        displayedLengthRef.current += charsToAdd
        setText(currentTarget.slice(0, displayedLengthRef.current))
        // 使用 setTimeout 添加延迟
        timeoutRef.current = window.setTimeout(() => {
          animationFrameRef.current = requestAnimationFrame(animate)
        }, delay)
      } else {
        // 打字机效果完成
        setIsTyping(false)
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true
          if (onCompleteRef.current) {
            onCompleteRef.current()
          }
        }
      }
    }

    // 初始延迟后开始动画
    timeoutRef.current = window.setTimeout(() => {
      animationFrameRef.current = requestAnimationFrame(animate)
    }, initialDelay)

    // 清理函数
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, speed, delay, initialDelay]) // 移除 text 依赖，避免无限循环

  return {
    text,
    isTyping,
    appendContent,
    skipToEnd,
    reset,
  }
}

// 保持向后兼容的旧版本（简单版本，只返回显示的内容）
interface UseTypewriterSimpleOptions {
  speed?: number
  enabled?: boolean
  onComplete?: () => void
  delay?: number
}

export function useTypewriterSimple(
  targetContent: string,
  options: UseTypewriterSimpleOptions = {}
) {
  const { speed = 1, enabled = true, onComplete, delay = 30 } = options
  const [displayedContent, setDisplayedContent] = useState('')
  const displayedLengthRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const targetContentRef = useRef(targetContent)
  const onCompleteRef = useRef(onComplete)
  const hasCompletedRef = useRef(false)

  // 更新回调引用
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // 更新目标内容引用
  useEffect(() => {
    targetContentRef.current = targetContent
    // 内容变化时重置完成标志
    if (targetContent.length !== displayedLengthRef.current) {
      hasCompletedRef.current = false
    }
  }, [targetContent])

  useEffect(() => {
    if (!enabled) {
      // 如果禁用打字机效果，直接显示全部内容
      setDisplayedContent(targetContent)
      displayedLengthRef.current = targetContent.length
      return
    }

    // 如果目标内容长度小于已显示长度，重置（新消息）
    if (targetContent.length < displayedLengthRef.current) {
      displayedLengthRef.current = 0
      setDisplayedContent('')
    }

    // 如果有新内容需要显示
    if (targetContent.length > displayedLengthRef.current) {
      const animate = () => {
        const currentTarget = targetContentRef.current
        if (displayedLengthRef.current < currentTarget.length) {
          // 每帧显示 speed 个字符
          const charsToAdd = Math.min(speed, currentTarget.length - displayedLengthRef.current)
          displayedLengthRef.current += charsToAdd
          setDisplayedContent(currentTarget.slice(0, displayedLengthRef.current))
          // 使用 setTimeout 添加延迟，让打字机效果更慢
          timeoutRef.current = window.setTimeout(() => {
            animationFrameRef.current = requestAnimationFrame(animate)
          }, delay)
        } else {
          // 打字机效果完成
          if (!hasCompletedRef.current) {
            hasCompletedRef.current = true
            // 调用完成回调
            if (onCompleteRef.current) {
              onCompleteRef.current()
            }
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    // 清理函数
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [targetContent, enabled, speed, delay])

  return displayedContent
}
