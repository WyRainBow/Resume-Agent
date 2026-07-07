/**
 * 基本信息编辑表单 —— 范式同 ExperienceForm(SwissField 两列 grid),无条目增删,
 * 数据直接绑定 v2 ResumeData.basic(BasicInfo),以 Partial<BasicInfo> patch 回写。
 * 照片、自定义字段、字段顺序等高级项不在 Builder 编辑范围(仍在原工作台编辑)。
 */
import React from 'react'
import type { BasicInfo } from '../../Workspace/v2/types'
import { SwissField } from './shared'

interface PersonalInfoFormProps {
  basic: BasicInfo
  onChange: (patch: Partial<BasicInfo>) => void
}

export const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({ basic, onChange }) => (
  <div className="grid grid-cols-2 gap-3">
    <SwissField
      label="姓名"
      value={basic.name}
      onChange={(v) => onChange({ name: v })}
    />
    <SwissField
      label="职位"
      value={basic.title}
      onChange={(v) => onChange({ title: v })}
    />
    <SwissField
      label="邮箱"
      value={basic.email}
      onChange={(v) => onChange({ email: v })}
    />
    <SwissField
      label="电话"
      value={basic.phone}
      onChange={(v) => onChange({ phone: v })}
    />
    <SwissField
      label="所在地"
      value={basic.location}
      onChange={(v) => onChange({ location: v })}
    />
    <SwissField
      label="博客·GitHub"
      value={basic.blog || ''}
      onChange={(v) => onChange({ blog: v })}
    />
  </div>
)

export default PersonalInfoForm
