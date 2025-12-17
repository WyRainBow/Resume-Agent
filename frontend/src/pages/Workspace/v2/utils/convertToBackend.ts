/**
 * 将前端 ResumeData 转换为后端需要的格式
 */
import type { ResumeData } from '../types'

export interface BackendResumeData {
  name: string
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
}

export function convertToBackendFormat(data: ResumeData): BackendResumeData {
  return {
    name: data.basic.name,
    contact: {
      phone: data.basic.phone,
      email: data.basic.email,
      location: data.basic.location,
    },
    objective: data.basic.title,
    skillContent: data.skillContent || '',  // 直接传递 HTML 内容
    skills: data.skillContent ? [{ category: '', details: data.skillContent }] : [],  // 兼容旧格式
    internships: data.experience.filter(e => e.visible !== false).map((e) => ({
      title: e.company,
      subtitle: e.position,
      date: e.date,
      highlights: [e.details],
    })),
    projects: data.projects.filter(p => p.visible !== false).map((p) => ({
      title: p.name,
      subtitle: p.role,
      date: p.date,
      highlights: [p.description],
    })),
    open_source: (data.openSource || []).filter(o => o.visible !== false).map((o) => ({
      title: o.name,
      subtitle: o.role || '',
      repoUrl: o.repo || '',
      date: o.date || '',
      items: [o.description],
    })),
    awards: (data.awards || []).filter(a => a.visible !== false).map((a) => ({
      title: a.title,
      issuer: a.issuer || '',
      date: a.date || '',
      description: a.description || '',
    })),
    education: data.education.filter(e => e.visible !== false).map((e) => ({
      title: e.school,
      subtitle: e.major,
      degree: e.degree,
      date: `${e.startDate} - ${e.endDate}`,
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
  }
}

