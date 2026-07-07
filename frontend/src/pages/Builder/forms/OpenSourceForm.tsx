/**
 * 开源经历编辑表单 —— 结构参照 ExperienceForm 范式,
 * 数据直接绑定 v2 ResumeData.openSource(OpenSource[]),description 为 TipTap HTML(RichEditor 原生编辑)。
 * repo/role/date 为可选字段,绑定时回退空串;visible 可选,与范式同款按 !== false 判定。
 */
import React from 'react'
import type { OpenSource } from '../../Workspace/v2/types'
import { AddItemButton, ItemCard, RichField, SwissField, moveItem, newItemId } from './shared'

interface OpenSourceFormProps {
  items: OpenSource[]
  onChange: (items: OpenSource[]) => void
}

export const OpenSourceForm: React.FC<OpenSourceFormProps> = ({ items, onChange }) => {
  const update = (index: number, patch: Partial<OpenSource>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const add = () => {
    onChange([...items, { id: newItemId('os'), name: '', description: '' }])
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          title={item.name}
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
              value={item.name}
              onChange={(v) => update(index, { name: v })}
            />
            <SwissField
              label="仓库"
              value={item.repo || ''}
              placeholder="github.com/xxx/yyy"
              onChange={(v) => update(index, { repo: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SwissField
              label="角色"
              value={item.role || ''}
              onChange={(v) => update(index, { role: v })}
            />
            <SwissField
              label="时间"
              value={item.date || ''}
              onChange={(v) => update(index, { date: v })}
            />
          </div>
          <RichField
            label="描述"
            content={item.description}
            onChange={(html) => update(index, { description: html })}
          />
        </ItemCard>
      ))}
      <AddItemButton label="Add Open Source" onClick={add} />
    </div>
  )
}

export default OpenSourceForm
