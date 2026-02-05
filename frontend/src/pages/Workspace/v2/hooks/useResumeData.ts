/**
 * 简历数据管理 Hook
 */
import { useState, useCallback, useEffect } from 'react'
import { getCurrentResumeId, setCurrentResumeId, getResume } from '../../../../services/resumeStorage'
import { loadFromStorage, STORAGE_KEY } from '../constants'
import type {
  ResumeData,
  MenuSection,
  BasicInfo,
  Project,
  Experience,
  Education,
  OpenSource,
  Award,
  GlobalSettings,
} from '../types'

export function useResumeData() {
  // 当前编辑的简历 ID
  const [currentResumeId, setCurrentId] = useState<string | null>(() => getCurrentResumeId())
  
  // 简历数据状态
  const [resumeData, setResumeData] = useState<ResumeData>(loadFromStorage)
  const [activeSection, setActiveSection] = useState('basic')
  
  // 数据是否已从后端加载完成
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  // 从 Dashboard 进入时加载对应简历
  useEffect(() => {
    const loadResume = async () => {
      const id = getCurrentResumeId()
      if (!id) {
        // 没有 ID 表示新建简历，直接标记为已加载
        setIsDataLoaded(true)
        return
      }
      const saved = await getResume(id)
      if (saved && saved.data) {
        const data = saved.data as any
        setResumeData(prev => ({
          ...prev,
          basic: { ...prev.basic, ...(data.basic || {}), name: saved.name },
          education: data.education || prev.education,
          experience: data.experience || prev.experience,
          projects: data.projects || prev.projects,
          templateType: data.templateType || prev.templateType,  // 保留模板类型
          templateId: data.templateId || prev.templateId,  // 保留模板 ID
        }))
        setCurrentId(id)
      }
      // 标记数据已加载完成
      setIsDataLoaded(true)
    }

    loadResume()
  }, [])

  // 自动保存到 localStorage
  useEffect(() => {
    const saveData = { ...resumeData, updatedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))
  }, [resumeData])

  // ============ 基本信息 ============
  const updateBasicInfo = useCallback((data: Partial<BasicInfo>) => {
    setResumeData((prev) => ({
      ...prev,
      basic: { ...prev.basic, ...data },
    }))
  }, [])

  // ============ 项目经历 ============
  const updateProject = useCallback((project: Project) => {
    setResumeData((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === project.id ? project : p)),
    }))
  }, [])

  const deleteProject = useCallback((id: string) => {
    setResumeData((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
    }))
  }, [])

  const reorderProjects = useCallback((projects: Project[]) => {
    setResumeData((prev) => ({ ...prev, projects }))
  }, [])

  // ============ 实习经历 ============
  const updateExperience = useCallback((experience: Experience) => {
    setResumeData((prev) => ({
      ...prev,
      experience: prev.experience.map((e) =>
        e.id === experience.id ? experience : e
      ),
    }))
  }, [])

  const deleteExperience = useCallback((id: string) => {
    setResumeData((prev) => ({
      ...prev,
      experience: prev.experience.filter((e) => e.id !== id),
    }))
  }, [])

  const reorderExperiences = useCallback((experiences: Experience[]) => {
    setResumeData((prev) => ({ ...prev, experience: experiences }))
  }, [])

  // ============ 教育经历 ============
  const updateEducation = useCallback((education: Education) => {
    setResumeData((prev) => ({
      ...prev,
      education: prev.education.map((e) =>
        e.id === education.id ? education : e
      ),
    }))
  }, [])

  const deleteEducation = useCallback((id: string) => {
    setResumeData((prev) => ({
      ...prev,
      education: prev.education.filter((e) => e.id !== id),
    }))
  }, [])

  const reorderEducations = useCallback((educations: Education[]) => {
    setResumeData((prev) => ({ ...prev, education: educations }))
  }, [])

  // ============ 开源经历 ============
  const updateOpenSource = useCallback((openSource: OpenSource) => {
    setResumeData((prev) => ({
      ...prev,
      openSource: prev.openSource.map((o) =>
        o.id === openSource.id ? openSource : o
      ),
    }))
  }, [])

  const deleteOpenSource = useCallback((id: string) => {
    setResumeData((prev) => ({
      ...prev,
      openSource: prev.openSource.filter((o) => o.id !== id),
    }))
  }, [])

  const reorderOpenSources = useCallback((openSources: OpenSource[]) => {
    setResumeData((prev) => ({ ...prev, openSource: openSources }))
  }, [])

  // ============ 荣誉奖项 ============
  const updateAward = useCallback((award: Award) => {
    setResumeData((prev) => ({
      ...prev,
      awards: prev.awards.map((a) =>
        a.id === award.id ? award : a
      ),
    }))
  }, [])

  const deleteAward = useCallback((id: string) => {
    setResumeData((prev) => ({
      ...prev,
      awards: prev.awards.filter((a) => a.id !== id),
    }))
  }, [])

  const reorderAwards = useCallback((awards: Award[]) => {
    setResumeData((prev) => ({ ...prev, awards }))
  }, [])

  // ============ 技能 ============
  const updateSkillContent = useCallback((content: string) => {
    setResumeData((prev) => ({ ...prev, skillContent: content }))
  }, [])

  // ============ 菜单/布局 ============
  const updateMenuSections = useCallback((sections: MenuSection[]) => {
    setResumeData((prev) => ({ ...prev, menuSections: sections }))
  }, [])

  const reorderSections = useCallback((sections: MenuSection[]) => {
    const updatedSections = sections.map((s, index) => ({ ...s, order: index }))
    setResumeData((prev) => ({ ...prev, menuSections: updatedSections }))
  }, [])

  const toggleSectionVisibility = useCallback((id: string) => {
    setResumeData((prev) => ({
      ...prev,
      menuSections: prev.menuSections.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    }))
  }, [])

  // ============ 全局设置 ============
  const updateGlobalSettings = useCallback((settings: Partial<GlobalSettings>) => {
    setResumeData((prev) => ({
      ...prev,
      globalSettings: { ...prev.globalSettings, ...settings },
    }))
  }, [])

  // ============ 自定义模块 ============
  const addCustomSection = useCallback(() => {
    const customId = `custom_${Date.now()}`
    const newSection: MenuSection = {
      id: customId,
      title: '自定义模块',
      icon: '📝',
      enabled: true,
      order: resumeData.menuSections.length,
    }
    setResumeData((prev) => ({
      ...prev,
      menuSections: [...prev.menuSections, newSection],
      customData: { ...prev.customData, [customId]: [] },
    }))
  }, [resumeData.menuSections.length])

  return {
    resumeData,
    setResumeData,
    activeSection,
    setActiveSection,
    currentResumeId,
    setCurrentId,
    isDataLoaded,  // 数据是否已加载完成
    // 基本信息
    updateBasicInfo,
    // 项目
    updateProject,
    deleteProject,
    reorderProjects,
    // 经历
    updateExperience,
    deleteExperience,
    reorderExperiences,
    // 教育
    updateEducation,
    deleteEducation,
    reorderEducations,
    // 开源
    updateOpenSource,
    deleteOpenSource,
    reorderOpenSources,
    // 奖项
    updateAward,
    deleteAward,
    reorderAwards,
    // 技能
    updateSkillContent,
    // 菜单
    updateMenuSections,
    reorderSections,
    toggleSectionVisibility,
    // 设置
    updateGlobalSettings,
    addCustomSection,
  }
}

