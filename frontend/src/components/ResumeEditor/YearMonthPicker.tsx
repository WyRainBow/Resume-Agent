/**
 * 年月选择器组件
 */
import React from 'react'
import type { YearMonthPickerProps } from './types'

export function YearMonthPicker({ 
  value, 
  onChange, 
  placeholder = '选择年月',
  style = {}
}: YearMonthPickerProps) {
  // 解析当前值（格式如 "2022-05" 或 "2022.05" 或 "2025" 或 "至今"）
  const parseValue = (val: string) => {
    if (!val || val === '至今' || val === '现在' || val === 'present') {
      return { year: '', month: '', isPresent: val === '至今' || val === '现在' || val === 'present' }
    }
    // 尝试匹配 年-月 或 年.月 格式
    const fullMatch = val.match(/(\d{4})[-./年](\d{1,2})/)
    if (fullMatch) {
      return { year: fullMatch[1], month: fullMatch[2].padStart(2, '0'), isPresent: false }
    }
    // 尝试匹配只有年份的格式
    const yearMatch = val.match(/^(\d{4})$/)
    if (yearMatch) {
      return { year: yearMatch[1], month: '', isPresent: false }
    }
    return { year: '', month: '', isPresent: false }
  }

  const { year, month, isPresent } = parseValue(value)
  
  // 生成年份选项（2020-2030年）
  const years = Array.from({ length: 11 }, (_, i) => 2020 + i)
  
  // 生成月份选项
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

  const handleChange = (newYear: string, newMonth: string, newIsPresent: boolean) => {
    if (newIsPresent) {
      onChange('至今')
    } else if (newYear && newMonth) {
      onChange(`${newYear}-${newMonth}`)
    } else if (newYear) {
      onChange(newYear)
    } else {
      onChange('')
    }
  }

  const selectStyle: React.CSSProperties = {
    padding: '8px 10px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '0.5px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' fill-opacity='0.6' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: '28px',
    ...style
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <select
        value={isPresent ? '' : year}
        onChange={(e) => handleChange(e.target.value, month, false)}
        style={{ ...selectStyle, flex: 1 }}
        disabled={isPresent}
      >
        <option value="">年</option>
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <select
        value={isPresent ? '' : month}
        onChange={(e) => handleChange(year, e.target.value, false)}
        style={{ ...selectStyle, width: '70px' }}
        disabled={isPresent || !year}
      >
        <option value="">月</option>
        {months.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  )
}
