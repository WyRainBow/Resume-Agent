import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { TemplateMetadata } from '@/data/templates'
// COS 图片 URL
const COS_BASE_URL = 'https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com'

// 模板图片映射
const templateImages: Record<string, string> = {
  default: `${COS_BASE_URL}/classic.png`,
  classic: `${COS_BASE_URL}/classic.png`,
  'html-classic': `${COS_BASE_URL}/html.png`,
}

interface SimpleTemplateCardProps {
  template: TemplateMetadata
  onSelect: (templateId: string) => void
}

/**
 * 简洁版模板卡片
 * 只显示图片预览和底部标签，用于样式对比
 */
export const SimpleTemplateCard: React.FC<SimpleTemplateCardProps> = ({ 
  template, 
  onSelect 
}) => {
  // 获取模板图片，优先使用映射，否则使用 thumbnail
  const imageSrc = templateImages[template.id] || template.thumbnail
  
  // 获取主要标签（通常是第一个标签，如"经典"、"通用"等）
  const mainTag = template.tags && template.tags.length > 0 ? template.tags[0] : '模板'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative cursor-pointer"
      onClick={() => onSelect(template.id)}
    >
      <div
        className={cn(
          "group bg-white dark:bg-gray-800 rounded-lg overflow-hidden",
          "border-2 border-gray-200 dark:border-gray-700",
          "hover:border-blue-400 hover:shadow-lg transition-all duration-300",
          "dark:hover:border-blue-500"
        )}
      >
        {/* 模板预览图 */}
        {imageSrc ? (
          <div className="w-full aspect-[3/4] overflow-hidden">
            <img
              src={imageSrc}
              alt={template.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = '/product-preview.png'
                console.error('Failed to load template thumbnail:', imageSrc)
              }}
            />
          </div>
        ) : (
          <div className="w-full aspect-[3/4] bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
            <div className="text-4xl">📄</div>
          </div>
        )}
        
        {/* 底部标签 */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <p className="text-center text-sm font-medium text-gray-700 dark:text-gray-300">
            {mainTag}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

