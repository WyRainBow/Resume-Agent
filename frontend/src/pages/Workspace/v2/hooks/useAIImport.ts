/**
 * AI 导入 Hook
 */
import { useState, useCallback } from 'react'
import type { ResumeData } from '../types'

// 智能拆分技能描述为多个列表项（模块级函数，供多处复用）
function splitSkillDetails(details: string): string[] {
  if (!details || typeof details !== 'string') return []
  const trimmed = details.trim()
  if (!trimmed) return []

  const normalizeItem = (text: string) =>
    text.trim().replace(/^[-•·*●]\s*/, '')

  const cleaned = trimmed.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 1) 优先按换行拆分（PDF 常见为每行一条）
  const byNewline = cleaned
    .split(/\n+/)
    .map(normalizeItem)
    .filter(Boolean)
  if (byNewline.length > 1) return byNewline

  // 2) 按"XXX："标题模式拆分（如"持续输出："）
  const titlePattern = /(?:^|。|\n)([^。：:]+[：:])/g
  const matches = cleaned.match(titlePattern)
  if (matches && matches.length > 1) {
    const parts: string[] = []
    const sentences = cleaned.split(/。(?=\s*\S)/).filter(s => s.trim())
    for (const sentence of sentences) {
      const s = normalizeItem(sentence)
      if (!s) continue
      if (/^[^：:]+[：:]/.test(s)) {
        const formatted = s.replace(/^([^：:]+)[：:]/, '<strong>$1</strong>：')
        parts.push(formatted)
      } else {
        parts.push(s)
      }
    }
    if (parts.length > 1) return parts
  }

  // 3) 按分号拆分
  const bySemicolon = cleaned
    .split(/[；;]+/)
    .map(normalizeItem)
    .filter(Boolean)
  if (bySemicolon.length > 1) return bySemicolon

  // 4) 按句号拆分（允许句号后有空白/换行）
  const bySentence = cleaned
    .split(/。(?=\s*\S)/)
    .map(normalizeItem)
    .filter(Boolean)
  if (bySentence.length > 1) return bySentence

  // 无法拆分，返回原文
  return [trimmed]
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
          // 强制格式化 skills 为 HTML 列表，并智能拆分 details
          if (data.skills && data.skills.length > 0) {
            const allItems: string[] = []
            
            for (const s of data.skills) {
              const category = s.category?.trim() || ''
              const details = s.details?.trim() || ''
              
              if (!details) continue
              
              // 尝试拆分 details 为多个列表项
              const splitItems = splitSkillDetails(details)
              
              if (category && splitItems.length === 1) {
                // 有分类且只有一条描述时，合并在同一行（韦宇格式）
                allItems.push(`<li><p><strong>${category}</strong>：${splitItems[0]}</p></li>`)
              } else if (category && splitItems.length > 1) {
                // 有分类且有多条描述时，使用嵌套结构
                allItems.push(`<li><p><strong>${category}</strong></p><ul class="custom-list">${splitItems.map(item => `<li><p>${item}</p></li>`).join('')}</ul></li>`)
              } else if (splitItems.length > 0) {
                // 无分类时，直接输出列表项（李俊杰格式）
                splitItems.forEach(item => {
                  allItems.push(`<li><p>${item}</p></li>`)
                })
              }
            }
            
            if (allItems.length > 0) {
              return `<ul class="custom-list">${allItems.join('')}</ul>`
            }
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
        // 强制替换为格式化的 HTML 列表，并智能拆分 details
        const allItems: string[] = []
        
        for (const s of data) {
          const category = s.category?.trim() || ''
          const details = s.details?.trim() || ''
          
          if (!details) continue
          
          // 尝试拆分 details 为多个列表项
          const splitItems = splitSkillDetails(details)
          
          if (category && splitItems.length === 1) {
            // 有分类且只有一条描述时，合并在同一行（韦宇格式）
            allItems.push(`<li><p><strong>${category}</strong>：${splitItems[0]}</p></li>`)
          } else if (category && splitItems.length > 1) {
            // 有分类且有多条描述时，使用嵌套结构
            allItems.push(`<li><p><strong>${category}</strong></p><ul class="custom-list">${splitItems.map(item => `<li><p>${item}</p></li>`).join('')}</ul></li>`)
          } else if (splitItems.length > 0) {
            // 无分类时，直接输出列表项（李俊杰格式）
            splitItems.forEach(item => {
              allItems.push(`<li><p>${item}</p></li>`)
            })
          }
        }
        
        if (allItems.length > 0) {
          const skillHtml = `<ul class="custom-list">${allItems.join('')}</ul>`
          setResumeData((prev) => ({
            ...prev,
            skillContent: skillHtml, // 强制替换，不追加
          }))
        }
      } else if (typeof data === 'string' && data.trim()) {
        // 字符串类型也格式化为列表
        const splitItems = splitSkillDetails(data)
        if (splitItems.length > 0) {
          const skillItems = splitItems.map((item: string) => `<li><p>${item}</p></li>`).join('')
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

