/**
 * 将前端 ResumeData 转换为后端需要的格式
 */
import type { ResumeData } from '../types'
import { stripHtmlTags } from './textUtils'

export interface BackendResumeData {
  name: string
  photo?: string
  photoOffsetX?: number
  photoOffsetY?: number
  photoWidthCm?: number
  photoHeightCm?: number
  contact: {
    phone: string
    email: string
    location: string
  }
  objective: string
  skillContent?: string  // HTML 格式的专业技能内容
  skills: { category: string; details: string }[]
  internships: {
    title: string
    subtitle: string
    date: string
    highlights: string[]
    logo?: string  // 公司 Logo key
    logoSize?: number  // 单条经历 Logo 大小（px）
  }[]
  projects: {
    title: string
    subtitle: string
    date: string
    highlights: string[]
  }[]
  open_source: {
    title: string
    subtitle: string
    repoUrl: string
    date: string
    items: string[]
  }[]
  awards: {
    title: string
    issuer: string
    date: string
    description: string
  }[]
  education: {
    title: string
    subtitle: string
    degree: string
    date: string
    details: string[]
  }[]
  sectionOrder: string[]
  globalSettings?: {
    experienceListType?: 'none' | 'unordered' | 'ordered'
    [key: string]: any
  }
}

export function convertToBackendFormat(data: ResumeData): BackendResumeData {
  return {
    name: data.basic.name,
    ...(data.basic.photo ? { photo: data.basic.photo } : {}),
    ...(typeof data.basic.photoOffsetX === 'number' ? { photoOffsetX: data.basic.photoOffsetX } : {}),
    ...(typeof data.basic.photoOffsetY === 'number' ? { photoOffsetY: data.basic.photoOffsetY } : {}),
    ...(typeof data.basic.photoWidthCm === 'number' ? { photoWidthCm: data.basic.photoWidthCm } : {}),
    ...(typeof data.basic.photoHeightCm === 'number' ? { photoHeightCm: data.basic.photoHeightCm } : {}),
    contact: {
      phone: data.basic.phone,
      email: data.basic.email,
      location: data.basic.location,
    },
    objective: data.basic.title,
    skillContent: data.skillContent || '',  // 直接传递 HTML 内容
    skills: data.skillContent ? [{ category: '', details: data.skillContent }] : [],  // 兼容旧格式
    internships: data.experience.filter(e => e.visible !== false).map((e) => ({
      title: stripHtmlTags(e.company),
      subtitle: stripHtmlTags(e.position),
      date: e.date,
      highlights: [e.details],
      ...(e.companyLogo ? { logo: e.companyLogo } : {}),
      ...(e.companyLogoSize ? { logoSize: e.companyLogoSize } : {}),
    })),
    projects: data.projects.filter(p => p.visible !== false).map((p) => ({
      title: stripHtmlTags(p.name),
      subtitle: stripHtmlTags(p.role),
      date: p.date,
      highlights: [p.description],
    })),
    open_source: (data.openSource || []).filter(o => o.visible !== false).map((o) => ({
      title: stripHtmlTags(o.name),
      subtitle: stripHtmlTags(o.role || ''),
      repoUrl: o.repo || '',
      date: o.date || '',
      items: [o.description],
    })),
    awards: (data.awards || []).filter(a => a.visible !== false).map((a) => ({
      title: stripHtmlTags(a.title),
      issuer: stripHtmlTags(a.issuer || ''),
      date: a.date || '',
      description: a.description || '',
    })),
    education: data.education.filter(e => e.visible !== false).map((e) => ({
      title: stripHtmlTags(e.school),
      subtitle: stripHtmlTags(e.major),
      degree: stripHtmlTags(e.degree),
      date: e.endDate ? `${e.startDate} - ${e.endDate}` : e.startDate,
      details: e.description ? [e.description] : [],
    })),
    sectionOrder: data.menuSections
      .filter((s) => s.enabled && s.id !== 'basic')
      .map((s) => {
        const mapping: Record<string, string> = {
          skills: 'skills',
          experience: 'internships',
          projects: 'projects',
          openSource: 'open_source',
          awards: 'awards',
          education: 'education',
        }
        return mapping[s.id] || s.id
      }),
    globalSettings: data.globalSettings,  // 传递全局设置
  }
}
