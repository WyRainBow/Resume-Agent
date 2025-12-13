/**
 * 编辑覆盖层组件
 * 显示所有已编辑和正在编辑的文本
 */

import React from 'react'
import type { EditItem } from './types'
import { EditableText } from './EditableText'
import { editorStyles } from './styles'

interface EditOverlayProps {
  edits: EditItem[]
  onUpdate: (id: string, newText: string) => void
  onFinish: (id: string) => void
  onCancel: (id: string) => void
  onReEdit: (id: string) => void  // 重新进入编辑模式
}

export const EditOverlay: React.FC<EditOverlayProps> = ({
  edits,
  onUpdate,
  onFinish,
  onCancel,
  onReEdit,
}) => {
  return (
    <div style={editorStyles.editOverlay}>
      {edits.map(edit => (
        <EditableText
          key={edit.id}
          edit={edit}
          onUpdate={(newText) => onUpdate(edit.id, newText)}
          onFinish={() => onFinish(edit.id)}
          onCancel={() => onCancel(edit.id)}
          onReEdit={() => onReEdit(edit.id)}
        />
      ))}
    </div>
  )
}
