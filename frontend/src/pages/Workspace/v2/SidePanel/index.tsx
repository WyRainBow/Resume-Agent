/**
 * 侧边面板组件（编辑区的第一列）
 * 包含模块选择和布局管理
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Layout, Settings2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { MenuSection, GlobalSettings } from '../types'
import LayoutSetting from './LayoutSetting'

// 字体大小选项 (LaTeX pt)
const FONT_SIZE_OPTIONS = [
  { value: 9, label: '9pt' },
  { value: 10, label: '10pt' },
  { value: 11, label: '11pt (默认)' },
  { value: 12, label: '12pt' },
]

// 页面边距选项
const PAGE_MARGIN_OPTIONS = [
  { value: 'tight', label: '极紧 (0.25in)' },
  { value: 'compact', label: '紧凑 (0.3in)' },
  { value: 'standard', label: '标准 (0.4in)' },
  { value: 'relaxed', label: '宽松 (0.5in)' },
  { value: 'wide', label: '很宽 (0.6in)' },
]

// 行间距选项
const LINE_SPACING_OPTIONS = [
  { value: 0.9, label: '0.9 (极紧)' },
  { value: 1.0, label: '1.0 (默认)' },
  { value: 1.1, label: '1.1' },
  { value: 1.15, label: '1.15' },
  { value: 1.2, label: '1.2' },
  { value: 1.3, label: '1.3' },
  { value: 1.5, label: '1.5 (宽松)' },
]

// 公司 Logo 大小选项
const LOGO_SIZE_OPTIONS = [
  { value: 14, label: '14px (小)' },
  { value: 16, label: '16px' },
  { value: 18, label: '18px' },
  { value: 20, label: '20px (默认)' },
  { value: 24, label: '24px' },
  { value: 28, label: '28px' },
  { value: 32, label: '32px (大)' },
]

// 经历项间距选项 (LaTeX ex)
const EXPERIENCE_GAP_OPTIONS = [
  { value: 0, label: '无间距 (标准)' },
  { value: 1, label: '1ex' },
  { value: 1.2, label: '1.2ex' },
  { value: 1.5, label: '1.5ex' },
  { value: 2, label: '2ex (宽松)' },
]

// 页面内边距选项 (HTML 模板)
const PAGE_PADDING_OPTIONS = [
  { value: 15, label: '极紧凑 (15px)' },
  { value: 20, label: '紧凑 (20px)' },
  { value: 30, label: '适中 (30px)' },
  { value: 40, label: '标准 (40px)' },
  { value: 50, label: '宽松 (50px)' },
]

// 行间距控件：预设选项 + 自定义输入
function LineSpacingControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const isPreset = LINE_SPACING_OPTIONS.some(opt => opt.value === value)
  const [customMode, setCustomMode] = useState(!isPreset)

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
        行间距
      </label>
      <div className="flex gap-2">
        <select
          value={customMode ? 'custom' : value}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              setCustomMode(true)
            } else {
              setCustomMode(false)
              onChange(Number(e.target.value))
            }
          }}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          {LINE_SPACING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          <option value="custom">自定义...</option>
        </select>
        {customMode && (
          <input
            type="number"
            step="0.05"
            min="0.5"
            max="3.0"
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v) && v >= 0.5 && v <= 3.0) onChange(v)
            }}
            className="w-20 px-2 py-2 text-sm rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        )}
      </div>
    </div>
  )
}

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
      {title && (
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
      )}
      <div className={cn("px-4", title ? "pb-4" : "pt-4 pb-4")}>{children}</div>
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
        <SettingCard icon={Layout} title="">
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

        {/* 排版设置 */}
        <SettingCard icon={Settings2} title="排版设置">
          <div className="space-y-4">
            {/* 字体大小 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                字体大小
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FONT_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateGlobalSettings({ latexFontSize: opt.value })}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                      (globalSettings.latexFontSize || 11) === opt.value
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 页面边距 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                页面边距
              </label>
              <select
                value={globalSettings.latexMargin || 'standard'}
                onChange={(e) => updateGlobalSettings({ latexMargin: e.target.value as any })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {PAGE_MARGIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 行间距 */}
            <LineSpacingControl
              value={globalSettings.latexLineSpacing || 1.0}
              onChange={(v) => updateGlobalSettings({ latexLineSpacing: v })}
            />

            {/* 经历项间距 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                实习经历间距
              </label>
              <select
                value={globalSettings.experienceGap ?? 0}
                onChange={(e) => updateGlobalSettings({ experienceGap: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {EXPERIENCE_GAP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 公司 Logo 大小 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                公司 Logo 大小
              </label>
              <select
                value={globalSettings.companyLogoSize ?? 20}
                onChange={(e) => updateGlobalSettings({ companyLogoSize: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {LOGO_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 页面内边距 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                页面内边距
              </label>
              <select
                value={globalSettings.pagePadding || 40}
                onChange={(e) => updateGlobalSettings({ pagePadding: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {PAGE_PADDING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">
              调整后简历会自动重新渲染
            </p>
          </div>
        </SettingCard>

      </div>
    </div>
  )
}

export default SidePanel
