/**
 * 实习/工作经历编辑表单 —— 视觉参照 RM builder experience-form,
 * 数据直接绑定 v2 ResumeData.experience(Experience[]),details 为 TipTap HTML(RichEditor 原生编辑)。
 * 本文件是其余各 section 表单的范式:ItemCard 条目卡 + SwissField 字段 + RichField 描述 + AddItemButton。
 */
import React from 'react'
import type { Experience } from '../../Workspace/v2/types'
import { AddItemButton, ItemCard, RichField, SwissField, moveItem, newItemId } from './shared'

interface ExperienceFormProps {
  items: Experience[]
  onChange: (items: Experience[]) => void
}

export const ExperienceForm: React.FC<ExperienceFormProps> = ({ items, onChange }) => {
  const update = (index: number, patch: Partial<Experience>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const add = () => {
    onChange([
      ...items,
      { id: newItemId('exp'), company: '', position: '', date: '', details: '' },
    ])
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          title={item.company || item.position}
          visible={item.visible !== false}
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
          onToggleVisible={() => update(index, { visible: item.visible === false })}
          onMoveUp={() => onChange(moveItem(items, index, -1))}
          onMoveDown={() => onChange(moveItem(items, index, 1))}
          onDelete={() => onChange(items.filter((_, i) => i !== index))}
        >
          <div className="grid grid-cols-2 gap-3">
            <SwissField
              label="公司"
              value={item.company}
              onChange={(v) => update(index, { company: v })}
            />
            <SwissField
              label="职位"
              value={item.position}
              onChange={(v) => update(index, { position: v })}
            />
          </div>
          <SwissField
            label="时间"
            value={item.date}
            placeholder="2024.06 - 2024.09"
            onChange={(v) => update(index, { date: v })}
          />
          <RichField
            label="工作内容"
            content={item.details}
            onChange={(html) => update(index, { details: html })}
          />
        </ItemCard>
      ))}
      <AddItemButton label="添加经历" onClick={add} />
    </div>
  )
}

export default ExperienceForm
