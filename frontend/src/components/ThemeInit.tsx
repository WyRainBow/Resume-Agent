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
    if (stored === 'dark' || stored === 'light') {
      apply(stored === 'dark')
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
    }
  }, [])
  return null
}
