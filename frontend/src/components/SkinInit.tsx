import { useEffect } from 'react'
import { applySkinAttr, getSkinOrDefault, SKIN_EVENT } from '@/lib/skin'

/** 全站皮肤初始化:启动时把 data-skin 挂到 <html>,并跟随切换事件同步(与 ThemeInit 同模式) */
export function SkinInit() {
  useEffect(() => {
    applySkinAttr(getSkinOrDefault())
    const onSkinChange = () => applySkinAttr(getSkinOrDefault())
    window.addEventListener(SKIN_EVENT, onSkinChange)
    return () => window.removeEventListener(SKIN_EVENT, onSkinChange)
  }, [])
  return null
}
