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
      whileHover={{ y: 2, x: 2 }}
      whileTap={{ scale: 0.98 }}
      className="relative cursor-pointer group"
      onClick={() => onSelect(template.id)}
    >
      <div
        className={cn(
          "bg-[#F0F0E8] fresh:bg-slate-50 rounded-none fresh:rounded-lg overflow-hidden",
          "border border-black fresh:border-slate-200 shadow-[4px_4px_0px_0px_#000000] fresh:shadow-md",
          "group-hover:shadow-none transition-[box-shadow,transform] duration-100"
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
          <div className="w-full aspect-[3/4] bg-[#E5E5E0] flex items-center justify-center">
            <div className="text-4xl">📄</div>
          </div>
        )}
        
        {/* 底部标签 */}
        <div className="px-4 py-2 bg-[#E5E5E0] border-t border-black fresh:border-slate-200">
          <p className="text-center text-sm font-mono uppercase tracking-wide text-black">
            {mainTag}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

