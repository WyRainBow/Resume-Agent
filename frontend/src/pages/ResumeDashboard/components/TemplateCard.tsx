import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardTitle, CardDescription, CardFooter } from './ui/card'
import { Button } from './ui/button'
import { LayoutGrid } from './Icons'
import { cn } from '@/lib/utils'
import type { TemplateMetadata } from '@/data/templates'
import classicImage from '@/assets/images/templates/classic.png'
import htmlImage from '@/assets/images/templates/html.png'

// 模板图片映射
const templateImages: Record<string, string> = {
  default: classicImage,
  classic: classicImage,
  'html-classic': htmlImage,
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
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.98 }}
      className="relative"
    >
      <Card
        className={cn(
          "group border-2 transition-all duration-300 h-[440px] flex flex-col",
          "border-gray-200 dark:border-gray-700",
          "hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/10",
          "dark:hover:border-blue-500 dark:hover:shadow-blue-900/30"
        )}
      >
        {/* 顶部装饰 */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        <CardContent className="relative flex-1 pt-4 pb-2 text-center flex flex-col items-center min-w-0 overflow-hidden">
          {/* 模板预览图 */}
          {imageSrc ? (
            <div className="mb-4 w-full h-[260px] rounded-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-2 border-gray-200 dark:border-gray-700 relative flex-shrink-0 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-all duration-300">
              <img
                src={imageSrc}
                alt={template.name}
                className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
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
              className="mb-4 p-6 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex-shrink-0 group-hover:from-blue-200 group-hover:to-indigo-200 dark:group-hover:from-blue-800/50 dark:group-hover:to-indigo-800/50 transition-all duration-300"
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.5 }}
            >
              <LayoutGrid className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            </motion.div>
          )}
          
          <div className="flex-shrink-0 flex flex-col justify-start w-full min-w-0 px-4">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg font-bold line-clamp-1 text-gray-900 dark:text-gray-100 w-full min-w-0">
                {template.name}
              </CardTitle>
            </div>
            <CardDescription className="text-sm text-gray-600 dark:text-gray-400 w-full min-w-0 line-clamp-2 break-words leading-relaxed">
              {template.description}
            </CardDescription>
            {template.tags && template.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 justify-start w-full min-w-0">
                {template.tags.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 whitespace-nowrap flex-shrink-0 border border-blue-200 dark:border-blue-800/50"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-3 pb-4 px-4 flex-shrink-0 border-t-2 border-gray-100 dark:border-gray-800">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="w-full"
          >
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
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

