/**
 * Formatting Controls Panel —— 移植自 Resume-Matcher components/builder/formatting-controls.tsx。
 * 差异:5 套模板;label 硬编码 EN(匹配 RM 截图审美);token 换算为 arbitrary class。
 */
import React, { useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import {
  type TemplateSettings,
  type TemplateType,
  type PageSize,
  type SpacingLevel,
  type HeaderFontFamily,
  type BodyFontFamily,
  type AccentColor,
  DEFAULT_TEMPLATE_SETTINGS,
  applyTemplatePreset,
  SECTION_SPACING_MAP,
  ITEM_SPACING_MAP,
  LINE_HEIGHT_MAP,
  FONT_SIZE_MAP,
  HEADER_SCALE_MAP,
  COMPACT_MULTIPLIER,
  COMPACT_LINE_HEIGHT_MULTIPLIER,
  TEMPLATE_OPTIONS,
  PAGE_SIZE_INFO,
  ACCENT_COLOR_MAP,
} from '../settings'
import { TemplateThumbnail } from './TemplateSelector'
import { SwissButton } from './SwissButton'

interface FormattingControlsProps {
  settings: TemplateSettings
  onChange: (settings: TemplateSettings) => void
  /** 隐藏内部模板选择区（Workspace 用外部统一模板选择器时置 true） */
  hideTemplateSection?: boolean
}

const FONT_LABELS: Record<HeaderFontFamily, string> = {
  serif: '衬线',
  'sans-serif': '无衬线',
  mono: '等宽',
}

export const FormattingControls: React.FC<FormattingControlsProps> = ({ settings, onChange, hideTemplateSection = false }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const compactMultiplier = settings.compactMode ? COMPACT_MULTIPLIER : 1
  const sectionGapRem =
    parseFloat(SECTION_SPACING_MAP[settings.spacing.section]) * compactMultiplier
  const itemGapRem = parseFloat(ITEM_SPACING_MAP[settings.spacing.item]) * compactMultiplier
  const lineHeightValue = settings.compactMode
    ? LINE_HEIGHT_MAP[settings.spacing.lineHeight] * COMPACT_LINE_HEIGHT_MULTIPLIER
    : LINE_HEIGHT_MAP[settings.spacing.lineHeight]

  const formatRem = (value: number) =>
    `${value.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}rem`

  const handleTemplateChange = (template: TemplateType) => {
    // Single-typeface templates (latex/clean) seed their signature fonts on selection.
    onChange(applyTemplatePreset(settings, template))
  }

  const handlePageSizeChange = (pageSize: PageSize) => {
    onChange({ ...settings, pageSize })
  }

  const handleMarginChange = (key: keyof TemplateSettings['margins'], value: number) => {
    onChange({
      ...settings,
      margins: { ...settings.margins, [key]: value },
    })
  }

  const handleSpacingChange = (key: keyof TemplateSettings['spacing'], value: SpacingLevel) => {
    onChange({
      ...settings,
      spacing: { ...settings.spacing, [key]: value },
    })
  }

  const handleFontChange = (key: 'base' | 'headerScale', value: SpacingLevel) => {
    onChange({
      ...settings,
      fontSize: { ...settings.fontSize, [key]: value },
    })
  }

  const handleHeaderFontChange = (headerFont: HeaderFontFamily) => {
    onChange({
      ...settings,
      fontSize: { ...settings.fontSize, headerFont },
    })
  }

  const handleBodyFontChange = (bodyFont: BodyFontFamily) => {
    onChange({
      ...settings,
      fontSize: { ...settings.fontSize, bodyFont },
    })
  }

  const handleCompactModeToggle = () => {
    onChange({ ...settings, compactMode: !settings.compactMode })
  }

  const handleShowContactIconsToggle = () => {
    onChange({ ...settings, showContactIcons: !settings.showContactIcons })
  }

  const handleAccentColorChange = (accentColor: AccentColor) => {
    onChange({ ...settings, accentColor })
  }

  const handleReset = () => {
    onChange(DEFAULT_TEMPLATE_SETTINGS)
  }

  return (
    <div className="border border-black bg-white shadow-[4px_4px_0px_0px_#000000]">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-[#F1F2F5] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-700"></div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider">
            模板与排版
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-[#878E99]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#878E99]" />
        )}
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="border-t border-black p-4 space-y-6">
          {/* Template Selection */}
          {!hideTemplateSection && (
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-[#444850]">
              模板
            </h4>
            <div className="flex flex-wrap gap-3">
              {TEMPLATE_OPTIONS.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateChange(template.id)}
                  className={`group flex flex-col items-center p-2 border transition-all ${
                    settings.template === template.id
                      ? 'border-blue-700 bg-white shadow-[2px_2px_0px_0px_#1D4ED8]'
                      : 'border-black bg-white hover:bg-[#F1F2F5] hover:shadow-[1px_1px_0px_0px_#000000]'
                  }`}
                  title={template.description}
                >
                  <div className="w-12 h-16 mb-1.5 flex items-center justify-center">
                    <TemplateThumbnail
                      type={template.id}
                      isActive={settings.template === template.id}
                    />
                  </div>
                  <span
                    className={`font-mono text-[9px] uppercase tracking-wider font-bold ${
                      settings.template === template.id ? 'text-blue-700' : 'text-[#444850]'
                    }`}
                  >
                    {template.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Accent Color Selection - Visible for accent-driven templates */}
          {(settings.template === 'modern' || settings.template === 'vivid') && (
            <div>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-[#444850]">
                强调色
              </h4>
              <div className="flex gap-2">
                {(Object.keys(ACCENT_COLOR_MAP) as AccentColor[]).map((color) => (
                  <button
                    key={color}
                    onClick={() => handleAccentColorChange(color)}
                    className={`flex items-center gap-2 px-3 py-2 border font-mono text-xs transition-all ${
                      settings.accentColor === color
                        ? 'border-blue-700 bg-white shadow-[2px_2px_0px_0px_#1D4ED8]'
                        : 'border-black bg-white hover:bg-[#F1F2F5]'
                    }`}
                    title={ACCENT_COLOR_MAP[color].name}
                  >
                    <span
                      className="w-4 h-4 border border-[#878E99]"
                      style={{ backgroundColor: ACCENT_COLOR_MAP[color].primary }}
                    />
                    <span>{ACCENT_COLOR_MAP[color].name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Page Size Selection */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-[#444850]">
              页面尺寸
            </h4>
            <div className="flex gap-2">
              {(Object.keys(PAGE_SIZE_INFO) as PageSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
                  className={`flex-1 px-3 py-2 border font-mono text-xs transition-all ${
                    settings.pageSize === size
                      ? 'border-blue-700 bg-white text-blue-700 shadow-[2px_2px_0px_0px_#1D4ED8]'
                      : 'border-black bg-white text-[#444850] hover:bg-[#F1F2F5]'
                  }`}
                  title={PAGE_SIZE_INFO[size].dimensions}
                >
                  <div className="font-bold">{PAGE_SIZE_INFO[size].name}</div>
                  <div className="text-[9px] opacity-70">{PAGE_SIZE_INFO[size].dimensions}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Margins Section */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-[#444850]">
              页边距 (mm)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <MarginSlider
                label="上"
                value={settings.margins.top}
                onChange={(v) => handleMarginChange('top', v)}
              />
              <MarginSlider
                label="下"
                value={settings.margins.bottom}
                onChange={(v) => handleMarginChange('bottom', v)}
              />
              <MarginSlider
                label="左"
                value={settings.margins.left}
                onChange={(v) => handleMarginChange('left', v)}
              />
              <MarginSlider
                label="右"
                value={settings.margins.right}
                onChange={(v) => handleMarginChange('right', v)}
              />
            </div>
          </div>

          {/* Spacing Section */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-[#444850]">
              间距
            </h4>
            <div className="space-y-3">
              <SpacingSelector
                label="模块"
                value={settings.spacing.section}
                onChange={(v) => handleSpacingChange('section', v)}
              />
              <SpacingSelector
                label="条目"
                value={settings.spacing.item}
                onChange={(v) => handleSpacingChange('item', v)}
              />
              <SpacingSelector
                label="行距"
                value={settings.spacing.lineHeight}
                onChange={(v) => handleSpacingChange('lineHeight', v)}
              />
            </div>
          </div>

          {/* Font Size Section */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-[#444850]">
              字号
            </h4>
            <div className="space-y-3">
              <SpacingSelector
                label="正文"
                value={settings.fontSize.base}
                onChange={(v) => handleFontChange('base', v)}
              />
              <SpacingSelector
                label="标题"
                value={settings.fontSize.headerScale}
                onChange={(v) => handleFontChange('headerScale', v)}
              />
              {/* Header Font Family */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs w-16 text-[#444850]">标题字体:</span>
                <div className="flex gap-1">
                  {(['serif', 'sans-serif', 'mono'] as HeaderFontFamily[]).map((font) => (
                    <button
                      key={font}
                      onClick={() => handleHeaderFontChange(font)}
                      className={`px-2 py-1 font-mono text-xs border transition-all ${
                        settings.fontSize.headerFont === font
                          ? 'bg-blue-700 text-white border-blue-700 shadow-[1px_1px_0px_0px_#000000]'
                          : 'bg-white text-[#444850] border-[#878E99] hover:border-black'
                      }`}
                      style={{
                        fontFamily:
                          font === 'serif'
                            ? 'Georgia, serif'
                            : font === 'mono'
                              ? 'monospace'
                              : 'system-ui, sans-serif',
                      }}
                    >
                      {FONT_LABELS[font]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Body Font Family */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs w-16 text-[#444850]">正文字体:</span>
                <div className="flex gap-1">
                  {(['serif', 'sans-serif', 'mono'] as BodyFontFamily[]).map((font) => (
                    <button
                      key={font}
                      onClick={() => handleBodyFontChange(font)}
                      className={`px-2 py-1 font-mono text-xs border transition-all ${
                        settings.fontSize.bodyFont === font
                          ? 'bg-blue-700 text-white border-blue-700 shadow-[1px_1px_0px_0px_#000000]'
                          : 'bg-white text-[#444850] border-[#878E99] hover:border-black'
                      }`}
                      style={{
                        fontFamily:
                          font === 'serif'
                            ? 'Georgia, serif'
                            : font === 'mono'
                              ? 'monospace'
                              : 'system-ui, sans-serif',
                      }}
                    >
                      {FONT_LABELS[font]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Options Section */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-[#444850]">
              选项
            </h4>
            <div className="space-y-3">
              {/* Compact Mode Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  onClick={handleCompactModeToggle}
                  className={`relative w-10 h-5 border-2 transition-all ${
                    settings.compactMode
                      ? 'bg-blue-700 border-blue-700'
                      : 'bg-white border-[#878E99]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-3.5 h-3.5 bg-white border transition-all ${
                      settings.compactMode ? 'left-5 border-blue-700' : 'left-0.5 border-[#878E99]'
                    }`}
                  />
                </button>
                <span className="font-mono text-xs text-[#444850]">紧凑模式</span>
              </label>

              {/* Show Contact Icons Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  onClick={handleShowContactIconsToggle}
                  className={`relative w-10 h-5 border-2 transition-all ${
                    settings.showContactIcons
                      ? 'bg-blue-700 border-blue-700'
                      : 'bg-white border-[#878E99]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-3.5 h-3.5 bg-white border transition-all ${
                      settings.showContactIcons
                        ? 'left-5 border-blue-700'
                        : 'left-0.5 border-[#878E99]'
                    }`}
                  />
                </button>
                <span className="font-mono text-xs text-[#444850]">联系方式图标</span>
              </label>
            </div>
          </div>

          {/* Effective output + Reset */}
          <div className="pt-2 border-t border-[#F1F2F5] space-y-3">
            <div>
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#444850] mb-2">
                生效值
              </h4>
              <div className="font-mono text-[10px] text-[#444850] space-y-1">
                <div>
                  页边距: {settings.margins.top}/{settings.margins.bottom}/{settings.margins.left}
                  /{settings.margins.right} mm
                </div>
                <div>模块间距: {formatRem(sectionGapRem)}</div>
                <div>条目间距: {formatRem(itemGapRem)}</div>
                <div>行高: {lineHeightValue.toFixed(2)}</div>
                <div>正文字号: {FONT_SIZE_MAP[settings.fontSize.base]}</div>
                <div>标题倍率: {HEADER_SCALE_MAP[settings.fontSize.headerScale]}x</div>
                <div>标题字体: {FONT_LABELS[settings.fontSize.headerFont]}</div>
                <div>正文字体: {FONT_LABELS[settings.fontSize.bodyFont]}</div>
              </div>
              {settings.compactMode && (
                <div className="font-mono text-[10px] text-[#878E99] mt-2">
                  紧凑模式:间距 ×0.6,行高 ×0.92
                </div>
              )}
            </div>
            <SwissButton variant="outline" size="sm" onClick={handleReset} className="w-full">
              <RotateCcw className="w-3 h-3" />
              恢复默认
            </SwissButton>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Margin Slider Component - Range input for margin values (5-25mm)
 */
interface MarginSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
}

const MarginSlider: React.FC<MarginSliderProps> = ({ label, value, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs w-12 text-[#444850]">{label}:</span>
      <input
        type="range"
        min={5}
        max={25}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="flex-1 h-1 bg-[#F1F2F5] rounded-none appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:w-3
                   [&::-webkit-slider-thumb]:h-3
                   [&::-webkit-slider-thumb]:bg-blue-700
                   [&::-webkit-slider-thumb]:border-none
                   [&::-webkit-slider-thumb]:cursor-pointer
                   [&::-moz-range-thumb]:w-3
                   [&::-moz-range-thumb]:h-3
                   [&::-moz-range-thumb]:bg-blue-700
                   [&::-moz-range-thumb]:border-none
                   [&::-moz-range-thumb]:cursor-pointer"
      />
      <span className="font-mono text-xs w-6 text-right text-[#444850]">{value}</span>
    </div>
  )
}

/**
 * Spacing Selector Component - Button group for selecting spacing levels (1-5)
 */
interface SpacingSelectorProps {
  label: string
  value: SpacingLevel
  onChange: (value: SpacingLevel) => void
}

const SpacingSelector: React.FC<SpacingSelectorProps> = ({ label, value, onChange }) => {
  const levels: SpacingLevel[] = [1, 2, 3, 4, 5]

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs w-16 text-[#444850]">{label}:</span>
      <div className="flex gap-1">
        {levels.map((level) => (
          <button
            key={level}
            onClick={() => onChange(level)}
            className={`w-6 h-6 font-mono text-xs border transition-all ${
              value === level
                ? 'bg-blue-700 text-white border-blue-700 shadow-[1px_1px_0px_0px_#000000]'
                : 'bg-white text-[#444850] border-[#878E99] hover:border-black'
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  )
}
