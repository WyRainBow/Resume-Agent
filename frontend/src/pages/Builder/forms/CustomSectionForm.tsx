/**
 * 自定义模块编辑表单 —— 结构参照 ExperienceForm 范式,
 * 数据直接绑定 v2 ResumeData.customData 的单个模块(CustomItem[]),description 为 TipTap HTML(RichEditor 原生编辑)。
 * 注意 CustomItem.visible 是必填 boolean:新增条目默认 true,显隐切换直接取反。
 */
import React from 'react'
import type { CustomItem } from '../../Workspace/v2/types'
import { AddItemButton, ItemCard, RichField, SwissField, moveItem, newItemId } from './shared'

interface CustomSectionFormProps {
  items: CustomItem[]
  onChange: (items: CustomItem[]) => void
}

export const CustomSectionForm: React.FC<CustomSectionFormProps> = ({ items, onChange }) => {
  const update = (index: number, patch: Partial<CustomItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const add = () => {
    onChange([
      ...items,
      { id: newItemId('custom'), title: '', subtitle: '', dateRange: '', description: '', visible: true },
    ])
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          title={item.title}
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
              label="标题"
              value={item.title}
              onChange={(v) => update(index, { title: v })}
            />
            <SwissField
              label="副标题"
              value={item.subtitle}
              onChange={(v) => update(index, { subtitle: v })}
            />
          </div>
          <SwissField
            label="时间"
            value={item.dateRange}
            onChange={(v) => update(index, { dateRange: v })}
          />
          <RichField
            label="描述"
            content={item.description}
            onChange={(html) => update(index, { description: html })}
          />
        </ItemCard>
      ))}
      <AddItemButton label="添加条目" onClick={add} />
    </div>
  )
}

export default CustomSectionForm
