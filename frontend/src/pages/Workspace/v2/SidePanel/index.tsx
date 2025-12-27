/**
 * 侧边面板组件（编辑区的第一列）
 * 包含模块选择和布局管理
 */
import { motion } from 'framer-motion'
import { Layout } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { MenuSection, GlobalSettings } from '../types'
import LayoutSetting from './LayoutSetting'

interface SidePanelProps {
  menuSections: MenuSection[]
  activeSection: string
  globalSettings: GlobalSettings
  setActiveSection: (id: string) => void
  toggleSectionVisibility: (id: string) => void
  updateMenuSections: (sections: MenuSection[]) => void
  reorderSections: (sections: MenuSection[]) => void
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void
  addCustomSection: () => void
}

/**
 * 设置卡片容器
 */
function SettingCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden',
        'bg-white/70 dark:bg-slate-800/70',
        'backdrop-blur-sm',
        'border border-white/50 dark:border-slate-700/50',
        'shadow-sm shadow-slate-200/50 dark:shadow-slate-900/50'
      )}
    >
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {title}
          </span>
        </div>
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  )
}

export function SidePanel({
  menuSections,
  activeSection,
  globalSettings,
  setActiveSection,
  toggleSectionVisibility,
  updateMenuSections,
  reorderSections,
  updateGlobalSettings,
  addCustomSection,
}: SidePanelProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* 布局设置 */}
        <SettingCard icon={Layout} title="模块">
          <LayoutSetting
            menuSections={menuSections}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            toggleSectionVisibility={toggleSectionVisibility}
            updateMenuSections={updateMenuSections}
            reorderSections={reorderSections}
          />

          {/* 添加自定义模块按钮 */}
          <div className="space-y-2 py-4">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.9 }}
              onClick={addCustomSection}
              className="flex justify-center w-full rounded-lg items-center gap-2 py-2 px-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
            >
              添加自定义模块
            </motion.button>
          </div>
        </SettingCard>

      </div>
    </div>
  )
}

export default SidePanel
