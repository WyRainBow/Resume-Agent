import { useEffect } from 'react'
import { applyThemeClass, getStoredTheme, THEME_EVENT } from '@/lib/theme'

export function ThemeInit() {
  useEffect(() => {
    // 启动时按存储的主题套用（支持 light / dark / system）
    applyThemeClass(getStoredTheme())

    // 跟随系统：在 system 模式下，操作系统切换深浅色时实时重应用
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onSystemChange = () => {
      if (getStoredTheme() === 'system') applyThemeClass('system')
    }
    media?.addEventListener('change', onSystemChange)

    // 其它组件改主题时已直接应用 class，这里再同步一次保证一致
    const onThemeChange = () => applyThemeClass(getStoredTheme())
    window.addEventListener(THEME_EVENT, onThemeChange)

    return () => {
      media?.removeEventListener('change', onSystemChange)
      window.removeEventListener(THEME_EVENT, onThemeChange)
    }
  }, [])
  return null
}
