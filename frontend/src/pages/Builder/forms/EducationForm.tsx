/**
 * 教育经历编辑表单 —— 范式同 ExperienceForm(ItemCard + SwissField + RichField + AddItemButton),
 * 数据直接绑定 v2 ResumeData.education(Education[]),description 为 TipTap HTML(RichEditor 原生编辑)。
 */
import React from 'react'
import type { Education } from '../../Workspace/v2/types'
import { AddItemButton, ItemCard, RichField, SwissField, moveItem, newItemId } from './shared'

interface EducationFormProps {
  items: Education[]
  onChange: (items: Education[]) => void
}

export const EducationForm: React.FC<EducationFormProps> = ({ items, onChange }) => {
  const update = (index: number, patch: Partial<Education>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const add = () => {
    onChange([
      ...items,
      {
        id: newItemId('edu'),
        school: '',
        degree: '',
        major: '',
        gpa: '',
        startDate: '',
        endDate: '',
        description: '',
      },
    ])
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          title={item.school}
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
              label="学校"
              value={item.school}
              onChange={(v) => update(index, { school: v })}
            />
            <SwissField
              label="学位"
              value={item.degree}
              onChange={(v) => update(index, { degree: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SwissField
              label="专业"
              value={item.major}
              onChange={(v) => update(index, { major: v })}
            />
            <SwissField
              label="GPA"
              value={item.gpa || ''}
              onChange={(v) => update(index, { gpa: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SwissField
              label="开始时间"
              value={item.startDate}
              placeholder="2021.09"
              onChange={(v) => update(index, { startDate: v })}
            />
            <SwissField
              label="结束时间"
              value={item.endDate}
              placeholder="2025.06"
              onChange={(v) => update(index, { endDate: v })}
            />
          </div>
          <RichField
            label="在校经历"
            content={item.description || ''}
            onChange={(html) => update(index, { description: html })}
          />
        </ItemCard>
      ))}
      <AddItemButton label="添加教育" onClick={add} />
    </div>
  )
}

export default EducationForm
