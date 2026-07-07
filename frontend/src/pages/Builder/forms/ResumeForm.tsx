/**
 * 内容编辑编排 —— 视觉参照 RM builder resume-form(可折叠 section 卡 + 显隐/排序 + 新增自定义模块),
 * 数据直接绑定 v2 ResumeData:模块显隐/顺序写 menuSections,各 section 表单编辑对应字段。
 * 与 RM 差异:排序用 ↑↓(首版不引 dnd-kit,交接文档允许);模块重命名暂不支持(P1-1 备注)。
 */
import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus } from 'lucide-react'
import type { MenuSection, ResumeData } from '../../Workspace/v2/types'
import { PersonalInfoForm } from './PersonalInfoForm'
import { ExperienceForm } from './ExperienceForm'
import { EducationForm } from './EducationForm'
import { ProjectsForm } from './ProjectsForm'
import { OpenSourceForm } from './OpenSourceForm'
import { SkillsForm } from './SkillsForm'
import { AwardsForm } from './AwardsForm'
import { SummaryForm } from './SummaryForm'
import { CustomSectionForm } from './CustomSectionForm'
import { INPUT_CLASS, newItemId } from './shared'
import { SwissButton } from '../components/SwissButton'

export type UpdateResume = (updater: (prev: ResumeData) => ResumeData) => void

interface ResumeFormProps {
  data: ResumeData
  onChange: UpdateResume
}

export const ResumeForm: React.FC<ResumeFormProps> = ({ data, onChange }) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')

  const sections = [...data.menuSections].sort((a, b) => a.order - b.order)

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleVisible = (id: string) => {
    onChange((prev) => ({
      ...prev,
      menuSections: prev.menuSections.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    }))
  }

  /** 与排序后的相邻模块交换 order 值 */
  const moveSection = (id: string, dir: -1 | 1) => {
    onChange((prev) => {
      const sorted = [...prev.menuSections].sort((a, b) => a.order - b.order)
      const index = sorted.findIndex((s) => s.id === id)
      const target = index + dir
      if (index === -1 || target < 0 || target >= sorted.length) return prev
      const a = sorted[index]
      const b = sorted[target]
      return {
        ...prev,
        menuSections: prev.menuSections.map((s) =>
          s.id === a.id ? { ...s, order: b.order } : s.id === b.id ? { ...s, order: a.order } : s
        ),
      }
    })
  }

  const addCustomSection = () => {
    const name = newSectionName.trim()
    if (!name) return
    const id = newItemId('custom')
    onChange((prev) => ({
      ...prev,
      menuSections: [
        ...prev.menuSections,
        {
          id,
          title: name,
          icon: '📌',
          enabled: true,
          order: Math.max(0, ...prev.menuSections.map((s) => s.order)) + 1,
        },
      ],
      customData: { ...prev.customData, [id]: [] },
    }))
    setNewSectionName('')
    setAdding(false)
    setOpenIds((prev) => new Set(prev).add(id))
  }

  const renderSectionBody = (section: MenuSection) => {
    switch (section.id) {
      case 'basic':
        return (
          <PersonalInfoForm
            basic={data.basic}
            onChange={(patch) =>
              onChange((prev) => ({ ...prev, basic: { ...prev.basic, ...patch } }))
            }
          />
        )
      case 'education':
        return (
          <EducationForm
            items={data.education}
            onChange={(items) => onChange((prev) => ({ ...prev, education: items }))}
          />
        )
      case 'experience':
        return (
          <ExperienceForm
            items={data.experience}
            onChange={(items) => onChange((prev) => ({ ...prev, experience: items }))}
          />
        )
      case 'projects':
        return (
          <ProjectsForm
            items={data.projects}
            onChange={(items) => onChange((prev) => ({ ...prev, projects: items }))}
          />
        )
      case 'openSource':
        return (
          <OpenSourceForm
            items={data.openSource}
            onChange={(items) => onChange((prev) => ({ ...prev, openSource: items }))}
          />
        )
      case 'skills':
        return (
          <SkillsForm
            content={data.skillContent}
            onChange={(html) => onChange((prev) => ({ ...prev, skillContent: html }))}
          />
        )
      case 'awards':
        return (
          <AwardsForm
            items={data.awards}
            onChange={(items) => onChange((prev) => ({ ...prev, awards: items }))}
          />
        )
      case 'selfEvaluation':
        return (
          <SummaryForm
            content={data.selfEvaluation}
            onChange={(html) => onChange((prev) => ({ ...prev, selfEvaluation: html }))}
          />
        )
      default:
        // 自定义模块(custom_*):customData[id] 条目列表
        return (
          <CustomSectionForm
            items={data.customData[section.id] || []}
            onChange={(items) =>
              onChange((prev) => ({
                ...prev,
                customData: { ...prev.customData, [section.id]: items },
              }))
            }
          />
        )
    }
  }

  const iconBtn =
    'h-7 w-7 inline-flex items-center justify-center rounded-none text-[#444850] hover:bg-[#F1F2F5] disabled:opacity-30 disabled:pointer-events-none'

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const isOpen = openIds.has(section.id)
        return (
          <div
            key={section.id}
            className={`border border-black bg-white shadow-[2px_2px_0px_0px_#000000] ${
              section.enabled ? '' : 'opacity-60'
            }`}
          >
            {/* Section header(RM section-header 形态:方块 + mono 大写标题 + 操作组) */}
            <div className="flex items-center justify-between px-3 py-2">
              <button
                type="button"
                className="flex items-center gap-2 flex-1 text-left"
                onClick={() => toggleOpen(section.id)}
              >
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#878E99]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#878E99]" />
                )}
                <span className="w-2 h-2 bg-blue-700 inline-block"></span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider">
                  {section.title}
                </span>
                {!section.enabled && (
                  <span className="font-mono text-[10px] text-[#878E99] uppercase">Hidden</span>
                )}
              </button>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => toggleVisible(section.id)}
                  title={section.enabled ? '隐藏模块' : '显示模块'}
                >
                  {section.enabled ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => moveSection(section.id, -1)}
                  disabled={index === 0}
                  title="上移模块"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => moveSection(section.id, 1)}
                  disabled={index === sections.length - 1}
                  title="下移模块"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {isOpen && <div className="border-t border-black p-3 bg-[#FAFAF8]">{renderSectionBody(section)}</div>}
          </div>
        )
      })}

      {/* 新增自定义模块 */}
      {adding ? (
        <div className="border border-black bg-white p-3 shadow-[2px_2px_0px_0px_#000000] flex items-center gap-2">
          <input
            type="text"
            autoFocus
            className={INPUT_CLASS}
            placeholder="模块名称(如:竞赛科研)"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCustomSection()
              if (e.key === 'Escape') setAdding(false)
            }}
          />
          <SwissButton size="sm" onClick={addCustomSection} disabled={!newSectionName.trim()}>
            Add
          </SwissButton>
          <SwissButton variant="outline" size="sm" onClick={() => setAdding(false)}>
            Cancel
          </SwissButton>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full py-2.5 border border-dashed border-[#878E99] rounded-none font-mono text-xs uppercase tracking-wider text-[#444850] hover:border-black hover:bg-[#F1F2F5] inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Section
        </button>
      )}
    </div>
  )
}

export default ResumeForm
