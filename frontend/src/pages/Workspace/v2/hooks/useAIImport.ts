/**
 * AI 导入 Hook
 */
import { useState, useCallback } from 'react'
import type { ResumeData } from '../types'
import { matchCompanyLogo } from '../constants/companyLogos'

// 检测是否是分组标题（如"**搜索服务拆分专项**"、"**性能优化**"）
function isGroupTitle(text: string): boolean {
  const trimmed = text.trim()
  
  // 1. 【最重要】以 **xxx** 包裹的文本 = DeepSeek 输出的分组标题
  if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
    return true
  }
  
  // 2. 以"专项"或"优化"结尾的短文本（常见的分组名称模式）
  if ((trimmed.endsWith('专项') || trimmed.endsWith('优化') || trimmed.endsWith('模块')) && trimmed.length < 25) {
    return true
  }
  
  // 3. 纯中文短文本（<15字符），不含冒号、句号、逗号等描述性标点
  // 这种情况通常是分组标题，而非具体描述
  if (trimmed.length < 15 && 
      /^[\u4e00-\u9fa5A-Za-z0-9\s\-]+$/.test(trimmed) && 
      !trimmed.includes(':') && 
      !trimmed.includes('：') && 
      !trimmed.includes('。') &&
      !trimmed.includes('，') &&
      !trimmed.includes(',')) {
    return true
  }
  
  return false
}

/** AI 导入时公司名默认加粗：用 ** 包裹，与编辑区 BoldInput 一致，导出/预览也会加粗 */
function defaultBoldCompany(s: string): string {
  const raw = (s || '').trim()
  if (!raw) return ''
  if (raw.startsWith('**') && raw.endsWith('**')) return raw
  return `**${raw}**`
}

// 格式化 highlights 为 HTML（支持嵌套层级，模块级函数）
function formatHighlightsToHtmlModule(highlights: any, listStyle: string = 'bullet'): string {
  if (!highlights) return ''
  const items = Array.isArray(highlights)
    ? highlights
    : typeof highlights === 'string'
      ? highlights.split('\n').filter((line: string) => line.trim())
      : []
  if (!items.length) return ''
  
  // 检测是否有分组标题（层级结构）
  const hasGroups = items.some((h: string) => isGroupTitle(h))
  
  if (hasGroups) {
    // 有层级结构，生成嵌套列表
    const groups: { title: string; children: string[] }[] = []
    let currentGroup: { title: string; children: string[] } | null = null
    
    for (const item of items) {
      const trimmed = item.trim()
      if (isGroupTitle(trimmed)) {
        // 保存前一个分组
        if (currentGroup) {
          groups.push(currentGroup)
        }
        // 开始新分组
        const formatted = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        currentGroup = { title: formatted, children: [] }
      } else if (currentGroup) {
        // 添加到当前分组
        const formatted = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        currentGroup.children.push(formatted)
      } else {
        // 没有分组标题的独立项
        const formatted = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        groups.push({ title: formatted, children: [] })
      }
    }
    // 保存最后一个分组
    if (currentGroup) {
      groups.push(currentGroup)
    }
    
    // 生成嵌套 HTML
    const groupsHtml = groups.map(g => {
      if (g.children.length > 0) {
        const childrenHtml = g.children.map(c => `<li>${c}</li>`).join('')
        return `<li><strong>${g.title.replace(/<\/?strong>/g, '')}</strong><ul class="custom-list nested-list">${childrenHtml}</ul></li>`
      } else {
        return `<li>${g.title}</li>`
      }
    }).join('')
    
    return `<ul class="custom-list">${groupsHtml}</ul>`
  }
  
  // 无层级结构，扁平列表
  const highlightsHtml = items.map((h: string) => {
    const formatted = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    return `<li>${formatted}</li>`
  }).join('')
  
  // 根据 listStyle 选择不同的列表标签
  if (listStyle === 'numbered') {
    return `<ol class="custom-list">${highlightsHtml}</ol>`
  } else if (listStyle === 'none') {
    // 无列表样式，用 div 包裹
    const divHtml = items.map((h: string) => {
      const formatted = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      return `<p>${formatted}</p>`
    }).join('')
    return divHtml
  }
  return `<ul class="custom-list">${highlightsHtml}</ul>`
}

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

  // 使用模块级函数的别名，保持代码兼容性
  const formatHighlightsToHtml = formatHighlightsToHtmlModule

  // AI 解析结果处理
  const handleAISave = useCallback((data: any) => {
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
            ? formatHighlightsToHtmlModule(o.items, 'bullet')
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
          return {
            id: `edu_${Date.now()}_${i}`,
            school: e.title || '',
            major: e.subtitle || '',
            degree: e.degree || '',
            startDate,
            endDate,
            description: e.details?.join('\n') || '',
            visible: true,
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
            details: formatHighlightsToHtml(e.highlights, experienceFormat.list_style || 'bullet'),
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
            const highlightsList = formatHighlightsToHtml(p.highlights, listStyle)
            
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
          // 强制格式化 skills 为标准 HTML 列表
          // 目标格式: <ul><li><p><strong>分类</strong>：描述</p></li>...</ul>
          if (data.skills && data.skills.length > 0) {
            const allItems: string[] = []
            
            for (const s of data.skills) {
              const category = s.category?.trim() || ''
              const details = s.details?.trim() || ''
              
              if (!details && !category) continue
              
              // 过滤掉明显不是技能的内容（如项目描述混入技能）
              if (!category && details.length > 100 && (
                details.includes('参与') || details.includes('负责') || details.includes('开发') ||
                details.includes('主导') || details.includes('构建')
              )) {
                continue // 跳过混入的项目描述
              }
              
              if (category) {
                // 有分类：统一为 <strong>分类</strong>：描述 格式
                allItems.push(`<li><p><strong>${category}</strong>：${details}</p></li>`)
              } else if (details) {
                // 无分类：尝试从 details 提取 "分类：描述" 格式
                const match = details.match(/^([^：:]{1,15})[：:](.+)$/)
                if (match) {
                  allItems.push(`<li><p><strong>${match[1].trim()}</strong>：${match[2].trim()}</p></li>`)
                } else {
                  allItems.push(`<li><p>${details}</p></li>`)
                }
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
          return {
            id: `edu_${Date.now()}_${i}`,
            school: e.title || e.school || '',
            major: e.subtitle || e.major || '',
            degree: e.degree || '',
            startDate,
            endDate,
            description: e.details?.join('\n') || '',
            visible: true,
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
                return formatHighlightsToHtmlModule(e.highlights, 'bullet')
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
            const highlightsList = formatHighlightsToHtmlModule(p.highlights, 'bullet')
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
        // 强制标准化为: <ul><li><p><strong>分类</strong>：描述</p></li>...</ul>
        const allItems: string[] = []
        
        for (const s of data) {
          const category = s.category?.trim() || ''
          const details = s.details?.trim() || ''
          
          if (!details && !category) continue
          
          // 过滤掉明显不是技能的内容
          if (!category && details.length > 100 && (
            details.includes('参与') || details.includes('负责') || details.includes('开发') ||
            details.includes('主导') || details.includes('构建')
          )) {
            continue
          }
          
          if (category) {
            allItems.push(`<li><p><strong>${category}</strong>：${details}</p></li>`)
          } else if (details) {
            const match = details.match(/^([^：:]{1,15})[：:](.+)$/)
            if (match) {
              allItems.push(`<li><p><strong>${match[1].trim()}</strong>：${match[2].trim()}</p></li>`)
            } else {
              allItems.push(`<li><p>${details}</p></li>`)
            }
          }
        }
        
        if (allItems.length > 0) {
          const skillHtml = `<ul class="custom-list">${allItems.join('')}</ul>`
          setResumeData((prev) => ({
            ...prev,
            skillContent: skillHtml,
          }))
        }
      } else if (typeof data === 'string' && data.trim()) {
        // 字符串类型：按行拆分并格式化
        const lines = data.split(/\n+/).map((l: string) => l.trim()).filter(Boolean)
        const skillItems = lines.map((line: string) => {
          const match = line.replace(/^[-•·*●]\s*/, '').match(/^([^：:]{1,15})[：:](.+)$/)
          if (match) {
            return `<li><p><strong>${match[1].trim()}</strong>：${match[2].trim()}</p></li>`
          }
          return `<li><p>${line}</p></li>`
        }).join('')
        const skillHtml = `<ul class="custom-list">${skillItems}</ul>`
        setResumeData((prev) => ({
          ...prev,
          skillContent: skillHtml,
        }))
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
          // 使用支持嵌套层级的函数渲染 items（支持 **标题** 格式）
          description: o.items && o.items.length > 0
            ? formatHighlightsToHtmlModule(o.items, 'bullet')
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
        }))
      }
      break
  }
}

