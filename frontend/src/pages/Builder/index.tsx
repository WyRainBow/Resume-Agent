/**
 * Resume Builder 页面 —— 页面壳移植自 Resume-Matcher components/builder/resume-builder.tsx。
 *
 * Swiss International Style:canvas #F0F0E8、黑边框、硬阴影、mono 大写标签、serif 大标题。
 * P1-1 后架构(见 knowledge-base/plans/2026-07-07-模板市场builder-交接文档.md):
 * - 状态真相源 = v2 ResumeData(source);渲染经 toBuilderResumeData 派生,表单直接编辑 v2 字段,
 *   不需要整体反向适配器(避免隐藏项/合并字段的身份丢失)
 * - SAVE = saveResume(含 globalSettings.builderSettings 随简历入库);RESET 回滚到上次保存
 * - AI 按钮跳我方 Coco(/agent/:id);未保存徽标 + beforeunload 拦截
 * - DOWNLOAD 走浏览器打印;COVER LETTER 等 4 tab 保留禁用态外观(RM 原版即如此)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Download, RotateCcw, Save, Sparkles, TriangleAlert } from 'lucide-react'
import { getCurrentResumeId, getResume, saveResume } from '@/services/resumeStorage'
import { toast } from '@/lib/toast'
import type { ResumeData } from '../Workspace/v2/types'
import { buildSampleResumeData, normalizeResumeData, toBuilderResumeData } from './adapter'
import {
  type TemplateSettings,
  DEFAULT_TEMPLATE_SETTINGS,
  PAGE_SIZE_INFO,
  withSettingsDefaults,
} from './settings'
import { SwissButton } from './components/SwissButton'
import { RetroTabs } from './components/RetroTabs'
import { FormattingControls } from './components/FormattingControls'
import { PaginatedPreview } from './components/PaginatedPreview'
import { ResumeRenderer } from './templates/ResumeRenderer'
import { ResumeForm } from './forms/ResumeForm'
import './builder.css'

const SETTINGS_STORAGE_PREFIX = 'builder_settings:'

function loadLocalSettings(storageKey: string): TemplateSettings {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) return withSettingsDefaults(JSON.parse(saved))
  } catch {
    // 损坏的设置直接回落默认
  }
  return DEFAULT_TEMPLATE_SETTINGS
}

type TabId = 'resume' | 'cover-letter' | 'outreach' | 'interview-prep' | 'jd-match'

export default function BuilderPage() {
  const navigate = useNavigate()
  const { resumeId: routeResumeId } = useParams<{ resumeId: string }>()

  // 真相源:v2 ResumeData;渲染数据经 adapter 派生
  const [source, setSource] = useState<ResumeData | null>(null)
  const [lastSaved, setLastSaved] = useState<ResumeData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [resumeName, setResumeName] = useState<string>('')
  const [isSample, setIsSample] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [activeTab] = useState<TabId>('resume')

  const effectiveResumeId = routeResumeId || getCurrentResumeId() || ''
  const settingsKey = `${SETTINGS_STORAGE_PREFIX}${effectiveResumeId || 'default'}`

  const [settings, setSettings] = useState<TemplateSettings>(() => loadLocalSettings(settingsKey))

  const builderData = useMemo(() => (source ? toBuilderResumeData(source) : null), [source])

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
          setSource(normalized)
          setLastSaved(structuredClone(normalized))
          setResumeName(saved.name || normalized.basic.name || '')
          setIsSample(false)
          setDirty(false)
          // 简历内嵌的 Builder 排版设置优先于 localStorage
          const embedded = normalized.globalSettings?.builderSettings
          if (embedded && typeof embedded === 'object') {
            setSettings(withSettingsDefaults(embedded))
          }
          setLoaded(true)
          return
        }
      }
      if (!cancelled) {
        const sample = buildSampleResumeData()
        setSource(sample)
        setLastSaved(structuredClone(sample))
        setResumeName('示例简历')
        setIsSample(true)
        setDirty(false)
        setLoaded(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [routeResumeId])

  // 设置持久化(改动即存 localStorage;SAVE 时随简历入库)
  useEffect(() => {
    localStorage.setItem(settingsKey, JSON.stringify(settings))
  }, [settings, settingsKey])

  // 未保存拦截
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const handleSettingsChange = useCallback((next: TemplateSettings) => {
    setSettings(next)
  }, [])

  const updateSource = useCallback((updater: (prev: ResumeData) => ResumeData) => {
    setSource((prev) => (prev ? updater(prev) : prev))
    setDirty(true)
  }, [])

  const handleSave = async () => {
    if (!source) return
    if (isSample) {
      toast.error('示例数据不可保存,请先在工作台创建简历')
      return
    }
    setSaveState('saving')
    try {
      const withSettings: ResumeData = {
        ...source,
        globalSettings: {
          ...source.globalSettings,
          builderSettings: settings as unknown as Record<string, unknown>,
        },
      }
      await saveResume(withSettings, effectiveResumeId || undefined)
      setSource(withSettings)
      setLastSaved(structuredClone(withSettings))
      setDirty(false)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      setSaveState('idle')
      toast.error(`保存失败:${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleReset = () => {
    if (!lastSaved) return
    setSource(structuredClone(lastSaved))
    setDirty(false)
  }

  // DOWNLOAD:浏览器打印(@page 尺寸/边距按设置注入,打印根全尺寸渲染)
  useEffect(() => {
    const handleAfterPrint = () => document.body.classList.remove('builder-printing')
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  const handleDownload = () => {
    document.body.classList.add('builder-printing')
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

  if (!loaded || !source || !builderData) {
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
                  onClick={() => navigate('/builder/dashboard')}
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
                  {dirty && (
                    <span className="flex items-center gap-1 font-mono text-xs text-amber-700 bg-amber-50 px-2 py-1 border border-amber-200 uppercase">
                      <TriangleAlert className="w-3 h-3" />
                      Unsaved
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-4 md:mt-0">
                {!isSample && effectiveResumeId && (
                  <SwissButton
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/agent/${effectiveResumeId}`)}
                    title="用 AI 助手优化这份简历"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Optimize
                  </SwissButton>
                )}
                <SwissButton
                  variant="warning"
                  size="sm"
                  onClick={handleReset}
                  disabled={!dirty}
                  title="放弃未保存修改,回到上次保存"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </SwissButton>
                <SwissButton size="sm" onClick={handleSave} disabled={saveState === 'saving'}>
                  {saveState === 'saved' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save'}
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

                {/* 内容编辑(P1-1):直接编辑 v2 数据,预览实时更新 */}
                <ResumeForm data={source} onChange={updateSource} />
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
                  <PaginatedPreview resumeData={builderData} settings={settings} />
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
        <ResumeRenderer resumeData={builderData} settings={printSettings} />
      </div>
    </>
  )
}
