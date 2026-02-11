/**
 * Workspace v2 常量和初始数据
 */
import type { ResumeData } from './types'
import type { Resume } from '../../../types/resume'
import { DEFAULT_RESUME_TEMPLATE } from '../../../data/defaultTemplate'

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
  templateType: 'latex',  // 默认使用 LaTeX 模板
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
    // LaTeX 排版设置
    latexFontSize: 11,       // 默认 11pt
    latexMargin: 'standard', // 默认标准边距
    latexLineSpacing: 1.15,  // 默认行间距 1.15
    latexHeaderTopGapPx: -4,
    latexHeaderNameContactGapPx: 0,
    latexHeaderBottomGapPx: -1,
  },
}

/**
 * 将 v1 格式的 Resume 转换为 v2 格式的 ResumeData
 */
function convertTemplateToResumeData(template: Resume): ResumeData {
  // 解析日期范围 "2022.09 - 2026.06" 为 startDate 和 endDate
  const parseDateRange = (dateStr: string) => {
    if (!dateStr || !dateStr.includes(' - ')) {
      return { startDate: dateStr || '', endDate: '' }
    }
    const [start, end] = dateStr.split(' - ')
    return { startDate: start?.trim() || '', endDate: end?.trim() || '' }
  }

  // 将字符串数组转换为 HTML
  const arrayToHtml = (items: string[]): string => {
    if (!items || items.length === 0) return ''
    return items.map(item => `<p>${item}</p>`).join('')
  }

  // 将 highlights 数组转换为 HTML
  const highlightsToHtml = (highlights: string[]): string => {
    if (!highlights || highlights.length === 0) return ''
    return highlights.map(h => `<p>${h}</p>`).join('')
  }

  // 转换教育经历
  const education = (template.education || []).map((edu, index) => {
    const { startDate, endDate } = parseDateRange(edu.date || '')
    return {
      id: `edu_${Date.now()}_${index}`,
      school: edu.title || '',
      major: edu.subtitle || '',
      degree: edu.degree || '',
      startDate,
      endDate,
      gpa: undefined,
      description: arrayToHtml(edu.details || []),
      visible: true,
    }
  })

  // 转换实习经历
  const experience = (template.internships || []).map((exp, index) => {
    return {
      id: `exp_${Date.now()}_${index}`,
      company: exp.title || '',
      position: exp.subtitle || '',
      date: exp.date || '',
      details: highlightsToHtml(exp.highlights || []),
      visible: true,
    }
  })

  // 转换项目经历
  const projects = (template.projects || []).map((proj, index) => {
    return {
      id: `proj_${Date.now()}_${index}`,
      name: proj.title || '',
      role: proj.subtitle || '',
      date: proj.date || '',
      description: highlightsToHtml(proj.highlights || []),
      visible: true,
      link: undefined,
    }
  })

  // 转换开源经历
  const openSource = (template.openSource || []).map((os, index) => {
    return {
      id: `os_${Date.now()}_${index}`,
      name: os.title || '',
      repo: undefined,
      role: os.subtitle || '',
      date: undefined,
      description: arrayToHtml(os.items || []),
      visible: true,
    }
  })

  // 转换荣誉奖项
  const awards = (template.awards || []).map((award, index) => {
    return {
      id: `award_${Date.now()}_${index}`,
      title: award,
      issuer: undefined,
      date: undefined,
      description: undefined,
      visible: true,
    }
  })

  // 转换专业技能
  const skillContent = (template.skills || [])
    .map(skill => {
      if (typeof skill === 'string') {
        return `<p>${skill}</p>`
      } else {
        return `<p><strong>${skill.category}:</strong> ${skill.details}</p>`
      }
    })
    .join('')

  return {
    ...initialResumeData,
    basic: {
      ...initialResumeData.basic,
      name: template.name || '',
      title: template.objective || '',
      email: template.contact?.email || '',
      phone: template.contact?.phone || '',
      location: template.contact?.location || '',
    },
    education,
    experience,
    projects,
    openSource,
    awards,
    skillContent,
  }
}

/**
 * 从 localStorage 加载数据，并合并新模块
 * 如果 localStorage 为空，则使用默认模板
 */
export const loadFromStorage = (): ResumeData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved) as ResumeData

      // 如果存量数据为空白（无姓名、无标题且核心板块全空），回退到默认模板
      const isBlank =
        (!data.basic?.name && !data.basic?.title) &&
        (!data.projects || data.projects.length === 0) &&
        (!data.experience || data.experience.length === 0) &&
        (!data.education || data.education.length === 0)
      if (isBlank) {
        // DEFAULT_RESUME_TEMPLATE 已经是 ResumeData 格式，直接返回
        return structuredClone(DEFAULT_RESUME_TEMPLATE)
      }

      // 合并新模块到 menuSections（如果旧数据缺少新模块）
      const existingIds = new Set(data.menuSections.map(s => s.id))
      const newSections = initialResumeData.menuSections.filter(s => !existingIds.has(s.id))
      if (newSections.length > 0) {
        data.menuSections = [...data.menuSections, ...newSections]
      }
      // 确保新字段存在
      if (!data.openSource) data.openSource = []
      if (!data.awards) data.awards = []
      if (!data.templateType) data.templateType = 'latex'  // 默认 LaTeX 模板
      return data
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e)
  }
  
  // localStorage 为空时，使用默认模板
  // DEFAULT_RESUME_TEMPLATE 已经是 ResumeData 格式，直接返回
  return structuredClone(DEFAULT_RESUME_TEMPLATE)
}
