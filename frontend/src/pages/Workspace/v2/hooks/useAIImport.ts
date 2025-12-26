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

  // AI 解析结果处理
  const handleAISave = useCallback((data: any) => {
    console.log('AI parsed data:', data, 'for section:', aiModalSection)
    
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
          details: e.highlights?.join('\n') || '',
          visible: true,
        })) || prev.experience,
        projects: data.projects?.map((p: any, i: number) => {
          // 合并项目描述和亮点
          let description = ''
          if (p.description) {
            description = p.description
          }
          if (p.highlights && p.highlights.length > 0) {
            const highlightsText = p.highlights.join('\n')
            if (description) {
              description = description + '\n\n' + highlightsText
            } else {
              description = highlightsText
            }
          }
          return {
            id: `proj_${Date.now()}_${i}`,
            name: p.title || '',
            role: p.subtitle || '',
            date: p.date || '',
            description: description,
            visible: true,
          }
        }) || prev.projects,
        openSource: data.open_source?.map((o: any, i: number) => ({
          id: `os_${Date.now()}_${i}`,
          name: o.title || '',
          role: o.subtitle || '',
          repo: o.repoUrl || '',
          date: o.date || '',
          description: o.items?.join('\n') || '',
          visible: true,
        })) || prev.openSource,
        awards: data.awards?.map((a: any, i: number) => ({
          id: `award_${Date.now()}_${i}`,
          title: a.title || '',
          issuer: a.issuer || '',
          date: a.date || '',
          description: a.description || '',
          visible: true,
        })) || prev.awards,
        skillContent: data.skills?.length > 0 ? `<ul class="custom-list">${data.skills.map((s: any) => {
          // 如果 category 为空，说明是单行技能描述，直接返回 details
          if (!s.category || s.category === '') {
            return `<li><p>${s.details || ''}</p></li>`
          }
          // 如果有 category，使用分类格式
          return `<li><p><strong>${s.category}</strong>: ${s.details || ''}</p></li>`
        }).join('')}</ul>` : prev.skillContent,
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
          details: e.highlights?.join('\n') || e.details || '',
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
          let description = ''
          if (p.description) {
            description = p.description
          }
          if (p.highlights && p.highlights.length > 0) {
            const highlightsText = p.highlights.join('\n')
            if (description) {
              description = description + '\n\n' + highlightsText
            } else {
              description = highlightsText
            }
          }
          return {
            id: `proj_${Date.now()}_${i}`,
            name: p.title || p.name || '',
            role: p.subtitle || p.role || '',
            date: p.date || '',
            description: description || '',
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
      if (Array.isArray(data)) {
        const skillHtml = `<ul class="custom-list">${data.map((s: any) => {
          // 如果 category 为空，说明是单行技能描述，直接返回 details
          if (!s.category || s.category === '') {
            return `<li><p>${s.details || ''}</p></li>`
          }
          // 如果有 category，使用分类格式
          return `<li><p><strong>${s.category}</strong>: ${s.details || ''}</p></li>`
        }).join('')}</ul>`
        setResumeData((prev) => ({
          ...prev,
          skillContent: prev.skillContent ? prev.skillContent + skillHtml : skillHtml,
        }))
      } else if (typeof data === 'string') {
        setResumeData((prev) => ({
          ...prev,
          skillContent: prev.skillContent ? prev.skillContent + '<br>' + data : data,
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

