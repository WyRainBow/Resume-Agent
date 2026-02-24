/**
 * Workspace v2 类型定义
 */

/**
 * 模块配置
 */
export interface MenuSection {
  id: string
  title: string
  icon: string
  enabled: boolean
  order: number
}

/**
 * 基本信息
 */
export interface BasicInfo {
  name: string
  title: string
  email: string
  phone: string
  location: string
  birthDate?: string
  employementStatus?: string
  photo?: string
  photoOffsetX?: number  // 照片横向偏移（cm，正值向左）
  photoOffsetY?: number  // 照片纵向偏移（cm，正值向上）
  photoWidthCm?: number  // 照片宽度（cm）
  photoHeightCm?: number  // 照片高度（cm）
  icons?: Record<string, string>
  layout?: 'left' | 'center' | 'right'
  customFields?: CustomFieldType[]
  fieldOrder?: BasicFieldType[]
}

export interface BasicFieldType {
  id: string
  key: keyof BasicInfo
  label: string
  type?: 'date' | 'textarea' | 'text' | 'editor'
  visible: boolean
  custom?: boolean
}

export interface CustomFieldType {
  id: string
  label: string
  value: string
  icon?: string
  visible?: boolean
  custom?: boolean
}

/**
 * 教育经历
 */
export interface Education {
  id: string
  school: string
  major: string
  degree: string
  startDate: string
  endDate: string
  gpa?: string
  description?: string  // HTML 格式
  visible?: boolean
}

/**
 * 工作经历/实习经历
 */
export interface Experience {
  id: string
  company: string
  position: string
  date: string
  details: string  // HTML 格式
  visible?: boolean
  companyLogo?: string  // 公司 Logo key，如 'bytedance'、'tencent'
  companyLogoSize?: number  // 单条经历 Logo 大小（px），优先于全局设置
}

/**
 * 开源经历
 */
export interface OpenSource {
  id: string
  name: string
  repo?: string
  role?: string
  date?: string
  description: string  // HTML 格式
  visible?: boolean
}

/**
 * 荣誉奖项
 */
export interface Award {
  id: string
  title: string
  issuer?: string
  date?: string
  description?: string
  visible?: boolean
}

/**
 * 项目经历
 */
export interface Project {
  id: string
  name: string
  role: string
  date: string
  description: string  // HTML 格式
  visible: boolean
  link?: string
}

/**
 * 自定义模块项
 */
export interface CustomItem {
  id: string
  title: string
  subtitle: string
  dateRange: string
  description: string  // HTML 格式
  visible: boolean
}

/**
 * 全局设置
 */
export interface GlobalSettings {
  themeColor?: string
  fontFamily?: string
  baseFontSize?: number
  pagePadding?: number
  paragraphSpacing?: number
  lineHeight?: number
  sectionSpacing?: number
  headerSize?: number
  subheaderSize?: number
  useIconMode?: boolean
  centerSubtitle?: boolean
  companyNameFontSize?: number  // 公司名称字号（px），默认跟随 item-title 15px
  companyLogoSize?: number  // 公司 Logo 大小（px），默认 20，范围 14-32
  experienceListType?: 'none' | 'unordered' | 'ordered'  // 工作经历列表类型：无列表、无序列表、有序列表
  openSourceRepoDisplay?: 'below' | 'inline' | 'icon'  // 开源经历仓库链接显示位置：下方 | 标题右侧 | 图标
  openSourceRepoLabel?: string  // 开源仓库链接前缀：'' 无前缀 | '仓库' | 'GitHub' | 自定义文字
  projectLinkDisplay?: 'below' | 'inline' | 'icon'  // 项目链接显示位置：下方 | 标题右侧 | 图标
  projectLinkLabel?: string  // 项目链接前缀：'' 无前缀 | '链接' | 'GitHub' | 自定义文字
  experienceGap?: number  // 经历项之间的间距（ex），默认 1，0 表示无间距
  // LaTeX 排版设置
  latexFontSize?: number  // LaTeX 字体大小: 9, 10, 11, 12
  latexMargin?: 'tight' | 'compact' | 'standard' | 'relaxed' | 'wide'  // 页面边距
  latexLineSpacing?: number  // 行间距: 0.9 - 1.5
  latexHeaderTopGapPx?: number  // 头部顶部空白（px，可为负）
  latexHeaderNameContactGapPx?: number  // 姓名与联系信息间距调整（px，可为负）
  latexHeaderBottomGapPx?: number  // 联系信息下方空白（px，可为负）
}

/**
 * 完整简历数据
 */
export interface ResumeData {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  templateId: string | null
  templateType?: 'latex' | 'html'  // 模板类型：latex 或 html，默认 latex
  basic: BasicInfo
  education: Education[]
  experience: Experience[]
  projects: Project[]
  openSource: OpenSource[]
  awards: Award[]
  customData: Record<string, CustomItem[]>
  skillContent: string  // HTML 格式
  activeSection: string
  draggingProjectId: string | null
  menuSections: MenuSection[]
  globalSettings: GlobalSettings
}

/**
 * 默认模块列表
 */
export const DEFAULT_MENU_SECTIONS: MenuSection[] = [
  { id: 'basic', title: '基本信息', icon: '👤', enabled: true, order: 0 },
  { id: 'skills', title: '专业技能', icon: '⚡', enabled: true, order: 1 },
  { id: 'experience', title: '实习经历', icon: '💼', enabled: true, order: 2 },
  { id: 'projects', title: '项目经历', icon: '🚀', enabled: true, order: 3 },
  { id: 'openSource', title: '开源经历', icon: '🔗', enabled: true, order: 4 },
  { id: 'awards', title: '荣誉奖项', icon: '😄', enabled: true, order: 5 },
  { id: 'education', title: '教育经历', icon: '🎓', enabled: true, order: 6 },
]

/**
 * 默认基本信息字段顺序
 */
export const DEFAULT_FIELD_ORDER: BasicFieldType[] = [
  { id: '1', key: 'name', label: '姓名', type: 'text', visible: true },
  { id: '2', key: 'title', label: '职位', type: 'text', visible: true },
  { id: '3', key: 'employementStatus', label: '状态', type: 'text', visible: true },
  { id: '4', key: 'birthDate', label: '生日', type: 'date', visible: true },
  { id: '5', key: 'email', label: '邮箱', type: 'text', visible: true },
  { id: '6', key: 'phone', label: '电话', type: 'text', visible: true },
  { id: '7', key: 'location', label: '地址', type: 'text', visible: true },
]
