/**
 * Workspace v2 常量和初始数据
 */
import type { ResumeData } from './types'

export const STORAGE_KEY = 'resume_v2_data'

/**
 * 初始简历数据
 */
export const initialResumeData: ResumeData = {
  id: `resume_${Date.now()}`,
  title: '我的简历',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  templateId: null,
  basic: {
    name: '',
    title: '',
    email: '',
    phone: '',
    location: '',
  },
  education: [],
  experience: [],
  projects: [],
  openSource: [],
  awards: [],
  customData: {},
  skillContent: '',
  activeSection: 'basic',
  draggingProjectId: null,
  menuSections: [
    { id: 'basic', title: '基本信息', icon: '👤', enabled: true, order: 0 },
    { id: 'skills', title: '专业技能', icon: '⚡', enabled: true, order: 1 },
    { id: 'experience', title: '实习经历', icon: '💼', enabled: true, order: 2 },
    { id: 'projects', title: '项目经历', icon: '🚀', enabled: true, order: 3 },
    { id: 'openSource', title: '开源经历', icon: '🔗', enabled: true, order: 4 },
    { id: 'awards', title: '荣誉奖项', icon: '🎖️', enabled: true, order: 5 },
    { id: 'education', title: '教育经历', icon: '🎓', enabled: true, order: 6 },
  ],
  globalSettings: {
    lineHeight: 1.5,
    baseFontSize: 16,
    headerSize: 18,
    pagePadding: 40,
    sectionSpacing: 20,
    paragraphSpacing: 10,
  },
}

/**
 * 从 localStorage 加载数据，并合并新模块
 */
export const loadFromStorage = (): ResumeData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved) as ResumeData
      // 合并新模块到 menuSections（如果旧数据缺少新模块）
      const existingIds = new Set(data.menuSections.map(s => s.id))
      const newSections = initialResumeData.menuSections.filter(s => !existingIds.has(s.id))
      if (newSections.length > 0) {
        data.menuSections = [...data.menuSections, ...newSections]
      }
      // 确保新字段存在
      if (!data.openSource) data.openSource = []
      if (!data.awards) data.awards = []
      return data
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e)
  }
  return initialResumeData
}

