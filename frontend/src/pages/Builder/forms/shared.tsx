/**
 * Builder 编辑表单共享原语 —— Swiss 视觉语言(黑边/直角/mono 标签/硬阴影),
 * 视觉参照 RM builder forms,数据直接绑定我方 v2 ResumeData 字段。
 */
import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import RichEditor from '../../Workspace/v2/shared/RichEditor'

export const INPUT_CLASS =
  'w-full h-9 px-3 font-mono text-sm border border-black rounded-none bg-white ' +
  'placeholder:text-[#878E99] focus:outline-none focus:ring-2 focus:ring-blue-700'

export const SwissLabel: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({
  htmlFor,
  children,
}) => (
  <label
    htmlFor={htmlFor}
    className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[#444850] mb-1"
  >
    {children}
  </label>
)

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/** 单行文本字段(mono 标签 + 直角输入框) */
export const SwissField: React.FC<FieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  className,
}) => (
  <div className={className}>
    <SwissLabel>{label}</SwissLabel>
    <input
      type="text"
      className={INPUT_CLASS}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
)

/** 富文本字段:复用工作台 RichEditor(TipTap,HTML in/out),外包 Swiss 边框 */
export const RichField: React.FC<{
  label: string
  content: string
  onChange: (html: string) => void
}> = ({ label, content, onChange }) => (
  <div>
    <SwissLabel>{label}</SwissLabel>
    <div className="border border-black rounded-none bg-white [&_.ProseMirror]:min-h-[72px]">
      <RichEditor content={content} onChange={onChange} />
    </div>
  </div>
)

interface ItemCardProps {
  title: string
  visible: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onToggleVisible: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  children: React.ReactNode
}

/** 列表条目卡:mono 标题行 + 显隐/上移/下移/删除 + 字段区 */
export const ItemCard: React.FC<ItemCardProps> = ({
  title,
  visible,
  canMoveUp,
  canMoveDown,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onDelete,
  children,
}) => {
  const [confirming, setConfirming] = useState(false)
  const iconBtn =
    'h-7 w-7 inline-flex items-center justify-center rounded-none text-[#444850] hover:bg-[#F1F2F5] disabled:opacity-30 disabled:pointer-events-none'
  return (
    <div className={`border border-black bg-white ${visible ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between border-b border-[#E5E5E0] px-3 py-1.5">
        <span className="font-mono text-xs font-bold uppercase tracking-wider truncate">
          {title || '未命名条目'}
          {!visible && <span className="text-[#878E99] font-normal"> · Hidden</span>}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" className={iconBtn} onClick={onToggleVisible} title={visible ? '隐藏' : '显示'}>
            {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button type="button" className={iconBtn} onClick={onMoveUp} disabled={!canMoveUp} title="上移">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" className={iconBtn} onClick={onMoveDown} disabled={!canMoveDown} title="下移">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {confirming ? (
            <button
              type="button"
              className="h-7 px-2 font-mono text-[10px] uppercase bg-red-600 text-white rounded-none"
              onClick={onDelete}
              onBlur={() => setConfirming(false)}
              title="再点一次确认删除"
            >
              Confirm
            </button>
          ) : (
            <button
              type="button"
              className={`${iconBtn} hover:text-red-600`}
              onClick={() => setConfirming(true)}
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </div>
  )
}

/** 新增条目按钮(虚线框,RM AddSection 形态) */
export const AddItemButton: React.FC<{ label: string; onClick: () => void }> = ({
  label,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full py-2 border border-dashed border-[#878E99] rounded-none font-mono text-xs uppercase tracking-wider text-[#444850] hover:border-black hover:bg-[#F1F2F5] inline-flex items-center justify-center gap-1.5"
  >
    <Plus className="w-3.5 h-3.5" />
    {label}
  </button>
)

/** 生成新条目 id(v2 条目 id 为字符串) */
export function newItemId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** 数组条目通用操作 */
export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
