/**
 * AI 导入 Hook
 */
import { useState, useCallback } from 'react'
import type { ResumeData } from '../types'

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

  const formatHighlightsToHtml = (highlights: any): string => {
    if (!highlights) return ''
    const items = Array.isArray(highlights)
      ? highlights
      : typeof highlights === 'string'
        ? highlights.split('\n').filter((line) => line.trim())
        : []
    if (!items.length) return ''
    const highlightsHtml = items.map((h: string) => {
      const formatted = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      return `<li>${formatted}</li>`
    }).join('')
    return `<ul class="custom-list">${highlightsHtml}</ul>`
  }

  // AI 解析结果处理
  const handleAISave = useCallback((data: any) => {
    console.log('AI parsed data:', data, 'for section:', aiModalSection)

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
          description: o.items?.join('\n') || o.description || '',
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
        education: data.education?.map((e: any, i: number) => ({
          id: `edu_${Date.now()}_${i}`,
          school: e.title || '',
          major: e.subtitle || '',
          degree: e.degree || '',
          startDate: e.date?.split(' - ')[0] || '',
          endDate: e.date?.split(' - ')[1] || '',
          description: e.details?.join('\n') || '',
          visible: true,
        })) || prev.education,
        experience: data.internships?.map((e: any, i: number) => ({
          id: `exp_${Date.now()}_${i}`,
          company: e.title || '',
          position: e.subtitle || '',
          date: e.date || '',
          details: formatHighlightsToHtml(e.highlights),
          visible: true,
        })) || prev.experience,
        projects: data.projects?.map((p: any, i: number) => {
          // 合并项目描述和亮点
          let description = p.description || ''

          // 将 highlights 数组转换为 HTML 无序列表
          if (p.highlights && p.highlights.length > 0) {
            const highlightsHtml = p.highlights.map((h: string) => {
              // 转换 Markdown **加粗** 为 HTML <strong>
              const formatted = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
              return `<li>${formatted}</li>`
            }).join('')
            const highlightsList = `<ul class="custom-list">${highlightsHtml}</ul>`
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
        skillContent: (() => {
          // 强制格式化 skills 为 HTML 列表
          if (data.skills && data.skills.length > 0) {
            const skillItems = data.skills.map((s: any) => {
              const category = s.category?.trim() || ''
              const details = s.details?.trim() || ''
              if (!category) {
                return `<li><p>${details}</p></li>`
              }
              return `<li><p><strong>${category}</strong>: ${details}</p></li>`
            }).join('')
            return `<ul class="custom-list">${skillItems}</ul>`
          }
          return prev.skillContent
        })(),
      }))
    } else {
      // 分模块导入
      handleSectionImport(aiModalSection, data, setResumeData)
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
  setResumeData: React.Dispatch<React.SetStateAction<ResumeData>>
) {
  switch (section) {
    case 'education':
      if (Array.isArray(data)) {
        const newEducations = data.map((e: any, i: number) => ({
          id: `edu_${Date.now()}_${i}`,
          school: e.title || e.school || '',
          major: e.subtitle || e.major || '',
          degree: e.degree || '',
          startDate: e.date?.split(' - ')[0] || e.startDate || '',
          endDate: e.date?.split(' - ')[1] || e.endDate || '',
          description: e.details?.join('\n') || '',
          visible: true,
        }))
        setResumeData((prev) => ({
          ...prev,
          education: [...prev.education, ...newEducations],
        }))
      }
      break

    case 'experience':
      if (Array.isArray(data)) {
        const newExps = data.map((e: any, i: number) => ({
          id: `exp_${Date.now()}_${i}`,
          company: e.title || e.company || '',
          position: e.subtitle || e.position || '',
          date: e.date || '',
          details: (() => {
            if (e.highlights) {
              const items = Array.isArray(e.highlights)
                ? e.highlights
                : typeof e.highlights === 'string'
                  ? e.highlights.split('\n').filter((line: string) => line.trim())
                  : []
              if (items.length) {
                const highlightsHtml = items.map((h: string) => {
                  const formatted = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                  return `<li>${formatted}</li>`
                }).join('')
                return `<ul class="custom-list">${highlightsHtml}</ul>`
              }
            }
            return e.details || ''
          })(),
          visible: true,
        }))
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

          // 将 highlights 数组转换为 HTML 无序列表
          if (p.highlights && p.highlights.length > 0) {
            const highlightsHtml = p.highlights.map((h: string) => {
              // 转换 Markdown **加粗** 为 HTML <strong>
              const formatted = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
              return `<li>${formatted}</li>`
            }).join('')
            const highlightsList = `<ul class="custom-list">${highlightsHtml}</ul>`
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

    case 'skills':
      if (Array.isArray(data) && data.length > 0) {
        // 强制替换为格式化的 HTML 列表
        const skillItems = data.map((s: any) => {
          const category = s.category?.trim() || ''
          const details = s.details?.trim() || ''
          if (!category) {
            return `<li><p>${details}</p></li>`
          }
          return `<li><p><strong>${category}</strong>: ${details}</p></li>`
        }).join('')
        const skillHtml = `<ul class="custom-list">${skillItems}</ul>`
        setResumeData((prev) => ({
          ...prev,
          skillContent: skillHtml, // 强制替换，不追加
        }))
      } else if (typeof data === 'string' && data.trim()) {
        // 字符串类型也格式化为列表
        const lines = data.split('\n').filter((line: string) => line.trim())
        if (lines.length > 0) {
          const skillItems = lines.map((line: string) => `<li><p>${line.trim()}</p></li>`).join('')
          const skillHtml = `<ul class="custom-list">${skillItems}</ul>`
          setResumeData((prev) => ({
            ...prev,
            skillContent: skillHtml,
          }))
        }
      }
      break

    case 'openSource':
      if (Array.isArray(data)) {
        const newOpenSources = data.map((o: any, i: number) => ({
          id: `os_${Date.now()}_${i}`,
          name: o.title || o.name || '',
          role: o.subtitle || o.role || '',
          repo: o.repoUrl || o.repo || '',
          date: o.date || '',
          description: o.items?.join('\n') || o.description || '',
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
        }))
      }
      break
  }
}

