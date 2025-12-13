/**
 * 分割条拖拽 Hook
 * 处理左右面板分割条的拖拽调整
 */
import { useCallback, useEffect } from 'react'

interface UsePanelResizeProps {
  isDragging: boolean
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>
  setLeftPanelWidth: React.Dispatch<React.SetStateAction<number | null>>
  containerRef: React.RefObject<HTMLDivElement>
}

export function usePanelResize({
  isDragging,
  setIsDragging,
  setLeftPanelWidth,
  containerRef,
}: UsePanelResizeProps) {

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [setIsDragging])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const newWidth = e.clientX - containerRect.left
    // 限制宽度范围：280px ~ 50%
    const maxWidth = containerRect.width * 0.5
    setLeftPanelWidth(Math.max(280, Math.min(newWidth, maxWidth)))
  }, [isDragging, containerRef, setLeftPanelWidth])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [setIsDragging])

  // 监听全局鼠标事件
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return {
    handleMouseDown,
  }
}
