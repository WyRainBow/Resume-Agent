/**
 * 主题 hook：读取当前主题并提供切换方法
 * 通过监听 THEME_EVENT 让多个使用处（侧边栏开关、设置页）保持同步
 */
import { useEffect, useState } from 'react'
import {
  type Theme,
  THEME_EVENT,
  getStoredTheme,
  resolveIsDark,
  setStoredTheme,
} from '@/lib/theme'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    const sync = () => setThemeState(getStoredTheme())
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  const setTheme = (next: Theme) => setStoredTheme(next)
  const isDark = resolveIsDark(theme)

  return { theme, setTheme, isDark }
}
