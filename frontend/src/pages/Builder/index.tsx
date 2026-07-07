/**
 * Resume Builder 页面 —— 页面壳移植自 Resume-Matcher components/builder/resume-builder.tsx。
 *
 * Swiss International Style:canvas #F0F0E8、黑边框、硬阴影、mono 大写标签、serif 大标题。
 * 本增量范围(见 knowledge-base/plans/2026-07-07-模板市场builder实施计划.md):
 * - TEMPLATE & FORMATTING 全量 + 5 套 RM 模板 + 分页实时预览
 * - 数据只读(内容编辑仍在原工作台);SAVE 持久化模板设置;DOWNLOAD 走浏览器打印
 * - COVER LETTER 等 4 个 tab 保留禁用态外观(RM 原版即如此),功能后续增量再定
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Download, PenLine, Save } from 'lucide-react'
import { getCurrentResumeId, getResume } from '@/services/resumeStorage'
import type { ResumeData } from '../Workspace/v2/types'
import type { BuilderResumeData } from './types'
import { toBuilderResumeData, buildSampleData } from './adapter'
import {
  type TemplateSettings,
  DEFAULT_TEMPLATE_SETTINGS,
  PAGE_SIZE_INFO,
} from './settings'
import { SwissButton } from './components/SwissButton'
import { RetroTabs } from './components/RetroTabs'
import { FormattingControls } from './components/FormattingControls'
import { PaginatedPreview } from './components/PaginatedPreview'
import { ResumeRenderer } from './templates/ResumeRenderer'
import './builder.css'

const SETTINGS_STORAGE_PREFIX = 'builder_settings:'

/** 存储边界:字段级默认合并,保证适配层拿到完整形状(与 useResumeData 同模式) */
function normalizeResumeData(raw: unknown): ResumeData {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Partial<ResumeData>
  return {
    id: data.id || '',
    title: data.title || '',
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
    templateId: data.templateId ?? null,
    basic: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      ...(data.basic || {}),
    },
    education: Array.isArray(data.education) ? data.education : [],
    experience: Array.isArray(data.experience) ? data.experience : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
    openSource: Array.isArray(data.openSource) ? data.openSource : [],
    awards: Array.isArray(data.awards) ? data.awards : [],
    customData: data.customData && typeof data.customData === 'object' ? data.customData : {},
    selfEvaluation: typeof data.selfEvaluation === 'string' ? data.selfEvaluation : '',
    skillContent: typeof data.skillContent === 'string' ? data.skillContent : '',
    activeSection: data.activeSection || 'basic',
    draggingProjectId: null,
    menuSections: Array.isArray(data.menuSections) ? data.menuSections : [],
    globalSettings: data.globalSettings || {},
  }
}

function loadSettings(storageKey: string): TemplateSettings {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        ...DEFAULT_TEMPLATE_SETTINGS,
        ...parsed,
        margins: { ...DEFAULT_TEMPLATE_SETTINGS.margins, ...parsed.margins },
        spacing: { ...DEFAULT_TEMPLATE_SETTINGS.spacing, ...parsed.spacing },
        fontSize: { ...DEFAULT_TEMPLATE_SETTINGS.fontSize, ...parsed.fontSize },
      }
    }
  } catch {
    // 损坏的设置直接回落默认
  }
  return DEFAULT_TEMPLATE_SETTINGS
}

type TabId = 'resume' | 'cover-letter' | 'outreach' | 'interview-prep' | 'jd-match'

export default function BuilderPage() {
  const navigate = useNavigate()
  const { resumeId: routeResumeId } = useParams<{ resumeId: string }>()

  const [resumeData, setResumeData] = useState<BuilderResumeData | null>(null)
  const [resumeName, setResumeName] = useState<string>('')
  const [isSample, setIsSample] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const [activeTab] = useState<TabId>('resume')

  const effectiveResumeId = routeResumeId || getCurrentResumeId() || ''
  const settingsKey = `${SETTINGS_STORAGE_PREFIX}${effectiveResumeId || 'default'}`

  const [settings, setSettings] = useState<TemplateSettings>(() => loadSettings(settingsKey))

  // 载入简历(路由 ID 优先,退回当前简历;都没有 → 示例数据)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const id = routeResumeId || getCurrentResumeId()
      if (id) {
        const saved = await getResume(id)
        if (cancelled) return
        if (saved && saved.data) {
          const normalized = normalizeResumeData(saved.data)
          setResumeData(toBuilderResumeData(normalized))
          setResumeName(saved.name || normalized.basic.name || '')
          setIsSample(false)
          setLoaded(true)
          return
        }
      }
      if (!cancelled) {
        setResumeData(buildSampleData())
        setResumeName('示例简历')
        setIsSample(true)
        setLoaded(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [routeResumeId])

  // 设置持久化(改动即存,SAVE 按钮做显式确认)
  useEffect(() => {
    localStorage.setItem(settingsKey, JSON.stringify(settings))
  }, [settings, settingsKey])

  const handleSettingsChange = useCallback((next: TemplateSettings) => {
    setSettings(next)
  }, [])

  const handleSave = () => {
    localStorage.setItem(settingsKey, JSON.stringify(settings))
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2000)
  }

  // DOWNLOAD:浏览器打印(@page 尺寸/边距按设置注入,打印根全尺寸渲染)
  useEffect(() => {
    const handleAfterPrint = () => document.body.classList.remove('builder-printing')
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  const handleDownload = () => {
    document.body.classList.add('builder-printing')
    // 等打印根完成一帧渲染再唤起打印
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print())
    })
  }

  // 打印时页边距交给 @page,渲染体边距归零(与 RM 后端 Playwright 的 margin 语义一致)
  const printSettings: TemplateSettings = useMemo(
    () => ({ ...settings, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
    [settings]
  )
  const printPageCss = `@page { size: ${settings.pageSize === 'A4' ? 'A4' : 'letter'}; margin: ${settings.margins.top}mm ${settings.margins.right}mm ${settings.margins.bottom}mm ${settings.margins.left}mm; }`

  const isTwoColumnTemplate = settings.template === 'vivid'

  if (!loaded || !resumeData) {
    return (
      <div className="h-screen w-full bg-[#F0F0E8] flex items-center justify-center">
        <span className="font-mono text-xs uppercase tracking-wider text-[#444850]">
          Loading…
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="h-screen w-full bg-[#F0F0E8] flex justify-center items-center p-4 md:p-8 no-print">
        {/* Main Container */}
        <div className="w-full h-full max-w-[90%] md:max-w-[95%] xl:max-w-[1800px] border border-black bg-[#F0F0E8] shadow-[8px_8px_0px_0px_#000000] flex flex-col">
          {/* Header Section */}
          <div className="border-b border-black p-6 md:p-8 bg-[#F0F0E8]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <SwissButton
                  variant="link"
                  onClick={() => navigate('/my-resumes')}
                  className="mb-2 -ml-1 text-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </SwissButton>
                <h1 className="font-serif text-3xl md:text-5xl text-black tracking-tight leading-[0.95] uppercase">
                  Resume Builder
                </h1>
                <div className="mt-3 flex items-center gap-3">
                  <p className="text-sm font-mono text-blue-700 uppercase tracking-wide font-bold">
                    {'// '}Edit Mode
                  </p>
                  {resumeName && (
                    <span className="font-mono text-xs text-[#444850] border border-black bg-white px-2 py-1">
                      {resumeName}
                    </span>
                  )}
                  {isSample && (
                    <span className="font-mono text-xs text-orange-600 bg-orange-50 px-2 py-1 border border-orange-200">
                      示例数据 · 未找到简历
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-4 md:mt-0">
                <SwissButton size="sm" onClick={handleSave}>
                  {saveState === 'saved' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saveState === 'saved' ? 'Saved' : 'Save'}
                </SwissButton>
                <SwissButton variant="success" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4" />
                  Download
                </SwissButton>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 bg-black gap-[1px] flex-1 min-h-0">
            {/* Left Panel: Editor */}
            <div className="bg-[#F0F0E8] p-6 md:p-8 overflow-y-auto">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                  <div className="w-3 h-3 bg-blue-700"></div>
                  <h2 className="font-mono text-lg font-bold uppercase tracking-wider">
                    Editor Panel
                  </h2>
                </div>

                <FormattingControls settings={settings} onChange={handleSettingsChange} />

                {/* 内容编辑指引(本增量数据只读) */}
                <div className="border border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000000]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-700"></div>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider">
                      Content
                    </span>
                  </div>
                  <p className="text-sm text-[#444850] leading-relaxed">
                    简历内容(经历、教育、技能等)暂在原工作台编辑,此页专注模板与排版。
                  </p>
                  {!isSample && effectiveResumeId && (
                    <SwissButton
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate(`/workspace/latex/${effectiveResumeId}`)}
                    >
                      <PenLine className="w-3 h-3" />
                      去工作台编辑内容
                    </SwissButton>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel: Preview with Tabs */}
            <div className="bg-[#E5E5E0] overflow-hidden flex flex-col">
              {/* Tabs Header */}
              <div className="px-6 pt-3 shrink-0 bg-[#E5E5E0]">
                <RetroTabs
                  tabs={[
                    { id: 'resume', label: 'Resume' },
                    { id: 'cover-letter', label: 'Cover Letter', disabled: true },
                    { id: 'outreach', label: 'Outreach Mail', disabled: true },
                    { id: 'interview-prep', label: 'Interview Prep', disabled: true },
                    { id: 'jd-match', label: 'JD Match', disabled: true },
                  ]}
                  activeTab={activeTab}
                  onTabChange={() => {}}
                />
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'resume' && (
                  <PaginatedPreview resumeData={resumeData} settings={settings} />
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#F0F0E8] flex justify-between items-center font-mono text-xs text-blue-700 border-t border-black">
            <span className="uppercase font-bold flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-700 inline-block"></span>
              Resume Builder Module
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-700"></div>
                <span className="uppercase">
                  {isTwoColumnTemplate ? 'Two Column' : 'Single Column'}
                </span>
              </div>
              <span className="text-[#878E99]">|</span>
              <span className="uppercase">{PAGE_SIZE_INFO[settings.pageSize].name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 打印根:仅打印时可见,全尺寸渲染当前模板 */}
      <div className="builder-print-root">
        <style>{printPageCss}</style>
        <ResumeRenderer resumeData={resumeData} settings={printSettings} />
      </div>
    </>
  )
}
