import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Edit3, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TemplateSelectorProps {
  onSelect: (templateId: string) => void
  onEdit: () => void
  onMore: () => void
}

// 模板选择器专用的模板列表（不影响模板市场页面）
const TEMPLATE_SELECTOR_TEMPLATES: Array<{ id: string; name: string; thumbnail: string; type: 'latex' | 'html' }> = [
  { id: 'default', name: '经典', thumbnail: '/templates/PNG/classic.png', type: 'latex' },
  { id: 'html-classic', name: '通用', thumbnail: '/templates/PNG/classic.png', type: 'html' }
]

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({ onSelect, onEdit, onMore }) => {
  const templates = TEMPLATE_SELECTOR_TEMPLATES
  const [selectedId, setSelectedId] = useState<string>('default')

  const handleTemplateClick = (id: string) => {
    setSelectedId(id)
    onSelect(id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 w-full max-w-2xl"
    >
      {/* 头部引导 */}
      <div className="mb-8">
        <h3 className="text-[19px] font-bold text-gray-900 mb-2">简历生成成功！选择一个好看的模板吧</h3>
      </div>

      {/* 模板网格 */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {templates.map((template) => {
          const isSelected = selectedId === template.id
          return (
            <div key={template.id} className="flex flex-col items-center gap-2">
              <button
                onClick={() => handleTemplateClick(template.id)}
                className={cn(
                  "relative aspect-[3/4] w-full rounded-lg overflow-hidden border-2 transition-all group",
                  isSelected 
                    ? "border-blue-600 shadow-lg shadow-blue-500/10" 
                    : "border-gray-100 hover:border-blue-300"
                )}
              >
                <img 
                  src={template.thumbnail} 
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
                
                {/* 选中遮罩 */}
                {isSelected && (
                  <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
                      <Check className="w-5 h-5 text-white stroke-[3]" />
                    </div>
                  </div>
                )}
              </button>
              <span className={cn(
                "text-sm font-medium transition-colors",
                isSelected ? "text-blue-600" : "text-gray-500"
              )}>
                {template.name}
              </span>
            </div>
          )
        })}
      </div>

      {/* 底部按钮 */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMore}
          className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl font-bold text-[16px] transition-all flex items-center justify-center gap-2"
        >
          <LayoutGrid className="w-4 h-4" />
          更多模板
        </button>
        <button
          onClick={onEdit}
          className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
        >
          <Edit3 className="w-4 h-4" />
          编辑简历
        </button>
      </div>
    </motion.div>
  )
}

