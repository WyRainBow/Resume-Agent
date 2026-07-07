/**
 * 荣誉奖项编辑表单 —— 范式同 ExperienceForm(ItemCard + SwissField + AddItemButton),
 * 数据直接绑定 v2 ResumeData.awards(Award[]),description 是纯文本字符串,用 SwissField 单行编辑(非富文本)。
 */
import React from 'react'
import type { Award } from '../../Workspace/v2/types'
import { AddItemButton, ItemCard, SwissField, moveItem, newItemId } from './shared'

interface AwardsFormProps {
  items: Award[]
  onChange: (items: Award[]) => void
}

export const AwardsForm: React.FC<AwardsFormProps> = ({ items, onChange }) => {
  const update = (index: number, patch: Partial<Award>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const add = () => {
    onChange([
      ...items,
      { id: newItemId('award'), title: '', issuer: '', date: '', description: '' },
    ])
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          title={item.title}
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
              label="名称"
              value={item.title}
              onChange={(v) => update(index, { title: v })}
            />
            <SwissField
              label="颁发方"
              value={item.issuer || ''}
              onChange={(v) => update(index, { issuer: v })}
            />
          </div>
          <SwissField
            label="日期"
            value={item.date || ''}
            placeholder="2023.06"
            onChange={(v) => update(index, { date: v })}
          />
          <SwissField
            label="说明"
            value={item.description || ''}
            onChange={(v) => update(index, { description: v })}
          />
        </ItemCard>
      ))}
      <AddItemButton label="添加奖项" onClick={add} />
    </div>
  )
}

export default AwardsForm
