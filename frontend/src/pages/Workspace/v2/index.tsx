/**
 * Workspace v2 - 三列布局
 * 第一列：SidePanel（布局管理）
 * 第二列：EditPanel（可视化编辑）
 * 第三列：PreviewPanel（PDF 预览）
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../../lib/utils'
import { renderPDFStream } from '../../../services/api'
import { saveResume, getCurrentResumeId, setCurrentResumeId, getResume } from '../../../services/resumeStorage'
import { Save, FolderOpen, Check } from 'lucide-react'

// 组件
import ResizableLayout from './ResizableLayout'
import { saveAs } from 'file-saver'
import AIImportModal from './shared/AIImportModal'

// 类型
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
  DEFAULT_MENU_SECTIONS,
} from './types'

/**
 * 初始简历数据
 */
const initialResumeData: ResumeData = {
  id: `resume_${Date.now()}`,
  title: '我的简历',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  templateId: null,
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
  skillContent: '', // 默认为空，不要有任何 HTML 标签
  activeSection: 'basic',
  draggingProjectId: null,
  menuSections: [
    { id: 'basic', title: '基本信息', icon: '👤', enabled: true, order: 0 },
    { id: 'skills', title: '专业技能', icon: '⚡', enabled: true, order: 1 },
    { id: 'experience', title: '实习经历', icon: '💼', enabled: true, order: 2 },
    { id: 'projects', title: '项目经历', icon: '🚀', enabled: true, order: 3 },
    { id: 'openSource', title: '开源经历', icon: '🔗', enabled: true, order: 4 },
    { id: 'awards', title: '荣誉奖项', icon: '🏆', enabled: false, order: 5 },
    { id: 'education', title: '教育经历', icon: '🎓', enabled: true, order: 6 },
  ],
  globalSettings: {
    lineHeight: 1.5,
    baseFontSize: 16,
    headerSize: 18,
    pagePadding: 40,
    sectionSpacing: 20,
    paragraphSpacing: 10,
  },
}

const STORAGE_KEY = 'resume_v2_data'

// 从 localStorage 加载数据，并合并新模块
const loadFromStorage = (): ResumeData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved) as ResumeData
      // 合并新模块到 menuSections（如果旧数据缺少新模块）
      const existingIds = new Set(data.menuSections.map(s => s.id))
      const newSections = initialResumeData.menuSections.filter(s => !existingIds.has(s.id))
      if (newSections.length > 0) {
        data.menuSections = [...data.menuSections, ...newSections]
      }
      // 确保新字段存在
      if (!data.openSource) data.openSource = []
      if (!data.awards) data.awards = []
      return data
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e)
  }
  return initialResumeData
}

export default function WorkspaceV2() {
  const navigate = useNavigate()
  
  // 当前编辑的简历 ID（从 Dashboard 进入时会设置）
  const [currentResumeId, setCurrentId] = useState<string | null>(() => getCurrentResumeId())
  
  // 简历数据状态（从 localStorage 初始化）
  const [resumeData, setResumeData] = useState<ResumeData>(loadFromStorage)
  const [activeSection, setActiveSection] = useState('basic')

  // PDF 状态
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')

  // AI 导入弹窗状态
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiModalSection, setAiModalSection] = useState<string>('all')
  const [aiModalTitle, setAiModalTitle] = useState('全局导入')

  // 从 Dashboard 进入时加载对应简历
  useEffect(() => {
    const id = getCurrentResumeId()
    if (id) {
      const saved = getResume(id)
      if (saved && saved.data) {
        // 将保存的数据合并到当前状态
        setResumeData(prev => ({
          ...prev,
          basic: { ...prev.basic, ...saved.data.basic, name: saved.name },
          education: saved.data.education || prev.education,
          experience: saved.data.experience || prev.experience,
          projects: saved.data.projects || prev.projects,
        }))
        setCurrentId(id)
      }
    }
  }, [])

  // 自动保存到 localStorage
  useEffect(() => {
    const saveData = { ...resumeData, updatedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))
  }, [resumeData])

  // ============ 更新回调函数 ============

  const updateBasicInfo = useCallback((data: Partial<BasicInfo>) => {
    setResumeData((prev) => ({
      ...prev,
      basic: { ...prev.basic, ...data },
    }))
  }, [])

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

  // 开源经历
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

  // 荣誉奖项
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

  const updateSkillContent = useCallback((content: string) => {
    setResumeData((prev) => ({ ...prev, skillContent: content }))
  }, [])

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

  const updateGlobalSettings = useCallback((settings: Partial<GlobalSettings>) => {
    setResumeData((prev) => ({
      ...prev,
      globalSettings: { ...prev.globalSettings, ...settings },
    }))
  }, [])

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

  // ============ PDF 渲染 ============

  /**
   * 将 ResumeData 转换为后端需要的格式
   */
  const convertToBackendFormat = (data: ResumeData) => {
    return {
      name: data.basic.name,
      contact: {
        phone: data.basic.phone,
        email: data.basic.email,
        location: data.basic.location,
      },
      objective: data.basic.title,
      // HTML 格式，后端会转换为 LaTeX
      skills: data.skillContent ? [{ category: '技能', details: data.skillContent }] : [],
      internships: data.experience.filter(e => e.visible !== false).map((e) => ({
        title: e.company,
        subtitle: e.position,
        date: e.date,
        highlights: [e.details], // HTML 格式
      })),
      // 没有 visible 字段的老数据也视为可见
      projects: data.projects.filter(p => p.visible !== false).map((p) => ({
        title: p.name,
        subtitle: p.role,
        date: p.date,
        highlights: [p.description], // HTML 格式
      })),
      // 开源经历
      open_source: (data.openSource || []).filter(o => o.visible !== false).map((o) => ({
        title: o.name,
        subtitle: o.role || '',
        repoUrl: o.repo || '',
        date: o.date || '',
        items: [o.description], // HTML 格式
      })),
      // 荣誉奖项
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
          // 映射到后端的 section ID
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

  const handleRender = useCallback(async () => {
    setLoading(true)
    setProgress('正在准备数据...')

    try {
      const backendData = convertToBackendFormat(resumeData)
      setProgress('正在渲染 PDF...')

      const blob = await renderPDFStream(
        backendData,
        backendData.sectionOrder,
        (p) => setProgress(p),
        () => setProgress('渲染完成！'),
        (err) => setProgress(`错误: ${err}`)
      )

      setPdfBlob(blob)
      setProgress('')
    } catch (error) {
      console.error('PDF 渲染失败:', error)
      setProgress(`渲染失败: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [resumeData])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return

    // 生成文件名（格式：姓名_简历_日期.pdf）
    const name = resumeData.basic.name || '简历'
    const date = new Date().toISOString().split('T')[0]
    const filename = `${name}_简历_${date}.pdf`

    // 使用 FileSaver.js 的 saveAs 函数
    // 它内部会处理各种浏览器兼容性问题
    const file = new File([pdfBlob], filename, { type: 'application/pdf' })
    saveAs(file, filename)
  }, [pdfBlob, resumeData.basic.name])

  // 保存状态
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 保存到 Dashboard
  const handleSaveToDashboard = useCallback(() => {
    // 构建符合 Resume 类型的数据
    const resumeToSave = {
      name: resumeData.basic.name || '未命名简历',
      basic: resumeData.basic,
      education: resumeData.education,
      experience: resumeData.experience,
      projects: resumeData.projects,
      skills: resumeData.skillContent ? [{ category: '技能', details: resumeData.skillContent }] : [],
    }
    
    // 使用 resumeStorage 服务保存（传入 ID 则更新，否则新建）
    const saved = saveResume(resumeToSave as any, currentResumeId || undefined)
    
    // 更新当前简历 ID（如果是新建的话）
    if (!currentResumeId) {
      setCurrentId(saved.id)
      setCurrentResumeId(saved.id)
    }
    
    // 显示保存成功提示
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }, [resumeData, currentResumeId])

  // AI 导入回调（分模块）
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

  // 全局 AI 导入
  const handleGlobalAIImport = useCallback(() => {
    setAiModalSection('all')
    setAiModalTitle('全局导入')
    setAiModalOpen(true)
  }, [])

  // AI 解析结果处理
  const handleAISave = useCallback((data: any) => {
    console.log('AI parsed data:', data, 'for section:', aiModalSection)
    
    if (aiModalSection === 'all') {
      // 全局导入：填充所有字段
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
        projects: data.projects?.map((p: any, i: number) => ({
          id: `proj_${Date.now()}_${i}`,
          name: p.title || '',
          role: p.subtitle || '',
          date: p.date || '',
          description: p.highlights?.join('\n') || '',
          visible: true,
        })) || prev.projects,
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
        skillContent: data.skills?.map((s: any) => 
          `<strong>${s.category}</strong>: ${s.details}`
        ).join('<br>') || prev.skillContent,
      }))
    } else {
      // 分模块导入
      switch (aiModalSection) {
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
            const newProjects = data.map((p: any, i: number) => ({
              id: `proj_${Date.now()}_${i}`,
              name: p.title || p.name || '',
              role: p.subtitle || p.role || '',
              date: p.date || '',
              description: p.highlights?.join('\n') || p.description || '',
              visible: true,
            }))
            setResumeData((prev) => ({
              ...prev,
              projects: [...prev.projects, ...newProjects],
            }))
          }
          break
        case 'skills':
          if (Array.isArray(data)) {
            const skillHtml = data.map((s: any) => 
              `<strong>${s.category}</strong>: ${s.details}`
            ).join('<br>')
            setResumeData((prev) => ({
              ...prev,
              skillContent: prev.skillContent ? prev.skillContent + '<br>' + skillHtml : skillHtml,
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
  }, [aiModalSection])

  return (
    <main
      className={cn(
        'w-full h-screen overflow-hidden',
        'bg-white text-gray-900',
        'dark:bg-neutral-900 dark:text-neutral-200'
      )}
    >
      {/* 顶部导航 */}
      <div className={cn(
        'h-14 border-b flex items-center px-4',
        'bg-white border-gray-200',
        'dark:bg-neutral-800 dark:border-neutral-700'
      )}>
        <h1 className="text-lg font-semibold">简历编辑器</h1>
        <div className="flex-1" />
        
        {/* 全局 AI 导入按钮 */}
        <button
          onClick={handleGlobalAIImport}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-pink-500 hover:to-purple-500 text-white text-sm font-medium shadow-md transition-all flex items-center gap-2"
        >
          ✨ AI 全局导入
        </button>
        
        <button
          onClick={handleSaveToDashboard}
          disabled={saveSuccess}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all flex items-center gap-2 ml-3",
            saveSuccess 
              ? "bg-green-500 text-white cursor-default" 
              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
          )}
        >
          {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saveSuccess ? '已保存' : '保存'}
        </button>
        
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 text-sm font-medium shadow-md transition-all flex items-center gap-2 ml-3"
        >
          <FolderOpen className="w-4 h-4" />
          我的简历
        </button>
      </div>

      {/* AI 导入弹窗 */}
      <AIImportModal
        isOpen={aiModalOpen}
        sectionType={aiModalSection}
        sectionTitle={aiModalTitle}
        onClose={() => setAiModalOpen(false)}
        onSave={handleAISave}
      />

      {/* 三列布局 - 可拖拽分隔线 */}
      <ResizableLayout
        resumeData={resumeData}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        toggleSectionVisibility={toggleSectionVisibility}
        updateMenuSections={updateMenuSections}
        reorderSections={reorderSections}
        updateGlobalSettings={updateGlobalSettings}
        addCustomSection={addCustomSection}
        updateBasicInfo={updateBasicInfo}
        updateProject={updateProject}
        deleteProject={deleteProject}
        reorderProjects={reorderProjects}
        updateExperience={updateExperience}
        deleteExperience={deleteExperience}
        reorderExperiences={reorderExperiences}
        updateEducation={updateEducation}
        deleteEducation={deleteEducation}
        reorderEducations={reorderEducations}
        updateOpenSource={updateOpenSource}
        deleteOpenSource={deleteOpenSource}
        reorderOpenSources={reorderOpenSources}
        updateAward={updateAward}
        deleteAward={deleteAward}
        reorderAwards={reorderAwards}
        updateSkillContent={updateSkillContent}
        handleAIImport={handleAIImport}
        pdfBlob={pdfBlob}
        loading={loading}
        progress={progress}
        handleRender={handleRender}
        handleDownload={handleDownload}
      />
    </main>
  )
}

