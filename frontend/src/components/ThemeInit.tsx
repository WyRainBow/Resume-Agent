import { useEffect } from 'react'

const THEME_KEY = 'app-theme'

export function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | 'system' | null
    const root = document.documentElement
    const apply = (dark: boolean) => {
      if (dark) root.classList.add('dark')
      else root.classList.remove('dark')
    }
    // 默认浅色，不跟随系统；仅显式选择 dark 时用深色
    if (stored === 'dark') apply(true)
    else apply(false)
  }, [])
  return null
}
