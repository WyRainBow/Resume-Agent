/**
 * 布局模块项组件
 * 支持拖拽排序、显示/隐藏；默认模块不显示删除按钮（仅支持隐藏），自定义模块可删除
 */
import { motion, Reorder, useDragControls } from 'framer-motion'
import { Eye, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { MenuSection } from '../types'

/** 默认模块 id：不允许删除，仅支持隐藏 */
const DEFAULT_SECTION_IDS = new Set([
  'education',
  'experience',
  'projects',
  'openSource',
  'skills',
  'awards',
])

interface LayoutItemProps {
  item: MenuSection
  isBasic?: boolean
  activeSection: string
  setActiveSection: (id: string) => void
  toggleSectionVisibility: (id: string) => void
  updateMenuSections: (sections: MenuSection[]) => void
  menuSections: MenuSection[]
}

const LayoutItem = ({
  item,
  isBasic = false,
  activeSection,
  setActiveSection,
  toggleSectionVisibility,
  updateMenuSections,
  menuSections
}: LayoutItemProps) => {
  const dragControls = useDragControls()

  // 基本信息模块（不可拖拽、不可删除）
  if (isBasic) {
    return (
      <div
        className={cn(
          'rounded-lg group border mb-2 hover:border-primary cursor-pointer',
          'hover:bg-gray-50 bg-white border-gray-100',
          'dark:hover:bg-neutral-800 dark:bg-neutral-900/50 dark:border-neutral-800',
          activeSection === item.id &&
            'border-primary dark:border-primary text-primary'
        )}
        onClick={() => setActiveSection(item.id)}
      >
        <div className="flex items-center p-3 pl-[32px] space-x-3">
          <span
            className={cn(
              'text-lg ml-[12px]',
              'text-gray-600 dark:text-neutral-300'
            )}
          >
            {item.icon}
          </span>
          <span className="text-sm flex-1">{item.title}</span>
        </div>
      </div>
    )
  }

  // 可拖拽的模块项
  return (
    <Reorder.Item
      id={item.id}
      value={item}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        'rounded-lg group border hover:border-primary flex overflow-hidden transition-opacity',
        'hover:bg-gray-50 bg-white border-gray-100',
        'dark:hover:bg-neutral-800 dark:bg-neutral-900/50 dark:border-neutral-800 dark:hover:border-primary',
        activeSection === item.id &&
          'border-primary dark:border-primary text-primary',
        // 隐藏时显示淡透明
        !item.enabled && 'opacity-40'
      )}
      whileHover={{ scale: 1.01 }}
      whileDrag={{ scale: 1.02 }}
    >
      {/* 拖拽手柄 */}
      <div
        onPointerDown={(event) => {
          dragControls.start(event)
        }}
        className={cn(
          'w-8 flex items-center justify-center touch-none shrink-0',
          'border-gray-100 dark:border-neutral-800',
          'cursor-grab hover:bg-gray-50 dark:hover:bg-neutral-800/50'
        )}
      >
        <GripVertical
          className={cn(
            'w-4 h-4',
            'text-gray-400 dark:text-neutral-400',
            'transform transition-transform group-hover:scale-110'
          )}
        />
      </div>

      {/* 模块内容 */}
      <div
        className="flex select-none items-center p-3 space-x-3 flex-1 cursor-pointer"
        onClick={() => setActiveSection(item.id)}
      >
        <div className="flex flex-1 items-center">
          <span
            className={cn(
              'text-lg mr-2',
              'text-gray-600 dark:text-neutral-300'
            )}
          >
            {item.icon}
          </span>
          <span className="text-sm flex-1">{item.title}</span>

          {/* 显示/隐藏按钮 */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation()
              toggleSectionVisibility(item.id)
            }}
            className={cn(
              'p-1.5 rounded-md',
              DEFAULT_SECTION_IDS.has(item.id) ? 'mr-0' : 'mr-2',
              'hover:bg-gray-100 text-gray-600',
              'dark:hover:bg-neutral-700 dark:text-neutral-300'
            )}
          >
            <Eye className={cn('w-4 h-4', item.enabled ? 'text-primary' : 'text-gray-300')} />
          </motion.button>

          {/* 删除按钮：仅自定义模块显示，默认模块不允许删除 */}
          {!DEFAULT_SECTION_IDS.has(item.id) && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation()
                const currentIndex = menuSections.findIndex((s) => s.id === item.id)
                updateMenuSections(
                  menuSections.filter((section) => section.id !== item.id)
                )
                if (currentIndex > 0) {
                  setActiveSection(menuSections[currentIndex - 1].id)
                }
              }}
              className={cn(
                'p-1.5 rounded-md',
                'hover:bg-gray-100 text-gray-600',
                'dark:hover:bg-neutral-700 dark:text-neutral-300'
              )}
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </motion.button>
          )}
        </div>
      </div>
    </Reorder.Item>
  )
}

export default LayoutItem


