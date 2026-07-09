import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardTitle, CardDescription, CardFooter } from './ui/card'
import { Button } from './ui/button'
import { LayoutGrid } from './Icons'
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

interface TemplateCardProps {
  template: TemplateMetadata
  onSelect: (templateId: string) => void
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ 
  template, 
  onSelect 
}) => {
  // 获取模板图片，优先使用映射，否则使用 thumbnail
  const imageSrc = templateImages[template.id] || template.thumbnail

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: 2, x: 2 }}
      whileTap={{ scale: 0.98 }}
      className="relative group"
    >
      <Card
        className={cn(
          "border border-black transition-[box-shadow,transform] duration-100 h-[440px] flex flex-col",
          "group-hover:shadow-none"
        )}
      >
        {/* 顶部装饰 */}
        <div className="h-1 bg-[#4285F4] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        <CardContent className="relative flex-1 pt-4 pb-2 text-center flex flex-col items-center min-w-0 overflow-hidden">
          {/* 模板预览图 */}
          {imageSrc ? (
            <div className="mb-4 w-full h-[260px] rounded-none overflow-hidden bg-[#E5E5E0] border-2 border-black relative flex-shrink-0 transition-all duration-300">
              <img
                src={imageSrc}
                alt={template.name}
                className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = '/product-preview.png'
                  console.error('Failed to load template thumbnail:', imageSrc)
                }}
                onLoad={() => {
                  console.log('Template thumbnail loaded:', imageSrc)
                }}
              />
            </div>
          ) : (
            <motion.div
              className="mb-4 p-6 rounded-none bg-[#4285F4] text-white border-2 border-black shadow-[2px_2px_0px_0px_#000000] flex-shrink-0 transition-all duration-300"
              whileHover={{ x: 1, y: 1 }}
              transition={{ duration: 0.2 }}
            >
              <LayoutGrid className="h-12 w-12 text-white" />
            </motion.div>
          )}
          
          <div className="flex-shrink-0 flex flex-col justify-start w-full min-w-0 px-4">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg font-serif font-bold line-clamp-1 text-black w-full min-w-0">
                {template.name}
              </CardTitle>
            </div>
            <CardDescription className="text-sm font-mono text-[#6B7280] w-full min-w-0 line-clamp-2 break-words leading-relaxed">
              {template.description}
            </CardDescription>
            {template.tags && template.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 justify-start w-full min-w-0">
                {template.tags.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 text-xs font-mono uppercase tracking-wide rounded-none bg-[#E5E5E0] text-[#3367D6] whitespace-nowrap flex-shrink-0 border border-black"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-3 pb-4 px-4 flex-shrink-0 border-t border-black">
          <div className="w-full">
            <Button
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(template.id);
              }}
            >
              使用此模板
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

