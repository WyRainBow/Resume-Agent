import { useEffect, useState, type RefObject } from 'react'

export function useCompactLayout(
  ref: RefObject<HTMLElement | null>,
  threshold = 440
) {
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return

    const update = () => {
      setIsCompact(node.clientWidth > 0 && node.clientWidth < threshold)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, threshold])

  return isCompact
}
