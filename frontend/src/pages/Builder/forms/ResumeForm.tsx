/**
 * 内容编辑编排 —— 视觉参照 RM builder resume-form(可折叠 section 卡 + 显隐/排序 + 新增自定义模块),
 * 数据直接绑定 v2 ResumeData:模块显隐/顺序写 menuSections,各 section 表单编辑对应字段。
 * 排序:拖拽手柄(dnd-kit,鼠标)+ ↑↓ 按钮(键盘/触屏兜底)双通道,均写 menuSections.order。
 * 模块重命名:仅自定义模块(id 以 custom_ 开头)可改名,内置模块标题只读(产品固定语义)。
 */
import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Pencil, Plus } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

interface SortableSectionProps {
  section: MenuSection
  isFirst: boolean
  isLast: boolean
  isOpen: boolean
  isCustom: boolean
  isRenaming: boolean
  renameValue: string
  iconBtn: string
  onToggleOpen: () => void
  onToggleVisible: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onStartRename: () => void
  onCommitRename: () => void
  onCancelRename: () => void
  onRenameChange: (v: string) => void
  body: React.ReactNode
}

/**
 * 单个可拖拽模块卡:setNodeRef/transform 作用于整卡,但 dnd listeners 只绑在左侧 GripVertical 手柄上,
 * 不吞标题按钮 / 铅笔 / 显隐 / ↑↓ 的点击(dnd-kit 常见坑,手柄化规避)。
 */
const SortableSection: React.FC<SortableSectionProps> = ({
  section,
  isFirst,
  isLast,
  isOpen,
  isCustom,
  isRenaming,
  renameValue,
  iconBtn,
  onToggleOpen,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onRenameChange,
  body,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-black bg-white ${
        isDragging ? 'relative z-10 shadow-[4px_4px_0px_0px_#000000]' : 'shadow-[2px_2px_0px_0px_#000000]'
      } ${section.enabled ? '' : 'opacity-60'}`}
    >
      {/* Section header(RM section-header 形态:拖拽手柄 + 方块 + mono 大写标题 + 操作组) */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          className={`${iconBtn} cursor-grab active:cursor-grabbing touch-none`}
          title="拖拽排序"
          aria-label="拖拽排序"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        {isRenaming ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2 h-2 bg-blue-700 inline-block ml-6"></span>
            <input
              type="text"
              autoFocus
              className="flex-1 h-7 px-2 font-mono text-xs font-bold uppercase tracking-wider border border-black rounded-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onBlur={onCommitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onCommitRename()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  onCancelRename()
                }
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="flex items-center gap-2 flex-1 text-left"
            onClick={onToggleOpen}
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
              <span className="font-mono text-[10px] text-[#878E99] uppercase">已隐藏</span>
            )}
          </button>
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          {isCustom && !isRenaming && (
            <button type="button" className={iconBtn} onClick={onStartRename} title="重命名模块">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            className={iconBtn}
            onClick={onToggleVisible}
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
            onClick={onMoveUp}
            disabled={isFirst}
            title="上移模块"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={onMoveDown}
            disabled={isLast}
            title="下移模块"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {body && <div className="border-t border-black p-3 bg-[#FAFAF8]">{body}</div>}
    </div>
  )
}

export const ResumeForm: React.FC<ResumeFormProps> = ({ data, onChange }) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const sections = [...data.menuSections].sort((a, b) => a.order - b.order)

  // 拖拽手柄需一段位移才激活,避免误吞手柄图标的点击;键盘拖拽走 sortable 坐标
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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

  /** 拖拽结束:按新顺序把所有模块 order 重排为 0,1,2...(整表重赋,不是两两交换) */
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onChange((prev) => {
      const sorted = [...prev.menuSections].sort((a, b) => a.order - b.order)
      const oldIndex = sorted.findIndex((s) => s.id === active.id)
      const newIndex = sorted.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const orderById = new Map(arrayMove(sorted, oldIndex, newIndex).map((s, i) => [s.id, i]))
      return {
        ...prev,
        menuSections: prev.menuSections.map((s) => ({ ...s, order: orderById.get(s.id)! })),
      }
    })
  }

  const startRename = (section: MenuSection) => {
    setRenamingId(section.id)
    setRenameValue(section.title)
  }

  /** 提交重命名:trim 后为空则不写回(恢复原值);只改自定义模块 title */
  const commitRename = () => {
    const id = renamingId
    const name = renameValue.trim()
    setRenamingId(null)
    setRenameValue('')
    if (!id || !name) return
    onChange((prev) => ({
      ...prev,
      menuSections: prev.menuSections.map((s) => (s.id === id ? { ...s, title: name } : s)),
    }))
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map((section, index) => (
            <SortableSection
              key={section.id}
              section={section}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
              isOpen={openIds.has(section.id)}
              isCustom={section.id.startsWith('custom_')}
              isRenaming={renamingId === section.id}
              renameValue={renameValue}
              iconBtn={iconBtn}
              onToggleOpen={() => toggleOpen(section.id)}
              onToggleVisible={() => toggleVisible(section.id)}
              onMoveUp={() => moveSection(section.id, -1)}
              onMoveDown={() => moveSection(section.id, 1)}
              onStartRename={() => startRename(section)}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onRenameChange={setRenameValue}
              body={openIds.has(section.id) ? renderSectionBody(section) : null}
            />
          ))}
        </SortableContext>
      </DndContext>

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
            确定
          </SwissButton>
          <SwissButton variant="outline" size="sm" onClick={() => setAdding(false)}>
            取消
          </SwissButton>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full py-2.5 border border-dashed border-[#878E99] rounded-none font-mono text-xs uppercase tracking-wider text-[#444850] hover:border-black hover:bg-[#F1F2F5] inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          新增模块
        </button>
      )}
    </div>
  )
}

export default ResumeForm
