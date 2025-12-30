import { useState, useEffect, useRef } from 'react'

/**
 * 打字机效果 Hook
 * 将批量到达的内容逐字显示，模拟 ChatGPT 式的流式输出体验
 */
export function useTypewriter(
  targetContent: string,
  options: {
    speed?: number  // 每帧显示的字符数（1-5），默认 3
    enabled?: boolean  // 是否启用打字机效果，默认 true
    onComplete?: () => void  // 打字机效果完成时的回调
  } = {}
) {
  const { speed = 3, enabled = true, onComplete } = options
  const [displayedContent, setDisplayedContent] = useState('')
  const displayedLengthRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
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
          animationFrameRef.current = requestAnimationFrame(animate)
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
    }
  }, [targetContent, enabled, speed])

  return displayedContent
}
