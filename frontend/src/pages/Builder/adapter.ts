/**
 * 数据适配层:我方 Workspace v2 ResumeData → BuilderResumeData(RM 模板消费的形状)。
 *
 * 富文本策略:v2 的描述字段是 TipTap HTML(<ul><li><p>…),模板以 bullets(行内 HTML)渲染,
 * 这里用 DOMParser 把块级结构拍平成 bullet 数组,行内 strong/em/u/a 原样保留(渲染时由 SafeHtml 白名单清洗)。
 */
import type { ResumeData } from '../Workspace/v2/types'
import type {
  BuilderResumeData,
  CustomSection,
  Education,
  Experience,
  PersonalInfo,
  Project,
  SectionMeta,
  SectionType,
} from './types'
import { escapeText, inlineNodeHtml } from './templates/sanitizeHtml'

/**
 * TipTap HTML → bullet 数组。
 * 优先取 <li>(每条一个 bullet);无列表时按 <p> 分段;再退化为整体一条。
 */
export function htmlToBullets(html: string | undefined | null): string[] {
  if (!html || !html.trim()) return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const listItems = Array.from(doc.body.querySelectorAll('li'))
  const sources: Element[] = listItems.length
    ? listItems
    : Array.from(doc.body.querySelectorAll('p'))
  const fragments = (sources.length ? sources : [doc.body])
    .map((el) => Array.from(el.childNodes).map(inlineNodeHtml).join('').trim())
    .filter(Boolean)
  return fragments
}

/** 我方 menuSections id → Builder section 定义 */
const SECTION_KEY_MAP: Record<string, { key: string; sectionType: SectionType }> = {
  basic: { key: 'personalInfo', sectionType: 'personalInfo' },
  education: { key: 'education', sectionType: 'itemList' },
  experience: { key: 'workExperience', sectionType: 'itemList' },
  projects: { key: 'personalProjects', sectionType: 'itemList' },
  openSource: { key: 'openSource', sectionType: 'itemList' },
  skills: { key: 'skills', sectionType: 'stringList' },
  awards: { key: 'awards', sectionType: 'stringList' },
  selfEvaluation: { key: 'summary', sectionType: 'text' },
}

function toPersonalInfo(data: ResumeData): PersonalInfo {
  const { basic } = data
  const blog = basic.blog?.trim()
  const isGithub = Boolean(blog && /github\.com/i.test(blog))
  return {
    name: basic.name || undefined,
    title: basic.title || undefined,
    email: basic.email || undefined,
    phone: basic.phone || undefined,
    location: basic.location || undefined,
    github: isGithub ? blog : undefined,
    website: !isGithub && blog ? blog : undefined,
  }
}

function toWorkExperience(data: ResumeData): Experience[] {
  return data.experience
    .filter((item) => item.visible !== false)
    .map((item, index) => ({
      id: index,
      company: item.company || undefined,
      title: item.position || undefined,
      years: item.date || undefined,
      description: htmlToBullets(item.details),
    }))
}

function toEducation(data: ResumeData): Education[] {
  return data.education
    .filter((item) => item.visible !== false)
    .map((item, index) => {
      const degreeLine = [item.degree, item.major].filter(Boolean).join(' · ')
      const withGpa = item.gpa ? `${degreeLine} · GPA ${item.gpa}` : degreeLine
      const years = [item.startDate, item.endDate].filter(Boolean).join(' - ')
      return {
        id: index,
        institution: item.school || undefined,
        degree: withGpa || undefined,
        years: years || undefined,
        description: htmlToBullets(item.description),
      }
    })
}

function toProjects(data: ResumeData): Project[] {
  return data.projects
    .filter((item) => item.visible !== false)
    .map((item, index) => ({
      id: index,
      name: item.name || undefined,
      role: item.role || undefined,
      years: item.date || undefined,
      website: item.link || undefined,
      description: htmlToBullets(item.description),
    }))
}

function toOpenSource(data: ResumeData): Project[] {
  return data.openSource
    .filter((item) => item.visible !== false)
    .map((item, index) => ({
      id: index,
      name: item.name || undefined,
      role: item.role || undefined,
      years: item.date || undefined,
      github: item.repo || undefined,
      description: htmlToBullets(item.description),
    }))
}

function toAwards(data: ResumeData): string[] {
  return data.awards
    .filter((item) => item.visible !== false)
    .map((item) => {
      const head = [
        item.title ? `<strong>${escapeText(item.title)}</strong>` : '',
        item.issuer ? escapeText(item.issuer) : '',
        item.date ? escapeText(item.date) : '',
      ]
        .filter(Boolean)
        .join(' · ')
      const tail = item.description?.trim() ? `:${escapeText(item.description.trim())}` : ''
      return `${head}${tail}`
    })
    .filter(Boolean)
}

function toCustomSections(data: ResumeData): Record<string, CustomSection> {
  const result: Record<string, CustomSection> = {}
  for (const [key, items] of Object.entries(data.customData || {})) {
    if (!Array.isArray(items) || items.length === 0) continue
    result[key] = {
      sectionType: 'itemList',
      items: items
        .filter((item) => item.visible !== false)
        .map((item, index) => ({
          id: index,
          title: item.title || undefined,
          subtitle: item.subtitle || undefined,
          years: item.dateRange || undefined,
          description: htmlToBullets(item.description),
        })),
    }
  }
  return result
}

function toSectionMeta(data: ResumeData): SectionMeta[] | undefined {
  if (!Array.isArray(data.menuSections) || data.menuSections.length === 0) return undefined
  return data.menuSections.map((section) => {
    const mapped = SECTION_KEY_MAP[section.id]
    if (mapped) {
      return {
        id: mapped.key,
        key: mapped.key,
        displayName: section.title,
        sectionType: mapped.sectionType,
        isDefault: true,
        isVisible: section.enabled,
        order: section.order,
      }
    }
    // 自定义模块(如 custom_research 竞赛科研)
    return {
      id: section.id,
      key: section.id,
      displayName: section.title,
      sectionType: 'itemList' as SectionType,
      isDefault: false,
      isVisible: section.enabled,
      order: section.order,
    }
  })
}

/** 我方 v2 ResumeData → Builder 数据 */
export function toBuilderResumeData(data: ResumeData): BuilderResumeData {
  return {
    personalInfo: toPersonalInfo(data),
    summary: htmlToBullets(data.selfEvaluation),
    workExperience: toWorkExperience(data),
    education: toEducation(data),
    personalProjects: toProjects(data),
    openSource: toOpenSource(data),
    skills: htmlToBullets(data.skillContent),
    awards: toAwards(data),
    customSections: toCustomSections(data),
    sectionMeta: toSectionMeta(data),
  }
}

/** 无简历可载入时的示例数据(仅前端展示,不落任何存储) */
export function buildSampleData(): BuilderResumeData {
  return {
    personalInfo: {
      name: '王小明',
      title: '后端开发工程师',
      email: 'xiaoming@example.com',
      phone: '138 0000 0000',
      github: 'github.com/xiaoming',
    },
    education: [
      {
        id: 0,
        institution: '示例大学',
        degree: '本科 · 计算机科学与技术',
        years: '2021.09 - 2025.06',
        description: ['主修课程:数据结构、操作系统、计算机网络、数据库系统'],
      },
    ],
    workExperience: [
      {
        id: 0,
        company: '示例科技',
        title: '后端开发实习生',
        years: '2024.06 - 2024.09',
        description: [
          '参与订单服务拆分,接口 P99 延迟从 <strong>320ms 降至 90ms</strong>',
          '搭建灰度发布流程,线上事故率下降 60%',
        ],
      },
    ],
    personalProjects: [
      {
        id: 0,
        name: '短链服务',
        role: '独立开发',
        years: '2024.03 - 2024.05',
        github: 'github.com/xiaoming/shortlink',
        description: ['基于一致性哈希的分布式短链生成,支持 1w QPS'],
      },
    ],
    skills: ['熟悉 Java 并发编程与 JVM 调优', '熟悉 MySQL 索引与事务,了解分库分表'],
    awards: ['<strong>国家奖学金</strong> · 2023'],
  }
}
