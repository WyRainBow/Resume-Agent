/**
 * 自我评价编辑表单 —— 范式同 ExperienceForm,单个 RichField,无条目增删,
 * 数据直接绑定 v2 ResumeData.selfEvaluation(TipTap HTML,RichEditor 原生编辑)。
 */
import React from 'react'
import { RichField } from './shared'

interface SummaryFormProps {
  content: string
  onChange: (html: string) => void
}

export const SummaryForm: React.FC<SummaryFormProps> = ({ content, onChange }) => (
  <RichField label="自我评价" content={content} onChange={onChange} />
)

export default SummaryForm
