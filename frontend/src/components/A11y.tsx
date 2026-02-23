/**
 * 跳转链接组件 - 提升键盘导航体验
 * 允许用户跳过导航直接到达主内容
 */

import React from 'react'

interface SkipLinkProps {
  targetId: string
  label?: string
}

/**
 * SkipLink - 无障碍跳转链接
 * 
 * 使用方式：
 * 1. 在页面顶部添加 <SkipLink targetId="main-content" />
 * 2. 在主内容区域添加 id="main-content"
 * 
 * 按 Tab 键时会显示跳转链接，点击后直接跳到主内容
 */
export function SkipLink({ 
  targetId, 
  label = '跳转到主内容' 
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      target.focus()
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
                 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-slate-900 
                 focus:text-white focus:rounded-lg focus:font-bold
                 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
    >
      {label}
    </a>
  )
}

/**
 * VisuallyHidden - 视觉隐藏但保持可访问性
 * 用于为屏幕阅读器提供额外信息
 */
export function VisuallyHidden({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <span className="sr-only">
      {children}
    </span>
  )
}

/**
 * FocusTrap - 焦点陷阱（模态框使用）
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement>, isActive: boolean) {
  React.useEffect(() => {
    if (!isActive || !ref.current) return

    const focusableElements = ref.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    firstElement?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [ref, isActive])
}

export default SkipLink
