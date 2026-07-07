/**
 * 专业技能编辑表单 —— 范式同 ExperienceForm,单个 RichField,无条目增删,
 * 数据直接绑定 v2 ResumeData.skillContent(TipTap HTML,RichEditor 原生编辑)。
 */
import React from 'react'
import { RichField } from './shared'

interface SkillsFormProps {
  content: string
  onChange: (html: string) => void
}

export const SkillsForm: React.FC<SkillsFormProps> = ({ content, onChange }) => (
  <RichField label="专业技能" content={content} onChange={onChange} />
)

export default SkillsForm
