/**
 * AI 导入 Hook
 */
import { useState, useCallback } from 'react'
import type { ResumeData } from '../types'
import { matchCompanyLogo } from '../constants/companyLogos'
import { matchSchoolLogo } from '../constants/schoolLogos'
import { highlightsToHtml, groupedHighlightsToHtml, skillsToHtml, dropNonSkillEntries } from '@/utils/resumeRichtext'

/** AI 导入时公司名默认加粗：用 ** 包裹，与编辑区 BoldInput 一致，导出/预览也会加粗 */
function defaultBoldCompany(s: string): string {
  const raw = (s || '').trim()
  if (!raw) return ''
  if (raw.startsWith('**') && raw.endsWith('**')) return raw
  return `**${raw}**`
}

interface UseAIImportProps {
  setResumeData: React.Dispatch<React.SetStateAction<ResumeData>>
}

export function useAIImport({ setResumeData }: UseAIImportProps) {
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiModalSection, setAiModalSection] = useState<string>('all')
  const [aiModalTitle, setAiModalTitle] = useState('全局导入')

  // 分模块导入
  const handleAIImport = useCallback((section: string) => {
    const sectionMap: Record<string, string> = {
      skills: '专业技能',
      selfEvaluation: '自我评价',
      experience: '实习经历',
      projects: '项目经历',
      education: '教育经历',
      openSource: '开源经历',
      awards: '荣誉奖项',
    }
    setAiModalSection(section)
    setAiModalTitle(sectionMap[section] || section)
    setAiModalOpen(true)
  }, [])

  // 全局导入
  const handleGlobalAIImport = useCallback(() => {
    setAiModalSection('all')
    setAiModalTitle('全局导入')
    setAiModalOpen(true)
  }, [])

  // AI 解析结果处理
  const handleAISave = useCallback((data: any, meta?: { awardsListType?: 'unordered' | 'ordered' }) => {
    console.log('AI parsed data:', data, 'for section:', aiModalSection)

    // 读取格式信息
    const format = data.format || {}
    const experienceFormat = format.experience || {}
    const projectsFormat = format.projects || {}
    const skillsFormat = format.skills || {}
    
    console.log('Format info:', format)

    const hasOpenSourceKey =
      Object.prototype.hasOwnProperty.call(data, 'openSource') ||
      Object.prototype.hasOwnProperty.call(data, 'open_source') ||
      Object.prototype.hasOwnProperty.call(data, 'opensource')
    const openSourceRaw = data.openSource ?? data.open_source ?? data.opensource
    const openSourceMapped = Array.isArray(openSourceRaw)
      ? openSourceRaw.map((o: any, i: number) => ({
          id: `os_${Date.now()}_${i}`,
          name: o.title || o.name || '',
          role: o.subtitle || o.role || '',
          repo: o.repoUrl || o.repo || '',
          date: o.date || '',
          // 使用支持嵌套层级的函数渲染 items（支持 **标题** 格式）
          description: o.items && o.items.length > 0
            ? groupedHighlightsToHtml(o.items)
            : o.description || '',
          visible: true,
        }))
      : []

    if (aiModalSection === 'all') {
      // 全局导入
      setResumeData((prev) => ({
        ...prev,
        basic: {
          name: data.name || prev.basic.name,
          title: data.objective || prev.basic.title,
          email: data.contact?.email || prev.basic.email,
          phone: data.contact?.phone || prev.basic.phone,
          location: data.contact?.location || prev.basic.location,
        },
        education: data.education?.map((e: any, i: number) => {
          // 智能分割日期：支持 "2022.09 - 2026.06"、"2022.09-2026.06"、"2022.09–2026.06" 等格式
          let startDate = ''
          let endDate = ''
          if (e.date) {
            const dateStr = e.date.trim()
            // 尝试多种分隔符：" - "、"-"、"–"、"~"
            const dateMatch = dateStr.match(/^(.+?)\s*[-–~]\s*(.+)$/)
            if (dateMatch) {
              startDate = dateMatch[1].trim()
              endDate = dateMatch[2].trim()
            } else {
              startDate = dateStr
            }
          }
          const schoolName = e.title || ''
          const schoolLogoKey = matchSchoolLogo(schoolName)
          return {
            id: `edu_${Date.now()}_${i}`,
            school: schoolName,
            major: e.subtitle || '',
            degree: e.degree || '',
            startDate,
            endDate,
            // 补充说明是富文本编辑器字段，统一转成无序列表 HTML（与 Agent 编辑链路一致），
            // 避免解析结果渲染成纯文本换行
            description: e.details && e.details.length > 0
              ? highlightsToHtml(e.details)
              : '',
            visible: true,
            ...(schoolLogoKey ? { schoolLogo: schoolLogoKey } : {}),
          }
        }) || prev.education,
        experience: data.internships?.map((e: any, i: number) => {
          const companyName = e.title || ''
          const logoKey = matchCompanyLogo(companyName)
          return {
            id: `exp_${Date.now()}_${i}`,
            company: defaultBoldCompany(companyName),
            position: e.subtitle || '',
            date: e.date || '',
            details: highlightsToHtml(e.highlights, { listStyle: experienceFormat.list_style || 'bullet' }),
            visible: true,
            ...(logoKey ? { companyLogo: logoKey } : {}),
          }
        }) || prev.experience,
        projects: data.projects?.map((p: any, i: number) => {
          // 合并项目描述和亮点
          let description = p.description || ''
          const listStyle = projectsFormat.list_style || 'bullet'

          // 将 highlights 数组转换为 HTML 列表（使用统一的嵌套层级逻辑）
          if (p.highlights && p.highlights.length > 0) {
            const highlightsList = highlightsToHtml(p.highlights, { listStyle })
            
            if (description) {
              description = description + highlightsList
            } else {
              description = highlightsList
            }
          }

          // 转换 description 中的 Markdown ** 加粗
          description = description.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

          return {
            id: `proj_${Date.now()}_${i}`,
            name: p.title || '',
            role: p.subtitle || '',
            date: p.date || '',
            description: description,
            visible: true,
          }
        }) || prev.projects,
        openSource: hasOpenSourceKey ? openSourceMapped : prev.openSource,
        awards: data.awards?.map((a: any, i: number) => ({
          id: `award_${Date.now()}_${i}`,
          title: a.title || '',
          issuer: a.issuer || '',
          date: a.date || '',
          description: a.description || '',
          visible: true,
        })) || prev.awards,
        selfEvaluation: typeof data.summary === 'string' && data.summary.trim()
          ? `<p>${data.summary}</p>`
          : prev.selfEvaluation,
        // 专业技能统一转成无序列表 HTML（与 Agent 编辑链路一致）。
        // AI 解析导入专属：先剔除明显混入技能区的项目描述条目（其它导入路径不过滤）。
        skillContent: skillsToHtml(dropNonSkillEntries(data.skills)) || prev.skillContent,
      }))
    } else {
      // 分模块导入
      handleSectionImport(aiModalSection, data, setResumeData, meta)
    }
  }, [aiModalSection, setResumeData])

  return {
    aiModalOpen,
    aiModalSection,
    aiModalTitle,
    setAiModalOpen,
    handleAIImport,
    handleGlobalAIImport,
    handleAISave,
  }
}

// 分模块导入处理
function handleSectionImport(
  section: string,
  data: any,
  setResumeData: React.Dispatch<React.SetStateAction<ResumeData>>,
  meta?: { awardsListType?: 'unordered' | 'ordered' }
) {
  switch (section) {
    case 'education':
      if (Array.isArray(data)) {
        const newEducations = data.map((e: any, i: number) => {
          // 智能分割日期
          let startDate = e.startDate || ''
          let endDate = e.endDate || ''
          if (e.date && !startDate) {
            const dateStr = e.date.trim()
            const dateMatch = dateStr.match(/^(.+?)\s*[-–~]\s*(.+)$/)
            if (dateMatch) {
              startDate = dateMatch[1].trim()
              endDate = dateMatch[2].trim()
            } else {
              startDate = dateStr
            }
          }
          const schoolName = e.title || e.school || ''
          const schoolLogoKey = matchSchoolLogo(schoolName)
          return {
            id: `edu_${Date.now()}_${i}`,
            school: schoolName,
            major: e.subtitle || e.major || '',
            degree: e.degree || '',
            startDate,
            endDate,
            // 补充说明是富文本编辑器字段，统一转成无序列表 HTML（与 Agent 编辑链路一致）
            description: e.details && e.details.length > 0
              ? highlightsToHtml(e.details)
              : '',
            visible: true,
            ...(schoolLogoKey ? { schoolLogo: schoolLogoKey } : {}),
          }
        })
        setResumeData((prev) => ({
          ...prev,
          education: [...prev.education, ...newEducations],
        }))
      }
      break

    case 'experience':
      if (Array.isArray(data)) {
        const newExps = data.map((e: any, i: number) => {
          const companyName = e.title || e.company || ''
          const logoKey = matchCompanyLogo(companyName)
          return {
            id: `exp_${Date.now()}_${i}`,
            company: defaultBoldCompany(companyName),
            position: e.subtitle || e.position || '',
            date: e.date || '',
            details: (() => {
              if (e.highlights) {
                return highlightsToHtml(e.highlights)
              }
              return e.details || ''
            })(),
            visible: true,
            ...(logoKey ? { companyLogo: logoKey } : {}),
          }
        })
        setResumeData((prev) => ({
          ...prev,
          experience: [...prev.experience, ...newExps],
        }))
      }
      break

    case 'projects':
      if (Array.isArray(data)) {
        const newProjects = data.map((p: any, i: number) => {
          // 合并项目描述和亮点
          let description = p.description || ''

          // 将 highlights 数组转换为 HTML 列表（支持嵌套层级）
          if (p.highlights && p.highlights.length > 0) {
            const highlightsList = highlightsToHtml(p.highlights)
            if (description) {
              description = description + highlightsList
            } else {
              description = highlightsList
            }
          }

          // 转换 description 中的 Markdown ** 加粗
          description = description.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

          return {
            id: `proj_${Date.now()}_${i}`,
            name: p.title || p.name || '',
            role: p.subtitle || p.role || '',
            date: p.date || '',
            description: description,
            visible: true,
          }
        })
        setResumeData((prev) => ({
          ...prev,
          projects: [...prev.projects, ...newProjects],
        }))
      }
      break

    case 'skills': {
      // 专业技能统一转成无序列表 HTML（对象数组 / 字符串都走同一个共享转换）。
      // AI 解析导入专属：先剔除明显混入技能区的项目描述条目（其它导入路径不过滤）。
      const skillHtml = skillsToHtml(dropNonSkillEntries(data))
      if (skillHtml) {
        setResumeData((prev) => ({
          ...prev,
          skillContent: skillHtml,
        }))
      }
      break
    }

    case 'selfEvaluation': {
      const summary = typeof data === 'string'
        ? data
        : (typeof data?.summary === 'string' ? data.summary : '')
      if (summary.trim()) {
        setResumeData((prev) => ({
          ...prev,
          selfEvaluation: `<p>${summary.trim()}</p>`,
        }))
      }
      break
    }

    case 'openSource':
      if (Array.isArray(data)) {
        const newOpenSources = data.map((o: any, i: number) => ({
          id: `os_${Date.now()}_${i}`,
          name: o.title || o.name || '',
          role: o.subtitle || o.role || '',
          repo: o.repoUrl || o.repo || '',
          date: o.date || '',
          // 使用支持嵌套层级的函数渲染 items（支持 **标题** 格式）
          description: o.items && o.items.length > 0
            ? groupedHighlightsToHtml(o.items)
            : o.description || '',
          visible: true,
        }))
        setResumeData((prev) => ({
          ...prev,
          openSource: [...(prev.openSource || []), ...newOpenSources],
        }))
      }
      break

    case 'awards':
      if (Array.isArray(data)) {
        const newAwards = data.map((a: any, i: number) => ({
          id: `award_${Date.now()}_${i}`,
          title: a.title || '',
          issuer: a.issuer || '',
          date: a.date || '',
          description: a.description || '',
          visible: true,
        }))
        setResumeData((prev) => ({
          ...prev,
          awards: [...(prev.awards || []), ...newAwards],
          globalSettings: meta?.awardsListType
            ? { ...(prev.globalSettings || {}), awardsListType: meta.awardsListType }
            : prev.globalSettings,
        }))
      }
      break
  }
}
