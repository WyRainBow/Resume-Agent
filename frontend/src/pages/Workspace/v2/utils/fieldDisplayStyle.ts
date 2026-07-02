/**
 * 基本信息「每字段显示样式」共享工具
 * 设计：knowledge-base/specs/2026-06-24-per-field-display-style-design.md
 */
import type { BasicInfo, GlobalSettings, FieldLabelMode } from '../types'

/** 可设置显示样式的基本信息字段（姓名除外） */
export type StyleableFieldKey = 'title' | 'birthDate' | 'email' | 'phone' | 'location' | 'blog'

export const STYLEABLE_FIELDS: StyleableFieldKey[] = [
  'title',
  'birthDate',
  'email',
  'phone',
  'location',
  'blog',
]

/** 各字段「图标」模式的默认 emoji（与 header 既有硬编码一致：📞📧📍🎂🔗，title 新增 🎯） */
export const DEFAULT_FIELD_ICONS: Record<string, string> = {
  title: '🎯',
  birthDate: '🎂',
  email: '📧',
  phone: '📞',
  location: '📍',
  blog: '🔗',
}

/** 各字段「标签」模式的前缀中文名（单一来源）。birthDate 随展示模式取「年龄/生日」 */
export function fieldTextLabel(
  key: string,
  birthDateDisplayMode?: 'birthDate' | 'age',
): string {
  switch (key) {
    case 'title':
      return '求职意向'
    case 'email':
      return '邮箱'
    case 'phone':
      return '电话'
    case 'location':
      return '地点'
    case 'blog':
      return '博客'
    case 'birthDate':
      return birthDateDisplayMode === 'age' ? '年龄' : '生日'
    default:
      return ''
  }
}

/**
 * 解析某字段的显示样式：
 * 1) fieldLabelModes[key] 优先；2) 回退老简历的全局 contactLabelMode；3) 默认 'icon'。
 * 读时回退保证存量简历视觉不突变，无需一次性迁移写入。
 */
export function resolveFieldMode(
  key: string,
  globalSettings?: GlobalSettings,
): FieldLabelMode {
  // 「图标」样式已废弃：显式设过的 icon、老全局 contactLabelMode=icon、以及未设置的字段，一律回退「仅值」
  const explicit = globalSettings?.fieldLabelModes?.[key]
  if (explicit && explicit !== 'icon') return explicit
  const legacy = globalSettings?.contactLabelMode
  if (legacy && legacy !== 'icon') return legacy
  return 'none'
}

/** 解析某字段「图标」模式使用的 emoji：自定义（basic.icons[key]）优先，否则默认图标 */
export function resolveFieldIcon(key: string, basic?: BasicInfo): string {
  return basic?.icons?.[key] || DEFAULT_FIELD_ICONS[key] || ''
}

/**
 * 生成字段前缀文本：
 * - icon → "📧 "（含尾随空格）
 * - text → "邮箱："
 * - none → ""
 */
export function fieldPrefix(mode: FieldLabelMode, icon: string, textLabel: string): string {
  if (mode === 'icon') return icon ? `${icon} ` : ''
  if (mode === 'text') return textLabel ? `${textLabel}：` : ''
  return ''
}
