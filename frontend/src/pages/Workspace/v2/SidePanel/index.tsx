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

// 头部空白参数基准（UI 显示 0 对应的内部值）
const HEADER_TOP_GAP_BASELINE = -4
const HEADER_NAME_CONTACT_GAP_BASELINE = 0
const HEADER_BOTTOM_GAP_BASELINE = -1

const normalizeDecimal = (value: number, digits = 2) => Number(value.toFixed(digits))

const inputBaseClass =
  'w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 dark:focus:ring-slate-500/30 dark:focus:border-slate-500 transition-colors'

const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

// 行间距控件：预设选项 + 自定义输入
function LineSpacingControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const isPreset = LINE_SPACING_OPTIONS.some(opt => opt.value === value)
  const [customMode, setCustomMode] = useState(!isPreset)

  return (
    <div>
      <label className={labelClass}>行间距</label>
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
          className={cn(inputBaseClass, 'flex-1')}
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
            className={cn(inputBaseClass, 'w-20')}
          />
        )}
      </div>
    </div>
  )
}

function HeaderGapControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
      <input
        type="number"
        step="0.5"
        min="-80"
        max="80"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputBaseClass}
      />
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
        'bg-white dark:bg-slate-800/80',
        'border border-slate-200/80 dark:border-slate-700/80',
        'shadow-sm'
      )}
    >
      {title && (
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/80 flex items-center justify-center">
              <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
              {title}
            </span>
          </div>
        </div>
      )}
      <div className={cn('px-4', title ? 'py-4' : 'pt-4 pb-4')}>{children}</div>
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
          <div className="space-y-5">
            {/* 字体大小 */}
            <div>
              <label className={labelClass}>字体大小</label>
              <div className="flex flex-wrap gap-2">
                {FONT_SIZE_OPTIONS.map((opt) => {
                  const isActive = (globalSettings.latexFontSize || 11) === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateGlobalSettings({ latexFontSize: opt.value })}
                      className={cn(
                        'px-3.5 py-2 text-sm font-medium rounded-lg border transition-all',
                        isActive
                          ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200 shadow-sm'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 页面边距 */}
            <div>
              <label className={labelClass}>页面边距</label>
              <select
                value={globalSettings.latexMargin || 'standard'}
                onChange={(e) => updateGlobalSettings({ latexMargin: e.target.value as any })}
                className={inputBaseClass}
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
              <label className={labelClass}>实习经历间距</label>
              <select
                value={globalSettings.experienceGap ?? 0}
                onChange={(e) => updateGlobalSettings({ experienceGap: Number(e.target.value) })}
                className={inputBaseClass}
              >
                {EXPERIENCE_GAP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 页面内边距 */}
            <div>
              <label className={labelClass}>页面内边距</label>
              <select
                value={globalSettings.pagePadding || 40}
                onChange={(e) => updateGlobalSettings({ pagePadding: Number(e.target.value) })}
                className={inputBaseClass}
              >
                {PAGE_PADDING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 头部空白（LaTeX） */}
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 p-3 space-y-3">
              <label className={labelClass}>头部空白（px）</label>
              <HeaderGapControl
                label="顶部空白"
                value={normalizeDecimal((globalSettings.latexHeaderTopGapPx ?? HEADER_TOP_GAP_BASELINE) - HEADER_TOP_GAP_BASELINE)}
                onChange={(v) => updateGlobalSettings({ latexHeaderTopGapPx: normalizeDecimal(HEADER_TOP_GAP_BASELINE + v) })}
              />
              <HeaderGapControl
                label="姓名与联系信息间距"
                value={normalizeDecimal((globalSettings.latexHeaderNameContactGapPx ?? HEADER_NAME_CONTACT_GAP_BASELINE) - HEADER_NAME_CONTACT_GAP_BASELINE)}
                onChange={(v) => updateGlobalSettings({ latexHeaderNameContactGapPx: normalizeDecimal(HEADER_NAME_CONTACT_GAP_BASELINE + v) })}
              />
              <HeaderGapControl
                label="联系信息下方空白"
                value={normalizeDecimal((globalSettings.latexHeaderBottomGapPx ?? HEADER_BOTTOM_GAP_BASELINE) - HEADER_BOTTOM_GAP_BASELINE)}
                onChange={(v) => updateGlobalSettings({ latexHeaderBottomGapPx: normalizeDecimal(HEADER_BOTTOM_GAP_BASELINE + v) })}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                支持负值，用于压缩顶部留白
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              调整后简历会自动重新渲染
            </p>
          </div>
        </SettingCard>

      </div>
    </div>
  )
}

export default SidePanel
