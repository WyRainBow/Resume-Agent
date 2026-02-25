/**
 * 侧边面板组件（编辑区的第一列）
 * 包含模块选择和布局管理
 */
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Layout, Settings2, ChevronDown, Check } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { MenuSection, GlobalSettings } from '../types'
import LayoutSetting from './LayoutSetting'

// 自定义下拉：选项在触发按钮下方展开，不占居中弹层（类似图三）
function DropdownSelect<T extends string | number>({
  options,
  value,
  onChange,
  className,
  placeholder,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentLabel = options.find((o) => o.value === value)?.label ?? placeholder ?? String(value)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full px-3 py-2.5 text-sm rounded-lg border text-left flex items-center justify-between gap-2 transition-all duration-300',
          'border-slate-200 bg-white text-slate-800',
          'hover:border-slate-900 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900/10',
          open && 'ring-2 ring-slate-900/10 border-slate-900 shadow-md'
        )}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className={cn('w-4 h-4 shrink-0 text-slate-400 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-1 py-1 rounded-lg border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto"
          role="listbox"
        >
                {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={cn(
                  'w-full px-3 py-2 text-sm text-left flex items-center justify-between gap-2',
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700/80'
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// 字体大小选项 (LaTeX pt)
const FONT_SIZE_OPTIONS = [
  { value: 9, label: '9PT' },
  { value: 10, label: '10PT' },
  { value: 11, label: '11PT (默认)' },
  { value: 12, label: '12PT' },
]

// 页面边距选项（单位用「英寸」更易读）
const PAGE_MARGIN_OPTIONS: { value: 'tight' | 'compact' | 'standard' | 'relaxed' | 'wide'; label: string }[] = [
  { value: 'tight', label: '极紧 (0.25 英寸)' },
  { value: 'compact', label: '紧凑 (0.3 英寸)' },
  { value: 'standard', label: '标准 (0.4 英寸)' },
  { value: 'relaxed', label: '宽松 (0.5 英寸)' },
  { value: 'wide', label: '很宽 (0.6 英寸)' },
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
  { value: 15, label: '极紧凑 (15PX)' },
  { value: 20, label: '紧凑 (20PX)' },
  { value: 30, label: '适中 (30PX)' },
  { value: 40, label: '标准 (40PX)' },
  { value: 50, label: '宽松 (50PX)' },
]

// 头部空白参数基准（UI 显示 0 对应的内部值）
const HEADER_TOP_GAP_BASELINE = -4
const HEADER_NAME_CONTACT_GAP_BASELINE = 0
const HEADER_BOTTOM_GAP_BASELINE = -1

const normalizeDecimal = (value: number, digits = 2) => Number(value.toFixed(digits))

const inputBaseClass =
  'w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-colors'

const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

const LINE_SPACING_CUSTOM_VALUE = -1
const LINE_SPACING_WITH_CUSTOM = [
  ...LINE_SPACING_OPTIONS,
  { value: LINE_SPACING_CUSTOM_VALUE as number, label: '自定义...' },
]

// 行间距控件：自定义下拉 + 自定义输入
function LineSpacingControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const isPreset = LINE_SPACING_OPTIONS.some((opt) => opt.value === value)
  const [customMode, setCustomMode] = useState(!isPreset)
  const dropdownValue = customMode ? LINE_SPACING_CUSTOM_VALUE : value

  return (
    <div>
      <label className={labelClass}>行间距</label>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <DropdownSelect<number>
            options={LINE_SPACING_WITH_CUSTOM}
            value={dropdownValue}
            onChange={(v) => {
              if (v === LINE_SPACING_CUSTOM_VALUE) {
                setCustomMode(true)
              } else {
                setCustomMode(false)
                onChange(v)
              }
            }}
          />
        </div>
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
 * 设置卡片容器，可选折叠（collapsible + defaultExpanded）
 */
function SettingCard({
  icon: Icon,
  title,
  children,
  collapsible = false,
  defaultExpanded = true,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  collapsible?: boolean
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden',
        'bg-white dark:bg-slate-800/80',
        'border border-slate-200/60 dark:border-slate-700/80',
        'shadow-sm'
      )}
    >
      {title && (
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700/80">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50/50 dark:bg-slate-700/80 flex items-center justify-center">
                <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                {title}
              </span>
            </div>
            {collapsible && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                title={expanded ? '收起' : '展开'}
              >
                <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
              </button>
            )}
          </div>
        </div>
      )}
      {(!collapsible || expanded) && (
        <div className={cn('px-4', title ? 'py-4' : 'pt-4 pb-4')}>{children}</div>
      )}
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
  const [headerGapExpanded, setHeaderGapExpanded] = useState(true)
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
              className="flex justify-center w-full rounded-lg items-center gap-2 py-2 px-3 text-sm font-medium text-slate-900 bg-blue-50/50 hover:bg-blue-100/50 border border-blue-100/50 transition-colors"
            >
              添加自定义模块
            </motion.button>
          </div>
        </SettingCard>

        {/* 排版设置 */}
        <SettingCard icon={Settings2} title="排版设置" collapsible defaultExpanded={false}>
          <div className="space-y-5">
            {/* 字体大小 */}
            <div>
              <label className={labelClass}>字体大小</label>
              <div className="flex flex-nowrap gap-1">
                {FONT_SIZE_OPTIONS.map((opt) => {
                  const isActive = (globalSettings.latexFontSize || 11) === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateGlobalSettings({ latexFontSize: opt.value })}
                      className={cn(
                        'flex-1 min-w-0 px-1.5 py-1 text-[11px] font-bold rounded-md border transition-all',
                        isActive
                          ? 'bg-blue-50 text-slate-900 border-blue-200 shadow-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600'
                          : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:border-blue-400 hover:text-slate-900'
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
              <DropdownSelect
                options={PAGE_MARGIN_OPTIONS}
                value={globalSettings.latexMargin || 'standard'}
                onChange={(v) => updateGlobalSettings({ latexMargin: v })}
              />
            </div>

            {/* 行间距 */}
            <LineSpacingControl
              value={globalSettings.latexLineSpacing || 1.0}
              onChange={(v) => updateGlobalSettings({ latexLineSpacing: v })}
            />

            {/* 经历项间距 */}
            <div>
              <label className={labelClass}>实习经历间距</label>
              <DropdownSelect
                options={EXPERIENCE_GAP_OPTIONS}
                value={globalSettings.experienceGap ?? 0}
                onChange={(v) => updateGlobalSettings({ experienceGap: v })}
              />
            </div>

            {/* 页面内边距 */}
            <div>
              <label className={labelClass}>页面内边距</label>
              <DropdownSelect
                options={PAGE_PADDING_OPTIONS}
                value={globalSettings.pagePadding ?? 40}
                onChange={(v) => updateGlobalSettings({ pagePadding: v })}
              />
            </div>

            {/* 头部空白（LaTeX） */}
            <div className="rounded-lg bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100/50 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">头部空白（PX）</label>
                <button
                  type="button"
                  onClick={() => setHeaderGapExpanded((v) => !v)}
                  className="p-1 rounded hover:bg-blue-100/50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                  title={headerGapExpanded ? '收起' : '展开'}
                >
                  <ChevronDown className={cn('w-4 h-4 transition-transform', headerGapExpanded && 'rotate-180')} />
                </button>
              </div>
              {headerGapExpanded && (
                <>
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
                支持负值用于压缩顶部留白
              </p>
                </>
              )}
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
