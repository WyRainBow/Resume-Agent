/**
 * Resume 分发器 —— 移植自 Resume-Matcher components/dashboard/resume-component.tsx。
 * 差异:无 i18n label props。RM 全部 7 套模板已齐(双栏两套于 2026-07-08 补齐)。
 */
import React from 'react'
import type { BuilderResumeData } from '../types'
import {
  type TemplateSettings,
  DEFAULT_TEMPLATE_SETTINGS,
  settingsToCssVars,
} from '../settings'
import { ResumeLatex } from './ResumeLatex'
import { ResumeSingleColumn } from './ResumeSingleColumn'
import { ResumeTwoColumn } from './ResumeTwoColumn'
import { ResumeModern } from './ResumeModern'
import { ResumeModernTwoColumn } from './ResumeModernTwoColumn'
import { ResumeClean } from './ResumeClean'
import { ResumeVivid } from './ResumeVivid'
import baseStyles from './styles/_base.module.css'

interface ResumeRendererProps {
  resumeData: BuilderResumeData
  settings?: TemplateSettings
}

export const ResumeRenderer: React.FC<ResumeRendererProps> = ({ resumeData, settings }) => {
  const mergedSettings: TemplateSettings = {
    ...DEFAULT_TEMPLATE_SETTINGS,
    ...settings,
    margins: { ...DEFAULT_TEMPLATE_SETTINGS.margins, ...settings?.margins },
    spacing: { ...DEFAULT_TEMPLATE_SETTINGS.spacing, ...settings?.spacing },
    fontSize: { ...DEFAULT_TEMPLATE_SETTINGS.fontSize, ...settings?.fontSize },
  }

  const cssVars = settingsToCssVars(mergedSettings)
  const showContactIcons = mergedSettings.showContactIcons

  return (
    <div
      className={`${baseStyles['resume-body']} bg-white text-black w-full mx-auto resume-template-${mergedSettings.template}`}
      style={cssVars}
    >
      {mergedSettings.template === 'swiss-single' && (
        <ResumeSingleColumn data={resumeData} showContactIcons={showContactIcons} />
      )}
      {mergedSettings.template === 'swiss-two-column' && (
        <ResumeTwoColumn data={resumeData} showContactIcons={showContactIcons} />
      )}
      {mergedSettings.template === 'modern' && (
        <ResumeModern data={resumeData} showContactIcons={showContactIcons} />
      )}
      {mergedSettings.template === 'modern-two-column' && (
        <ResumeModernTwoColumn data={resumeData} showContactIcons={showContactIcons} />
      )}
      {mergedSettings.template === 'latex' && (
        <ResumeLatex data={resumeData} showContactIcons={showContactIcons} />
      )}
      {mergedSettings.template === 'clean' && (
        <ResumeClean data={resumeData} showContactIcons={showContactIcons} />
      )}
      {mergedSettings.template === 'vivid' && (
        <ResumeVivid data={resumeData} showContactIcons={showContactIcons} />
      )}
    </div>
  )
}

export default ResumeRenderer
