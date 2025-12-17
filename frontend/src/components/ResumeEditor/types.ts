/**
 * ResumeEditor 相关类型定义
 */

export type SectionType = 
  | 'contact' 
  | 'education' 
  | 'experience' 
  | 'projects' 
  | 'skills' 
  | 'awards' 
  | 'summary' 
  | 'opensource'

export type ResumeSection = {
  id: string
  type: SectionType
  title: string
  icon: string
  data: any
}

export type ResumeEditorProps = {
  resumeData: any
  onSave: (data: any, sectionOrder?: string[]) => void
  onSaveAndRender?: (resumeData?: any) => Promise<void>  // 保存并渲染 PDF
  saving?: boolean
}

export type AIImportModalProps = {
  isOpen: boolean
  sectionType: string
  sectionTitle: string
  onClose: () => void
  onSave: (data: any) => void
}

export type SortableSectionProps = {
  section: ResumeSection
  expanded: boolean
  onToggle: () => void
  onUpdate: (data: any) => void
  onTitleChange: (title: string) => void
  onAIImport: () => void
  importing: boolean
}

export type SectionEditorProps = {
  section: ResumeSection
  onUpdate: (data: any) => void
}

export type YearMonthPickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
}

export type DateRangePickerProps = {
  value: string
  onChange: (value: string) => void
}
