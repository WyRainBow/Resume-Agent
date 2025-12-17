/**
 * 基本信息编辑面板
 */
import { cn } from '../../../../lib/utils'
import type { BasicInfo } from '../types'
import Field from './Field'

interface BasicPanelProps {
  basic: BasicInfo
  onUpdate: (data: Partial<BasicInfo>) => void
}

const BasicPanel = ({ basic, onUpdate }: BasicPanelProps) => {
  return (
    <div className="space-y-6 p-6">
      {/* 资料 */}
      <div className="space-y-4">
        <h3 className="font-medium text-neutral-900 dark:text-neutral-200">
          基础字段
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="姓名"
              value={basic?.name || ''}
              onChange={(value) => onUpdate({ name: value })}
              placeholder="请输入姓名"
            />
            <Field
              label="职位"
              value={basic?.title || ''}
              onChange={(value) => onUpdate({ title: value })}
              placeholder="请输入目标职位"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="状态"
              value={basic?.employementStatus || ''}
              onChange={(value) => onUpdate({ employementStatus: value })}
              placeholder="如：在职、离职"
            />
            <Field
              label="生日"
              value={basic?.birthDate || ''}
              onChange={(value) => onUpdate({ birthDate: value })}
              type="date"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="邮箱"
              value={basic?.email || ''}
              onChange={(value) => onUpdate({ email: value })}
              placeholder="请输入邮箱"
            />
            <Field
              label="电话"
              value={basic?.phone || ''}
              onChange={(value) => onUpdate({ phone: value })}
              placeholder="请输入电话"
            />
          </div>

          <Field
            label="地址"
            value={basic?.location || ''}
            onChange={(value) => onUpdate({ location: value })}
            placeholder="请输入所在城市"
          />
        </div>
      </div>
    </div>
  )
}

export default BasicPanel


