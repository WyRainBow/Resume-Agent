/**
 * 侧边面板组件（第一列）
 * 包含布局管理、排版设置
 * 注：已删除主题色功能
 */
import { motion } from 'framer-motion'
import { Layout, Type, SpaceIcon } from 'lucide-react'
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
        <SettingCard icon={Layout} title="布局">
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
              className="flex justify-center w-full rounded-lg items-center gap-2 py-2 px-3 text-sm font-medium text-primary bg-indigo-50 dark:bg-indigo-900/20"
            >
              添加自定义模块
            </motion.button>
          </div>
        </SettingCard>

        {/* 排版设置 */}
        <SettingCard icon={Type} title="排版">
          <div className="space-y-6">
            {/* 行高 */}
            <div className="space-y-2">
              <label className="text-sm text-gray-600 dark:text-neutral-300">
                行高
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="2"
                  step="0.1"
                  value={globalSettings?.lineHeight || 1.5}
                  onChange={(e) =>
                    updateGlobalSettings({ lineHeight: parseFloat(e.target.value) })
                  }
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700"
                />
                <span className="min-w-[3ch] text-sm text-gray-600 dark:text-neutral-300">
                  {globalSettings?.lineHeight || 1.5}
                </span>
              </div>
            </div>

            {/* 基础字号 */}
            <div className="space-y-2">
              <label className="text-sm text-gray-600 dark:text-neutral-300">
                基础字号
              </label>
              <select
                value={globalSettings?.baseFontSize || 16}
                onChange={(e) =>
                  updateGlobalSettings({ baseFontSize: parseInt(e.target.value) })
                }
                className={cn(
                  'w-full px-3 py-2 rounded-md border',
                  'bg-white border-gray-200 text-gray-700',
                  'dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200'
                )}
              >
                {[12, 13, 14, 15, 16, 18, 20, 24].map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>

            {/* 模块标题字号 */}
            <div className="space-y-2">
              <label className="text-sm text-gray-600 dark:text-neutral-300">
                模块标题字号
              </label>
              <select
                value={globalSettings?.headerSize || 18}
                onChange={(e) =>
                  updateGlobalSettings({ headerSize: parseInt(e.target.value) })
                }
                className={cn(
                  'w-full px-3 py-2 rounded-md border',
                  'bg-white border-gray-200 text-gray-700',
                  'dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200'
                )}
              >
                {[12, 13, 14, 15, 16, 18, 20, 24].map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>
          </div>
        </SettingCard>

        {/* 间距设置 */}
        <SettingCard icon={SpaceIcon} title="间距">
          <div className="space-y-6">
            {/* 页边距 */}
            <div className="space-y-2">
              <label className="text-sm text-gray-600 dark:text-neutral-300">
                页边距
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={globalSettings?.pagePadding || 40}
                  onChange={(e) =>
                    updateGlobalSettings({ pagePadding: parseInt(e.target.value) })
                  }
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700"
                />
                <span className="min-w-[4ch] text-sm text-gray-600 dark:text-neutral-300">
                  {globalSettings?.pagePadding || 40}px
                </span>
              </div>
            </div>

            {/* 模块间距 */}
            <div className="space-y-2">
              <label className="text-sm text-gray-600 dark:text-neutral-300">
                模块间距
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={globalSettings?.sectionSpacing || 20}
                  onChange={(e) =>
                    updateGlobalSettings({ sectionSpacing: parseInt(e.target.value) })
                  }
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700"
                />
                <span className="min-w-[4ch] text-sm text-gray-600 dark:text-neutral-300">
                  {globalSettings?.sectionSpacing || 20}px
                </span>
              </div>
            </div>

            {/* 段落间距 */}
            <div className="space-y-2">
              <label className="text-sm text-gray-600 dark:text-neutral-300">
                段落间距
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={globalSettings?.paragraphSpacing || 10}
                  onChange={(e) =>
                    updateGlobalSettings({ paragraphSpacing: parseInt(e.target.value) })
                  }
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700"
                />
                <span className="min-w-[4ch] text-sm text-gray-600 dark:text-neutral-300">
                  {globalSettings?.paragraphSpacing || 10}px
                </span>
              </div>
            </div>
          </div>
        </SettingCard>
      </div>
    </div>
  )
}

export default SidePanel


