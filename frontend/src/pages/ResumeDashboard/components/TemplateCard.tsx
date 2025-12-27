import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardTitle, CardDescription, CardFooter } from './ui/card'
import { Button } from './ui/button'
import { LayoutGrid } from './Icons'
import { cn } from '@/lib/utils'
import type { TemplateMetadata } from '@/data/templates'
import classicImage from '@/assets/images/templates/classic.png'

// 模板图片映射
const templateImages: Record<string, string> = {
  default: classicImage,
  classic: classicImage,
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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative"
    >
      <Card
        className={cn(
          "group border transition-all duration-200 h-[420px] flex flex-col overflow-hidden",
          "hover:border-gray-400 hover:bg-gray-50",
          "dark:hover:border-primary dark:hover:bg-primary/10"
        )}
      >
        <CardContent className="relative flex-1 pt-4 pb-2 text-center flex flex-col items-center min-w-0">
          {/* 模板预览图 */}
          {imageSrc ? (
            <div className="mb-3 w-full h-64 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 relative flex-shrink-0">
              <img
                src={imageSrc}
                alt={template.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  // 如果图片加载失败，显示占位符
                  const target = e.target as HTMLImageElement
                  target.src = '/templates/placeholder.svg'
                  console.error('Failed to load template thumbnail:', imageSrc)
                }}
                onLoad={() => {
                  console.log('Template thumbnail loaded:', imageSrc)
                }}
              />
            </div>
          ) : (
            <motion.div
              className="mb-4 p-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex-shrink-0"
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.5 }}
            >
              <LayoutGrid className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </motion.div>
          )}
          <CardTitle className="text-lg font-semibold line-clamp-1 text-gray-900 dark:text-gray-100 px-4 w-full min-w-0">
            {template.name}
          </CardTitle>
          <CardDescription className="mt-2 text-xs text-gray-600 dark:text-gray-400 px-4 line-clamp-3 w-full min-w-0 break-words">
            {template.description}
          </CardDescription>
          {template.tags && template.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 justify-center px-4 w-full min-w-0">
              {template.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 whitespace-nowrap"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-2 pb-4 px-4 flex-shrink-0">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="w-full"
          >
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(template.id);
              }}
            >
              使用此模板
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

