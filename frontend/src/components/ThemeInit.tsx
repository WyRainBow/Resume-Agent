import { useEffect } from 'react'
import { applyThemeClass, getStoredTheme, THEME_EVENT } from '@/lib/theme'
import { canUseAdminFeature } from '@/lib/runtimeEnv'

/** 深色模式功能仅管理员可用：非管理员即使本地存了 dark/system（如共用设备残留），
 * 也一律按亮色渲染，避免只隐藏入口而实际主题仍能通过旧存储泄露。 */
function applyThemeClassGuarded(theme: Parameters<typeof applyThemeClass>[0]): void {
  applyThemeClass(canUseAdminFeature() ? theme : 'light')
}

export function ThemeInit() {
  useEffect(() => {
    // 启动时按存储的主题套用（支持 light / dark / system）
    applyThemeClassGuarded(getStoredTheme())

    // 跟随系统：在 system 模式下，操作系统切换深浅色时实时重应用
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onSystemChange = () => {
      if (getStoredTheme() === 'system') applyThemeClassGuarded('system')
    }
    media?.addEventListener('change', onSystemChange)

    // 其它组件改主题时已直接应用 class，这里再同步一次保证一致
    const onThemeChange = () => applyThemeClassGuarded(getStoredTheme())
    window.addEventListener(THEME_EVENT, onThemeChange)

    return () => {
      media?.removeEventListener('change', onSystemChange)
      window.removeEventListener(THEME_EVENT, onThemeChange)
    }
  }, [])
  return null
}
