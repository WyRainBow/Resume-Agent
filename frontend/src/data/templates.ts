/**
 * 简历模板数据管理
 * 
 * 定义所有可用的简历模板及其元数据
 */
import type { ResumeData } from '../pages/Workspace/v2/types'
import { DEFAULT_RESUME_TEMPLATE } from './defaultTemplate'

export type TemplateType = 'latex' | 'html'

export interface TemplateMetadata {
  id: string
  name: string
  description: string
  type: TemplateType // 模板类型：latex 或 html
  thumbnail?: string // 预览图 URL（未来可扩展）
  category?: string // 分类（未来可扩展）
  tags?: string[] // 标签（未来可扩展）
}

/**
 * 模板元数据列表
 * 包含 LaTeX 和 HTML 模板
 */
export const TEMPLATE_METADATA: TemplateMetadata[] = [
  {
    id: 'default',
    name: '经典模板（LaTeX）',
    description: 'LATEX简历模板：适用于程序员大多数求职场景',
    type: 'latex',
    category: '通用',
    tags: ['标准', '通用', '经典', '高质量'],
    thumbnail: '/templates/PNG/classic.png'
  },
  {
    id: 'html-classic',
    name: '经典模板（HTML）',
    description: 'HTML实时编辑模板：支持实时预览',
    type: 'html',
    category: '通用',
    tags: ['实时预览', '快速编辑', '经典'],
    thumbnail: '/templates/PNG/classic.png'
  }
]

/**
 * 根据模板 ID 获取模板数据
 */
export function getTemplateById(templateId: string): ResumeData | null {
  // 目前所有模板都使用默认模板数据
  // 未来可以根据 templateId 返回不同的模板结构
  const template = structuredClone(DEFAULT_RESUME_TEMPLATE)
  template.templateId = templateId
  return template
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

