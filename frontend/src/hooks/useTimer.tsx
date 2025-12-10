import React, { useState, useRef, useCallback } from 'react'

/**
 * 计时器 Hook
 * 用于 AI 解析等需要计时的场景
 */
export function useTimer() {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [finalTime, setFinalTime] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // 开始计时
  const startTimer = useCallback(() => {
    setElapsedTime(0)
    setFinalTime(null)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current)
    }, 100)
  }, [])

  // 停止计时
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (startTimeRef.current > 0) {
      const final = Date.now() - startTimeRef.current
      setFinalTime(final)
      setElapsedTime(final)
    }
  }, [])

  // 重置计时器
  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setElapsedTime(0)
    setFinalTime(null)
    startTimeRef.current = 0
  }, [])

  // 格式化时间显示
  const formatTime = (ms: number) => `${(ms / 1000).toFixed(1)}s`

  // 获取时间颜色（绿色 <2s / 橙色 2-5s / 红色 >5s）
  const getTimeColor = (ms: number) => {
    if (ms < 2000) return '#10b981' // 绿色
    if (ms < 5000) return '#f59e0b' // 橙色
    return '#ef4444' // 红色
  }

  return {
    elapsedTime,
    finalTime,
    startTimer,
    stopTimer,
    resetTimer,
    formatTime,
    getTimeColor,
  }
}

/**
 * 计时器显示组件
 */
export function TimerDisplay({ 
  loading, 
  elapsedTime, 
  finalTime,
  formatTime,
  getTimeColor,
}: {
  loading: boolean
  elapsedTime: number
  finalTime: number | null
  formatTime: (ms: number) => string
  getTimeColor: (ms: number) => string
}) {
  if (!loading && finalTime === null) return null
  
  const time = loading ? elapsedTime : (finalTime || 0)
  const color = getTimeColor(time)
  
  return (
    <span style={{ 
      fontSize: '12px', 
      color,
      fontWeight: 500,
      minWidth: '40px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }}>
      {loading ? (
        <>⏱️ {formatTime(time)}</>
      ) : (
        <>✓ {formatTime(time)}</>
      )}
    </span>
  )
}
