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
 * 参考图片中的模板样式
 */
export const TEMPLATE_METADATA: TemplateMetadata[] = [
  {
    id: 'default',
    name: '经典模板',
    description: 'LATEX简历模板：适用于程序员大多数求职场景。包含基本信息、教育经历、实习经历、项目经历等完整模块。',
    category: '通用',
    tags: ['标准', '通用', '经典'],
    thumbnail: '/templates/classic.png'
  },
  {
    id: 'general',
    name: '通用模板',
    description: '简洁实用的简历模板，适合大多数行业和职位。采用经典两栏布局，突出关键信息。',
    category: '通用',
    tags: ['标准', '通用', '简洁'],
    thumbnail: '/templates/general.png'
  },
  {
    id: 'custom',
    name: '自定义模板',
    description: '个性化简历模板，带有蓝色头部和圆形头像。适合需要突出个人形象的求职场景。',
    category: '个性化',
    tags: ['个性化', '现代', '蓝色'],
    thumbnail: '/templates/custom.png'
  },
  {
    id: 'elegant-blue',
    name: '雅蓝模板',
    description: '优雅的蓝色主题简历模板，专业且现代。适合产品经理、设计师等创意类职位。',
    category: '设计',
    tags: ['优雅', '蓝色', '现代'],
    thumbnail: '/templates/elegant-blue.png'
  },
  {
    id: 'modern',
    name: '现代模板',
    description: '现代风格简历模板，左侧蓝色侧边栏展示技能和证书，右侧展示主要经历。适合技术岗位。',
    category: '技术',
    tags: ['现代', '技术', '侧边栏'],
    thumbnail: '/templates/modern.png'
  },
  {
    id: 'fresh',
    name: '清新模板',
    description: '清新简洁的简历模板，采用现代两栏布局。适合应届毕业生和初级职位申请。',
    category: '通用',
    tags: ['清新', '简洁', '现代'],
    thumbnail: '/templates/fresh.png'
  },
  {
    id: 'professional',
    name: '专业模板',
    description: '专业商务风格简历模板，适合金融、咨询等传统行业。强调专业性和可信度。',
    category: '商务',
    tags: ['专业', '商务', '传统'],
    thumbnail: '/templates/professional.png'
  },
  {
    id: 'creative',
    name: '创意模板',
    description: '创意设计风格简历模板，适合设计师、艺术家等创意类职位。突出视觉表现力。',
    category: '设计',
    tags: ['创意', '设计', '视觉'],
    thumbnail: '/templates/creative.png'
  },
  {
    id: 'minimalist',
    name: '极简模板',
    description: '极简风格简历模板，去除多余装饰，专注于内容本身。适合追求简洁的用户。',
    category: '通用',
    tags: ['极简', '简洁', '内容'],
    thumbnail: '/templates/minimalist.png'
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

