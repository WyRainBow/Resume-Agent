/**
 * 项目经历编辑表单 —— 结构参照 ExperienceForm 范式,
 * 数据直接绑定 v2 ResumeData.projects(Project[]),description 为 TipTap HTML(RichEditor 原生编辑)。
 * 注意 Project.visible 是必填 boolean:新增条目默认 true,显隐切换直接取反。
 */
import React from 'react'
import type { Project } from '../../Workspace/v2/types'
import { AddItemButton, ItemCard, RichField, SwissField, moveItem, newItemId } from './shared'

interface ProjectsFormProps {
  items: Project[]
  onChange: (items: Project[]) => void
}

export const ProjectsForm: React.FC<ProjectsFormProps> = ({ items, onChange }) => {
  const update = (index: number, patch: Partial<Project>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const add = () => {
    onChange([
      ...items,
      { id: newItemId('proj'), name: '', role: '', date: '', description: '', visible: true },
    ])
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          title={item.name}
          visible={item.visible}
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
          onToggleVisible={() => update(index, { visible: !item.visible })}
          onMoveUp={() => onChange(moveItem(items, index, -1))}
          onMoveDown={() => onChange(moveItem(items, index, 1))}
          onDelete={() => onChange(items.filter((_, i) => i !== index))}
        >
          <div className="grid grid-cols-2 gap-3">
            <SwissField
              label="项目名称"
              value={item.name}
              onChange={(v) => update(index, { name: v })}
            />
            <SwissField
              label="角色"
              value={item.role}
              onChange={(v) => update(index, { role: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SwissField
              label="时间"
              value={item.date}
              placeholder="2024.03 - 2024.05"
              onChange={(v) => update(index, { date: v })}
            />
            <SwissField
              label="链接"
              value={item.link || ''}
              onChange={(v) => update(index, { link: v })}
            />
          </div>
          <RichField
            label="项目描述"
            content={item.description}
            onChange={(html) => update(index, { description: html })}
          />
        </ItemCard>
      ))}
      <AddItemButton label="Add Project" onClick={add} />
    </div>
  )
}

export default ProjectsForm
