/**
 * 优化的打字机效果 Hook
 * 支持流式文本的平滑显示，智能分词和动态调整速度
 */
import { useState, useEffect, useRef, useCallback } from 'react'

interface TypewriterOptions {
  /** 初始延迟时间（ms） */
  initialDelay?: number
  /** 每个字符的基础延迟时间（ms） */
  baseDelay?: number
  /** 标点符号后的额外延迟（ms） */
  punctuationDelay?: number
  /** 是否启用智能分词（对中文友好） */
  enableSmartTokenization?: boolean
  /** 动态速度调整因子 */
  speedVariation?: number
  /** 最大缓冲区大小（防止积压过多内容） */
  maxBufferSize?: number
}

const DEFAULT_OPTIONS: Required<TypewriterOptions> = {
  initialDelay: 100,
  baseDelay: 30,
  punctuationDelay: 200,
  enableSmartTokenization: true,
  speedVariation: 0.3,
  maxBufferSize: 100
}

export function useTypewriter(options: TypewriterOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const [text, setText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bufferRef = useRef<string[]>([])
  const isProcessingRef = useRef(false)
  const animationFrameRef = useRef<number>()
  const lastUpdateTimeRef = useRef<number>(0)

  /**
   * 智能分词函数 - 特别优化中英文混合文本
   */
  const smartTokenize = useCallback((content: string): string[] => {
    const tokens: string[] = []
    let i = 0

    while (i < content.length) {
      const char = content[i]

      // HTML 标签作为一个整体
      if (char === '<') {
        const endIndex = content.indexOf('>', i)
        if (endIndex !== -1) {
          tokens.push(content.slice(i, endIndex + 1))
          i = endIndex + 1
          continue
        }
      }

      // 中文字符（单个字作为一个token）
      if (/[\u4e00-\u9fff]/.test(char)) {
        tokens.push(char)
        i++
      }
      // 英文单词
      else if (/[a-zA-Z]/.test(char)) {
        let word = char
        i++
        while (i < content.length && /[a-zA-Z0-9]/.test(content[i])) {
          word += content[i]
          i++
        }
        tokens.push(word)
      }
      // 数字
      else if (/[0-9]/.test(char)) {
        let number = char
        i++
        while (i < content.length && /[0-9.,%]/.test(content[i])) {
          number += content[i]
          i++
        }
        tokens.push(number)
      }
      // 标点符号
      else if (/[，。！？；：""''（）【】《》、]/.test(char)) {
        tokens.push(char)
        i++
      }
      // 空格和换行
      else if (/\s/.test(char)) {
        // 合并连续的空白字符
        let whitespace = char
        i++
        while (i < content.length && /\s/.test(content[i])) {
          whitespace += content[i]
          i++
        }
        tokens.push(whitespace)
      }
      // 其他字符
      else {
        tokens.push(char)
        i++
      }
    }

    return tokens
  }, [])

  /**
   * 计算每个token的显示延迟
   */
  const calculateDelay = useCallback((token: string): number => {
    // 基础延迟
    let delay = opts.baseDelay

    // 标点符号后延迟更长
    if (/[，。！？；：]/.test(token)) {
      delay = opts.punctuationDelay
    }

    // HTML标签快速显示
    if (token.startsWith('<') && token.endsWith('>')) {
      delay = 5
    }

    // 空格快速显示
    if (/^\s+$/.test(token)) {
      delay = 10
    }

    // 添加随机变化，让打字更自然
    const variation = 1 + (Math.random() - 0.5) * opts.speedVariation

    return delay * variation
  }, [opts])

  /**
   * 处理token队列的核心函数
   */
  const processTokens = useCallback(() => {
    if (!isProcessingRef.current || bufferRef.current.length === 0) {
      setIsTyping(false)
      return
    }

    const now = performance.now()
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current

    // 检查是否到了显示下一个token的时间
    if (timeSinceLastUpdate >= bufferRef.current[0].delay) {
      const token = bufferRef.current.shift()
      if (token) {
        setText(prev => prev + token.content)
        lastUpdateTimeRef.current = now
      }
    }

    // 继续处理队列
    animationFrameRef.current = requestAnimationFrame(processTokens)
  }, [])

  /**
   * 添加新内容到打字机缓冲区
   */
  const appendContent = useCallback((content: string) => {
    if (!content) return

    // 分词并计算延迟
    const tokens = smartTokenize(content)

    // 检查缓冲区大小，防止积压
    if (bufferRef.current.length > opts.maxBufferSize) {
      // 如果缓冲区太大，直接添加剩余内容
      const remainingTokens = tokens.splice(opts.maxBufferSize - bufferRef.current.length)
      setText(prev => prev + remainingTokens.join(''))
    }

    // 将token添加到缓冲区
    tokens.forEach(token => {
      bufferRef.current.push({
        content: token,
        delay: calculateDelay(token)
      })
    })

    // 开始处理
    if (!isProcessingRef.current) {
      isProcessingRef.current = true
      setIsTyping(true)
      lastUpdateTimeRef.current = performance.now() + opts.initialDelay
      processTokens()
    }
  }, [smartTokenize, calculateDelay, opts, processTokens])

  /**
   * 立即显示所有内容（跳过打字效果）
   */
  const skipToEnd = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    const remainingText = bufferRef.current.map(t => t.content).join('')
    setText(prev => prev + remainingText)
    bufferRef.current = []
    isProcessingRef.current = false
    setIsTyping(false)
  }, [])

  /**
   * 重置打字机状态
   */
  const reset = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setText('')
    bufferRef.current = []
    isProcessingRef.current = false
    setIsTyping(false)
    lastUpdateTimeRef.current = 0
  }, [])

  /**
   * 清理动画帧
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return {
    text,
    isTyping,
    appendContent,
    skipToEnd,
    reset
  }
}

// 内部类型定义
interface TokenWithDelay {
  content: string
  delay: number
}