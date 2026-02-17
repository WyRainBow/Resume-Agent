/**
 * 骨架屏组件 - 用于加载状态占位
 * 提升用户等待体验
 */

import React from 'react'
import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

/**
 * 基础骨架屏组件
 */
export function Skeleton({ 
  className = '', 
  variant = 'text',
  width,
  height,
  animation = 'pulse'
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200'
  
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg'
  }
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'skeleton-wave',
    none: ''
  }
  
  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height
  
  return (
    <div 
      className={clsx(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
    />
  )
}

/**
 * 文本骨架屏 - 多行文本占位
 */
export function TextSkeleton({ 
  lines = 3, 
  className = '' 
}: { 
  lines?: number
  className?: string 
}) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          variant="text" 
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  )
}

/**
 * 头像骨架屏
 */
export function AvatarSkeleton({ 
  size = 40,
  className = ''
}: { 
  size?: number
  className?: string
}) {
  return (
    <Skeleton 
      variant="circular" 
      width={size} 
      height={size}
      className={className}
    />
  )
}

/**
 * 卡片骨架屏
 */
export function CardSkeleton({ 
  className = '' 
}: { 
  className?: string 
}) {
  return (
    <div className={clsx('p-4 border rounded-lg', className)}>
      <div className="flex items-center gap-3 mb-4">
        <AvatarSkeleton size={48} />
        <div className="flex-1">
          <Skeleton variant="text" width="40%" className="mb-2" />
          <Skeleton variant="text" width="60%" />
        </div>
      </div>
      <TextSkeleton lines={3} />
    </div>
  )
}

/**
 * 简历卡片骨架屏
 */
export function ResumeCardSkeleton({ 
  className = '' 
}: { 
  className?: string 
}) {
  return (
    <div className={clsx('p-4 bg-white rounded-xl border border-gray-200', className)}>
      <Skeleton variant="rounded" height={120} className="mb-4" />
      <Skeleton variant="text" width="70%" className="mb-2" />
      <Skeleton variant="text" width="50%" className="mb-4" />
      <div className="flex gap-2">
        <Skeleton variant="rounded" width={80} height={32} />
        <Skeleton variant="rounded" width={80} height={32} />
      </div>
    </div>
  )
}

/**
 * 列表骨架屏
 */
export function ListSkeleton({ 
  items = 5,
  className = ''
}: { 
  items?: number
  className?: string
}) {
  return (
    <div className={clsx('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <AvatarSkeleton size={40} />
          <div className="flex-1">
            <Skeleton variant="text" width="30%" className="mb-1" />
            <Skeleton variant="text" width="80%" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default Skeleton
