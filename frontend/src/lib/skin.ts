/**
 * Workspace 皮肤(Neo 新野兽派 / 清新)集中管理,模式照抄 lib/theme.ts:
 * - 单一数据源:localStorage 的 workspace-skin
 * - data-skin 属性由 WorkspaceLayout 根节点挂载,Tailwind fresh: 变体据此生效
 * - setStoredSkin 写入并广播 workspace-skin-change,跨组件实例同步
 */
export type WorkspaceSkin = 'neo' | 'fresh'

export const SKIN_KEY = 'workspace-skin'
export const SKIN_EVENT = 'workspace-skin-change'

/** 返回 null 表示用户从未选过皮肤(用于决定是否弹首次选择框) */
export function getStoredSkin(): WorkspaceSkin | null {
  try {
    const v = localStorage.getItem(SKIN_KEY)
    if (v === 'neo' || v === 'fresh') return v
  } catch {}
  return null
}

export function getSkinOrDefault(): WorkspaceSkin {
  return getStoredSkin() ?? 'neo'
}

export function setStoredSkin(skin: WorkspaceSkin): void {
  try {
    localStorage.setItem(SKIN_KEY, skin)
  } catch {}
  window.dispatchEvent(new CustomEvent(SKIN_EVENT, { detail: skin }))
}
