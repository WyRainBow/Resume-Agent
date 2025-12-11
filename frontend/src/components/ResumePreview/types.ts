/**
 * ResumePreview 类型定义
 */
import type { Resume } from '../../types/resume'

export type BlurHandler = (e: React.FocusEvent<HTMLElement>) => void
export type KeyHandler = (e: React.KeyboardEvent<HTMLElement>) => void

export interface ResumePreviewProps {
  resume: Resume | null
  sectionOrder?: string[]
  scale?: number
  onUpdate?: (resume: Resume) => void
}

export interface SectionProps {
  resume: Resume
  onBlur: BlurHandler
  onKeyDown: KeyHandler
  styles: Record<string, React.CSSProperties>
}

export interface ToolbarButton {
  command?: string
  arg?: string
  icon: string
  title: string
  style?: React.CSSProperties
  type?: 'divider'
}
