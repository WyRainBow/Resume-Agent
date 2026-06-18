/**
 * 主题（亮色 / 深色 / 跟随系统）集中管理
 * - 单一数据源：localStorage 的 app-theme
 * - applyThemeClass 负责在 <html> 上增删 .dark
 * - setStoredTheme 写入并广播 app-theme-change，跨组件实例同步
 */
export type Theme = 'light' | 'dark' | 'system'

export const THEME_KEY = 'app-theme'
export const THEME_EVENT = 'app-theme-change'

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {}
  return 'light'
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

/** 解析当前主题最终是否为深色（system 跟随操作系统） */
export function resolveIsDark(theme: Theme): boolean {
  return theme === 'dark' || (theme === 'system' && systemPrefersDark())
}

export function applyThemeClass(theme: Theme): void {
  const root = document.documentElement
  if (resolveIsDark(theme)) root.classList.add('dark')
  else root.classList.remove('dark')
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {}
  applyThemeClass(theme)
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
}
