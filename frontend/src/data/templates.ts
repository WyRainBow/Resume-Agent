/**
 * 简历模板数据管理
 * 
 * 定义所有可用的简历模板及其元数据
 */
import type { ResumeData } from '../pages/Workspace/v2/types'
import { DEFAULT_RESUME_TEMPLATE } from './defaultTemplate'

export interface TemplateMetadata {
  id: string
  name: string
  description: string
  thumbnail?: string // 预览图 URL（未来可扩展）
  category?: string // 分类（未来可扩展）
  tags?: string[] // 标签（未来可扩展）
}

/**
 * 模板元数据列表
 */
export const TEMPLATE_METADATA: TemplateMetadata[] = [
  {
    id: 'default',
    name: '经典模板',
    description: 'LATEX简历模板：适用于程序员大多数求职场景。包含基本信息、教育经历、实习经历、项目经历等完整模块。',
    category: '通用',
    tags: ['标准', '通用', '经典']
  }
]

/**
 * 根据模板 ID 获取模板数据
 */
export function getTemplateById(templateId: string): ResumeData | null {
  switch (templateId) {
    case 'default':
      return structuredClone(DEFAULT_RESUME_TEMPLATE)
    default:
      return null
  }
}

/**
 * 获取所有模板的元数据
 */
export function getAllTemplates(): TemplateMetadata[] {
  return TEMPLATE_METADATA
}

/**
 * 根据模板 ID 获取模板元数据
 */
export function getTemplateMetadata(templateId: string): TemplateMetadata | null {
  return TEMPLATE_METADATA.find(t => t.id === templateId) || null
}

