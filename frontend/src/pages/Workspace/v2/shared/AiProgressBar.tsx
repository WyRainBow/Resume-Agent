/**
 * AI 处理进度条（模拟）
 * AI 接口不返回真实进度，这里用渐近曲线（1 - e^-t）让进度平滑爬升到 ~90%，
 * 给用户“在跑”的反馈；任务结束时父级会卸载 loading 区块，进度条随之消失。
 */
import { useEffect, useState } from 'react'

interface AiProgressBarProps {
  /** 是否处于加载中（true 时开始爬升） */
  active: boolean
  /** 填充条样式（Tailwind 背景类，可用渐变） */
  barClassName?: string
  /** 预计耗时（毫秒），用于控制爬升速度 */
  estimateMs?: number
}

export default function AiProgressBar({
  active,
  barClassName = 'bg-blue-500',
  estimateMs = 12000,
}: AiProgressBarProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!active) {
      setProgress(0)
      return
    }
    setProgress(0)
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - start
      // 渐近 90%：耗时越接近 estimateMs 越慢，永不到 100%（完成由父级卸载触发）
      const pct = 90 * (1 - Math.exp(-elapsed / (estimateMs * 0.5)))
      setProgress(pct)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, estimateMs])

  return (
    <div className="w-full max-w-xs">
      <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-out ${barClassName}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] tabular-nums text-neutral-400">{Math.round(progress)}%</p>
    </div>
  )
}
